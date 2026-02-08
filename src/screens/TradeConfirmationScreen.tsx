import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Image,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Platform,
    ActivityIndicator,
    ScrollView,
    RefreshControl,
    Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import * as DocumentPicker from 'expo-document-picker';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import Constants from 'expo-constants';

import ScreenHeader from '../components/ScreenHeader';
import appTheme from '../styles/theme';
import { useTheme } from '../theme/index';
import ServicePickerModal from '../components/ServicePickerModal';
import { showToast } from '../utils/toast';
import authStorage from '../utils/authStorage';
import { RootStackParamList } from './types';
import type { DocumentPickerAsset } from 'expo-document-picker';

type NavigationProp = StackNavigationProp<RootStackParamList, 'TradeConfirmation'>;
const API_URL = Constants.expoConfig?.extra?.apiUrl || 'https://exdollarium-6f0f5aab6a7d.herokuapp.com';

type Service = { _id: string; name: string; label?: string; supportsWithdrawal?: boolean; isNew?: boolean };

const TradeConfirmationScreen = () => {
    const navigation = useNavigation<NavigationProp>();
    const themeCtx = (() => { try { return useTheme(); } catch (e) { return undefined as any; } })();
    const runtimeTheme = themeCtx || appTheme;
    const styles = React.useMemo(() => createStyles(runtimeTheme), [runtimeTheme]);

    // State
    const [services, setServices] = useState<Service[]>([]);
    const [loadingServices, setLoadingServices] = useState<boolean>(false);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedServiceId, setSelectedServiceId] = useState<string>('');
    const [selectedServiceLabel, setSelectedServiceLabel] = useState<string>('');
    const [showServiceModal, setShowServiceModal] = useState<boolean>(false);
    
    const [note, setNote] = useState('');
    const [amount, setAmount] = useState<string>('');
    const [currency, setCurrency] = useState<string>('USD');
    const [files, setFiles] = useState<DocumentPickerAsset[]>([]);
    const [isPreSubmit, setIsPreSubmit] = useState<boolean>(false);
    const [username, setUsername] = useState<string>('');
    const [holdDays, setHoldDays] = useState<number>(1);
    const [transactionId, setTransactionId] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => { fetchServices(); }, []);
    useEffect(() => { if (selectedServiceId) generateTransactionId(); }, [selectedServiceId]);

    const fetchServices = async () => {
        setLoadingServices(true);
        try {
            const res = await axios.get(`${API_URL}/api/services`);
            setServices(res.data || []);
        } catch (error) {
            showToast('Failed to load services.');
        } finally {
            setLoadingServices(false);
            setRefreshing(false);
        }
    };

    const generateTransactionId = () => {
        const timestamp = Date.now();
        const randomPart = uuidv4().split('-')[0];
        setTransactionId(`TRX-${timestamp}-${randomPart}`);
    };

    const pickFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true });
            if (!result.canceled && result.assets) {
                setFiles((prev) => [...prev, ...result.assets]);
            }
        } catch (error) {
            showToast('Could not pick file.');
        }
    };

    const handleSubmit = async () => {
        // Validation including the missing fields logic
        if (!selectedServiceId) return showToast('Please select a service provider.');
        if (!amount) return showToast('Please enter an amount.');
        if (files.length === 0) return showToast('Please upload evidence (Receipt/Screenshot).');

        setLoading(true);
        try {
            const formData = new FormData();
            
            // Core Transaction Data
            formData.append('serviceId', selectedServiceId);
            formData.append('transactionId', transactionId);
            formData.append('amount', amount.trim());
            formData.append('currency', currency);
            formData.append('note', note.trim());
            
            const amountDisplay = `${currency === 'USD' ? '$' : currency} ${amount.trim()}`;
            formData.append('amountDisplay', amountDisplay);

            if (isPreSubmit) {
                formData.append('username', username);
                formData.append('holdDays', String(holdDays));
            }

            // Append Files correctly for Multipart
            files.forEach((file) => {
                const fileToUpload = {
                    uri: Platform.OS === 'ios' ? file.uri.replace('file://', '') : file.uri,
                    type: file.mimeType || 'application/octet-stream',
                    name: file.name,
                };
                formData.append('files', fileToUpload as any);
            });

            const token = await authStorage.getToken();
            const endpoint = isPreSubmit 
                ? `${API_URL}/api/pre-submissions` 
                : `${API_URL}/api/confirmations`;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                },
                body: formData,
            });

            const resData = await response.json();

            if (!response.ok) {
                throw new Error(resData.message || 'Submission failed');
            }

            navigation.navigate('SuccessScreen' as any, { 
                message: isPreSubmit ? 'Pre-submission recorded!' : 'Trade confirmation submitted!' 
            });

        } catch (error: any) {
            showToast(error.message || 'Check your connection and try again.');
        } finally {
            setLoading(false);
        }
    };

    const selectedService = services.find(s => s._id === selectedServiceId);
    const serviceSupportsWithdrawal = selectedService?.supportsWithdrawal || selectedService?.name?.toLowerCase().includes('withdraw');

  return (
    <View style={{ flex: 1, backgroundColor: runtimeTheme.colors?.background || '#F8F9FC' }}>
      <ScreenHeader title="Confirm Trade" backgroundColor={runtimeTheme.colors?.background || '#F8F9FC'} />
            <ScrollView 
                contentContainerStyle={styles.container} 
                keyboardShouldPersistTaps="handled"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchServices} />}
            >
                {/* 1. Service Selection */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Service Provider</Text>
                    <TouchableOpacity onPress={() => setShowServiceModal(true)} style={styles.serviceSelectorRow}>
                        <View style={styles.iconBox}><Text style={{ fontSize: 18 }}>💎</Text></View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.selectionTitle}>{selectedServiceLabel || 'Choose a service'}</Text>
                            <Text style={styles.selectionSub}>{selectedServiceLabel ? 'Tap to change' : 'Required'}</Text>
                        </View>
                        <Text style={styles.changeLink}>Change</Text>
                    </TouchableOpacity>
                </View>

                {/* 2. Amount Input */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Transaction Amount</Text>
                    <View style={styles.amountInputRow}>
                        <Text style={styles.currencySymbol}>{currency === 'USD' ? '$' : currency}</Text>
            <TextInput
              value={amount}
              onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
              placeholder="0.00"
              placeholderTextColor={runtimeTheme.colors?.muted || '#94A3B8'}
              keyboardType="numeric"
              style={styles.amountInput}
            />
                    </View>
                    <View style={styles.currencyRow}>
                        {['USD', 'EUR', 'GBP'].map((c) => (
                            <TouchableOpacity key={c} onPress={() => setCurrency(c)} style={[styles.pill, currency === c && styles.pillActive]}>
                                <Text style={[styles.pillText, currency === c && styles.pillTextActive]}>{c}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* 3. Transaction ID (Read Only display) */}
                {transactionId ? (
                    <View style={[styles.inputGroup, { backgroundColor: '#F1F5F9', borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5E1' }]}>
                        <Text style={styles.label}>Transaction ID</Text>
                        <Text style={{ fontWeight: '700', color: '#475569' }}>{transactionId}</Text>
                    </View>
                ) : null}

                {/* 4. Note Input */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Additional Note</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Add details about this trade..."
            placeholderTextColor={runtimeTheme.colors?.muted || '#94A3B8'}
            multiline
            numberOfLines={3}
            style={[styles.textInput, { textAlignVertical: 'top', minHeight: 80 }]}
          />
                </View>

                {/* 5. Pre-Submit Options */}
                {selectedService && serviceSupportsWithdrawal && (
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Confirmation Type</Text>
                        <View style={styles.segmentedControl}>
                            <TouchableOpacity onPress={() => setIsPreSubmit(false)} style={[styles.segmentBtn, !isPreSubmit && styles.segmentBtnActive]}>
                                <Text style={[styles.segmentText, !isPreSubmit && styles.segmentTextActive]}>Immediate</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setIsPreSubmit(true)} style={[styles.segmentBtn, isPreSubmit && styles.segmentBtnActive]}>
                                <Text style={[styles.segmentText, isPreSubmit && styles.segmentTextActive]}>Pre-submit</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {isPreSubmit && (
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Account Username</Text>
                        <TextInput value={username} onChangeText={setUsername} placeholder="@username" style={styles.textInput} />
                        <Text style={[styles.label, { marginTop: 20 }]}>Hold Duration (Days)</Text>
                        <View style={styles.holdDaysRow}>
                            {[1, 2, 3, 4, 5].map((d) => (
                                <TouchableOpacity key={d} onPress={() => setHoldDays(d)} style={[styles.dayCircle, holdDays === d && styles.dayCircleActive]}>
                                    <Text style={[styles.dayText, holdDays === d && styles.dayTextActive]}>{d}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* 6. File Upload */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Evidence & Documents</Text>
                    <TouchableOpacity style={styles.uploadArea} onPress={pickFile}>
                        <Text style={styles.uploadText}>+ Upload Documents</Text>
                        <Text style={{ fontSize: 12, color: runtimeTheme.colors?.muted || '#94A3B8' }}>Tap to select files</Text>
                    </TouchableOpacity>

                    {files.map((f, i) => (
                        <View key={i} style={styles.fileRow}>
                            <Image source={{ uri: f.uri }} style={styles.filePreview} />
                            <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
              <TouchableOpacity onPress={() => setFiles(files.filter((_, idx) => idx !== i))}>
                <Text style={{ color: runtimeTheme.colors?.danger || runtimeTheme.colors?.error || '#EF4444', fontWeight: 'bold' }}>Remove</Text>
              </TouchableOpacity>
                        </View>
                    ))}
                </View>

        <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.7 }]} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color={runtimeTheme.colors?.onPrimary || '#FFF'} /> : <Text style={styles.submitBtnText}>Confirm Transaction</Text>}
        </TouchableOpacity>
            </ScrollView>

            <ServicePickerModal
                visible={showServiceModal}
                onClose={() => setShowServiceModal(false)}
                onSelect={(s: Service) => {
                    setSelectedServiceId(s._id);
                    setSelectedServiceLabel(s.label || s.name);
                    setShowServiceModal(false);
                }}
                selectedId={selectedServiceId}
            />
        </View>
    );
};

const createStyles = (t: any) => {
  const isDark = t.dark || t.mode === 'dark'; // Check your theme structure for this flag

  return StyleSheet.create({
    container: { padding: 20, paddingBottom: 60 },
    inputGroup: {
      backgroundColor: t.colors.surface || (isDark ? '#1E293B' : '#FFF'),
      borderRadius: 20,
      padding: 20,
      marginBottom: 20,
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.3 : 0.05,
      shadowRadius: 10,
    },
    label: { 
      fontSize: 11, 
      fontWeight: '800', 
      color: t.colors.muted || '#64748B', 
      textTransform: 'uppercase', 
      letterSpacing: 1, 
      marginBottom: 12 
    },
    serviceSelectorRow: { flexDirection: 'row', alignItems: 'center' },
    iconBox: { 
      width: 48, 
      height: 48, 
      backgroundColor: isDark ? '#334155' : '#F1F5F9', 
      borderRadius: 14, 
      alignItems: 'center', 
      justifyContent: 'center' 
    },
    selectionTitle: { 
      fontSize: 16, 
      fontWeight: '700', 
      color: t.colors.text || '#1E293B' 
    },
    selectionSub: { 
      fontSize: 13, 
      color: t.colors.muted || '#94A3B8' 
    },
    changeLink: { 
      fontSize: 14, 
      fontWeight: '600', 
      color: t.colors.primary 
    },
    amountInputRow: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      borderBottomWidth: 1, 
      borderBottomColor: isDark ? '#334155' : '#F1F5F9',
      paddingBottom: 5
    },
    currencySymbol: { 
      fontSize: 24, 
      fontWeight: '700', 
      color: t.colors.text || '#1E293B', 
      marginRight: 10 
    },
    amountInput: { 
      flex: 1, 
      fontSize: 32, 
      fontWeight: '700', 
      color: t.colors.text || '#1E293B' 
    },
    currencyRow: { flexDirection: 'row', marginTop: 15 },
    pill: { 
      paddingVertical: 8, 
      paddingHorizontal: 16, 
      borderRadius: 12, 
      backgroundColor: isDark ? '#334155' : '#F8F9FC', 
      marginRight: 10 
    },
    pillActive: { 
      backgroundColor: isDark ? `${t.colors.primary}30` : '#EEF2FF', 
      borderWidth: 1, 
      borderColor: t.colors.primary 
    },
    pillText: { 
      fontWeight: '600', 
      color: t.colors.muted || '#64748B' 
    },
    pillTextActive: { 
      color: t.colors.primary 
    },
    segmentedControl: { 
      flexDirection: 'row', 
      backgroundColor: isDark ? '#0F172A' : '#F1F5F9', 
      borderRadius: 12, 
      padding: 4 
    },
    segmentBtn: { 
      flex: 1, 
      paddingVertical: 10, 
      alignItems: 'center', 
      borderRadius: 10 
    },
    segmentBtnActive: { 
      backgroundColor: isDark ? '#334155' : '#FFF',
      elevation: 2 
    },
    segmentText: { 
      fontWeight: '600', 
      color: t.colors.muted || '#64748B' 
    },
    segmentTextActive: { 
      color: '#1E293B', 
    },
    textInput: { 
      fontSize: 16, 
      paddingVertical: 12, 
      borderBottomWidth: 1, 
      borderBottomColor: isDark ? '#334155' : '#F1F5F9', 
      color: t.colors.text || '#1E293B' 
    },
    holdDaysRow: { flexDirection: 'row', justifyContent: 'space-between' },
    dayCircle: { 
      width: 45, 
      height: 45, 
      borderRadius: 23, 
      backgroundColor: isDark ? '#334155' : '#F8F9FC', 
      alignItems: 'center', 
      justifyContent: 'center' 
    },
    dayCircleActive: { 
      backgroundColor: t.colors.primary 
    },
    dayText: { 
      fontWeight: '700', 
      color: t.colors.muted || '#64748B' 
    },
    dayTextActive: { 
      color: '#FFF' 
    },
    uploadArea: { 
      borderStyle: 'dashed', 
      borderWidth: 2, 
      borderColor: isDark ? '#475569' : '#CBD5E1', 
      borderRadius: 16, 
      padding: 25, 
      alignItems: 'center' 
    },
    uploadText: { 
      fontWeight: '700', 
      color: t.colors.primary, 
      marginBottom: 5 
    },
    fileRow: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      marginTop: 12, 
      backgroundColor: isDark ? '#0F172A' : '#F8F9FC', 
      padding: 10, 
      borderRadius: 12 
    },
    filePreview: { 
      width: 40, 
      height: 40, 
      borderRadius: 8, 
      marginRight: 10 
    },
    fileName: { 
      flex: 1, 
      fontSize: 13, 
      color: t.colors.text || '#475569' 
    },
    submitBtn: { 
      backgroundColor: t.colors.primary, 
      paddingVertical: 18, 
      borderRadius: 18, 
      alignItems: 'center' 
    },
    submitBtnText: { 
      color: '#FFF', 
      fontSize: 16, 
      fontWeight: '700' 
    }
  });
};

export default TradeConfirmationScreen;