import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    View, Text, TextInput, TouchableOpacity, StyleSheet, 
    ActivityIndicator, Modal, KeyboardAvoidingView, Platform, ScrollView 
} from 'react-native';
import { useNavigation, StackActions, useFocusEffect } from '@react-navigation/native';
import { BackHandler } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import appTheme from '../styles/theme';
import { useTheme } from '../theme/index';
import ScreenHeader from '../components/ScreenHeader';
import PinPad from '../components/PinPad';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import axios from 'axios';
import authStorage from '../utils/authStorage';
import Constants from 'expo-constants';
import { showToast } from '../utils/toast';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'https://exdollarium-6f0f5aab6a7d.herokuapp.com';
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SendExdollarium'>;

const SendExdollarium: React.FC = () => {
    const navigation = useNavigation<NavigationProp>();
    const themeCtx = (() => { try { return useTheme(); } catch (e) { return undefined as any; } })();
    const t = themeCtx || appTheme;
    const styles = useMemo(() => createStyles(t), [t]);

    // State
    const [recipient, setRecipient] = useState('');
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [pin, setPin] = useState('');
    const [step, setStep] = useState<'recipient' | 'details' | 'confirm' | 'pin'>('recipient');
    const [sending, setSending] = useState(false);
    const [recipientInfo, setRecipientInfo] = useState<{ displayName?: string; username?: string } | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [hasTyped, setHasTyped] = useState(false);
    const [backSteps, setBackSteps] = useState<number | null>(null);

    const verifyPayId = useCallback(async (payId: string) => {
        if (!payId) { setRecipientInfo(null); return; }
        setIsVerifying(true);
        try {
            const token = await authStorage.getToken();
            const res = await axios.get(`${API_URL}/api/users/verify/${encodeURIComponent(payId)}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const user = res.data?.user || null;
            setRecipientInfo(user ? { displayName: user.displayName || user.username, username: user.username } : null);
        } catch (err) { setRecipientInfo(null); } finally { setIsVerifying(false); }
    }, []);

    useEffect(() => {
        if (!recipient) { setRecipientInfo(null); setHasTyped(false); return; }
        setHasTyped(true);
        const tIdx = setTimeout(() => verifyPayId(recipient), 500);
        return () => clearTimeout(tIdx);
    }, [recipient, verifyPayId]);

    // Determine how many steps to pop to reach the last meaningful screen
    useEffect(() => {
        try {
            const state = navigation.getState();
            const routes = state.routes || [];
            const idx = routes.findIndex(r => r.name === 'SendExdollarium');
            if (idx > 0) {
                // find the previous route that isn't the Withdrawal screen
                let targetIndex = -1;
                for (let i = idx - 1; i >= 0; i--) {
                    if (routes[i].name !== 'Withdrawal') { targetIndex = i; break; }
                }
                if (targetIndex !== -1) setBackSteps(idx - targetIndex);
                else setBackSteps(1);
            }
        } catch (e) { /* ignore */ }
    }, [navigation]);

    // Intercept system back (gesture / header / hardware) to step back within the flow
    useEffect(() => {
        const beforeRemove = (e: any) => {
            if (step !== 'recipient') {
                e.preventDefault();
                setStep(prev => (prev === 'pin' ? 'confirm' : prev === 'confirm' ? 'details' : 'recipient'));
            }
            // otherwise allow default behavior
        };

        const unsub = navigation.addListener('beforeRemove', beforeRemove as any);

        return () => { unsub(); };
    }, [navigation, step]);

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                if (step !== 'recipient') {
                    setStep(prev => (prev === 'pin' ? 'confirm' : prev === 'confirm' ? 'details' : 'recipient'));
                    return true; // handled
                }
                return false; // let default behavior run
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [step])
    );

    const handleBack = () => {
        if (step !== 'recipient') {
            // step navigation: go to previous logical step
            return setStep(step === 'pin' ? 'confirm' : step === 'confirm' ? 'details' : 'recipient');
        }

        if (navigation.canGoBack()) {
            if (backSteps && backSteps > 1) {
                // pop multiple screens to skip intermediary (e.g., Withdrawal)
                navigation.dispatch(StackActions.pop(backSteps));
            } else {
                navigation.goBack();
            }
        } else {
            // fallback: go to dashboard
            navigation.navigate('Dashboard');
        }
    };

    const handleConfirmSend = async () => {
        if (pin.length < 4) return;
        setSending(true);
        try {
            const token = await authStorage.getToken();
            const response = await axios.post(`${API_URL}/api/wallet/transfer`, {
                recipientPayId: recipient,
                amount: Number(amount),
                transferPin: pin,
                note,
                channel: 'user-user',
            }, { headers: { Authorization: `Bearer ${token}` } });

            const txn = response.data;
            const receiptData = {
                fields: [
                    { label: 'Type', value: 'Sent Transfer' },
                    { label: 'Amount', value: `₦${Number(amount).toLocaleString()}` },
                    { label: 'Transaction ID', value: txn._id || 'N/A', copyable: true },
                    { label: 'Date', value: new Date().toLocaleString() },
                    { label: 'Status', value: txn.status || 'completed' },
                    { label: 'Sent To', value: recipient },
                ],
            };

            navigation.navigate('SendSuccess' as any, { receiptData, status: 'completed' });
        } catch (error: any) {
            showToast(error?.response?.data?.message || 'Transfer failed');
            setPin(''); // Reset PIN on failure
        } finally {
            setSending(false);
        }
    };

    const renderStepIndicator = () => (
        <View style={styles.stepIndicatorContainer}>
            {['recipient', 'details', 'confirm'].map((s, i) => (
                <React.Fragment key={s}>
                    <View style={[styles.stepDot, (step === s || (step === 'pin' && s === 'confirm')) && styles.stepDotActive]} />
                    {i < 2 && <View style={[styles.stepLine, (step === 'details' || step === 'confirm' || step === 'pin') && i === 0 && styles.stepLineActive, (step === 'confirm' || step === 'pin') && i === 1 && styles.stepLineActive]} />}
                </React.Fragment>
            ))}
        </View>
    );

    return (
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.colors?.background || '#F8F9FC' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScreenHeader title="Send Money" onBack={handleBack} />
            
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                {renderStepIndicator()}

                {step === 'recipient' && (
                    <View style={styles.card}>
                        <Text style={styles.label}>Recipient Address</Text>
                        <View style={styles.inputWrapper}>
                            <Text style={styles.atSymbol}>@</Text>
                            <TextInput
                                style={styles.minimalInput}
                                placeholder="pay ID"
                                placeholderTextColor={t.colors?.muted || '#94A3B8'}
                                value={recipient}
                                onChangeText={setRecipient}
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={{ height: 80, justifyContent: 'center' }}>
                            {isVerifying ? (
                                <ActivityIndicator color={t.colors?.primary || '#0B5FFF'} />
                            ) : recipientInfo ? (
                                <View style={styles.userFoundCard}>
                                    <Ionicons name="checkmark-circle" size={20} color={t.colors?.success || '#10B981'} />
                                    <Text style={styles.userFoundText}>{recipientInfo.displayName}</Text>
                                </View>
                            ) : (recipient && hasTyped) ? (
                                <Text style={styles.errorText}>User not found</Text>
                            ) : null}
                        </View>

                        <TouchableOpacity 
                            style={[styles.mainButton, (!recipientInfo || isVerifying) && styles.disabledButton]} 
                            onPress={() => setStep('details')}
                            disabled={!recipientInfo || isVerifying}
                        >
                            <Text style={styles.mainButtonText}>Continue</Text>
                            <Ionicons name="arrow-forward" size={18} color={t.colors?.white || '#FFF'} />
                        </TouchableOpacity>
                    </View>
                )}

                {step === 'details' && (
                    <View style={styles.card}>
                        <View style={styles.recipientSummary}>
                            <View style={styles.avatarCircle}>
                                <Text style={styles.avatarText}>{(recipientInfo?.displayName || 'U').charAt(0).toUpperCase()}</Text>
                            </View>
                            <View>
                                <Text style={styles.summaryName}>{recipientInfo?.displayName}</Text>
                                <Text style={styles.summaryPayId}>@{recipient}</Text>
                            </View>
                        </View>

                        <Text style={styles.label}>Enter Amount</Text>
                        <View style={styles.amountContainer}>
                            <Text style={styles.currencyPrefix}>₦</Text>
                            <TextInput
                                style={styles.amountInput}
                                placeholder="0.00"
                                value={amount}
                                onChangeText={(val) => setAmount(val.replace(/[^0-9.]/g, ''))}
                                keyboardType="numeric"
                                autoFocus
                            />
                        </View>

                        <View style={styles.presetsRow}>
                            {[5000, 10000, 20000, 50000].map((val) => (
                                <TouchableOpacity key={val} style={styles.presetBtn} onPress={() => setAmount(String(val))}>
                                    <Text style={styles.presetText}>₦{(val/1000)}k</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.label}>Note (Optional)</Text>
                        <TextInput
                            style={styles.noteInput}
                            placeholder="What's this for?"
                            placeholderTextColor={t.colors?.muted || '#94A3B8'}
                            value={note}
                            onChangeText={setNote}
                            multiline
                        />

                        <TouchableOpacity style={styles.mainButton} onPress={() => setStep('confirm')}>
                            <Text style={styles.mainButtonText}>Review Transfer</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* CONFIRM STEP */}
                {step === 'confirm' && (
                    <View style={styles.card}>
                        <Text style={styles.sheetTitle}>Review Details</Text>
                        <View style={styles.confirmBox}>
                            <Text style={styles.confirmLabel}>Sending</Text>
                            <Text style={styles.confirmAmount}>₦{Number(amount).toLocaleString()}</Text>
                            <View style={styles.confirmDivider} />
                            <Text style={styles.confirmLabel}>To</Text>
                            <Text style={styles.summaryName}>{recipientInfo?.displayName}</Text>
                            <Text style={styles.summaryPayId}>@{recipient}</Text>
                        </View>
                        
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Transaction Fee</Text>
                            <Text style={[styles.infoValue, { color: '#10B981' }]}>Free</Text>
                        </View>

                        <TouchableOpacity style={[styles.mainButton, { marginTop: 20 }]} onPress={() => setStep('pin')}>
                            <Text style={styles.mainButtonText}>Confirm & Pay</Text>
                            <MaterialCommunityIcons name="shield-check" size={20} color={t.colors?.white || '#FFF'} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* PIN STEP */}
                {step === 'pin' && (
                    <View style={[styles.card, { alignItems: 'center' }]}>
                        <Text style={styles.sheetTitle}>Authorize Transfer</Text>
                        <Text style={[styles.infoLabel, { marginBottom: 30 }]}>Enter your 4-digit security PIN</Text>
                        
                        <View style={styles.pinDotsRow}>
                            {[0, 1, 2, 3].map(i => (
                                <View key={i} style={[styles.pinDot, pin.length > i && styles.pinDotActive]} />
                            ))}
                        </View>

                        <PinPad value={pin} onChange={setPin} maxLength={4} />

                        <TouchableOpacity 
                            style={[styles.mainButton, (pin.length < 4 || sending) && styles.disabledButton, { width: '100%', marginTop: 20 }]} 
                            onPress={handleConfirmSend}
                            disabled={pin.length < 4 || sending}
                        >
                            {sending ? <ActivityIndicator color={t.colors?.white || '#FFF'} /> : <Text style={styles.mainButtonText}>Finish Payment</Text>}
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const createStyles = (t: any) => StyleSheet.create({
    container: { padding: 20, paddingBottom: 40 },
    stepIndicatorContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 30 },
    stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors?.muted || '#CBD5E1' },
    stepDotActive: { backgroundColor: t.colors.primary, width: 12, height: 12 },
    stepLine: { width: 40, height: 2, backgroundColor: t.colors?.muted || '#CBD5E1', marginHorizontal: 8 },
    stepLineActive: { backgroundColor: t.colors.primary },
    card: { 
        backgroundColor: t.colors?.surface || '#FFF', 
        borderRadius: 24, 
        padding: 24, 
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 15 },
            android: { elevation: 3 }
        }),
        borderWidth: 1,
        borderColor: t.colors?.border || '#F1F5F9'
    },
    label: { fontSize: 12, fontWeight: '800', color: t.colors?.muted || '#64748B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: t.colors?.border || '#F1F5F9', marginBottom: 10 },
    atSymbol: { fontSize: 24, fontWeight: '700', color: t.colors.primary, marginRight: 8 },
    minimalInput: { flex: 1, height: 60, fontSize: 20, fontWeight: '700', color: t.colors?.text || '#1E293B' },
    userFoundCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.colors?.successContainer || '#F0FDF4', padding: 15, borderRadius: 12 },
    userFoundText: { marginLeft: 10, color: t.colors?.success || '#166534', fontWeight: '700', fontSize: 15 },
    errorText: { color: t.colors?.error || '#EF4444', fontSize: 14, fontWeight: '600', textAlign: 'center' },
    mainButton: { backgroundColor: t.colors.primary, height: 60, borderRadius: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    mainButtonText: { color: t.colors?.white || '#FFF', fontWeight: '800', fontSize: 16, marginRight: 10 },
    disabledButton: { opacity: 0.5 },
    recipientSummary: { flexDirection: 'row', alignItems: 'center', marginBottom: 30, backgroundColor: t.colors?.surfaceVariant || '#F8F9FC', padding: 15, borderRadius: 18 },
    avatarCircle: { width: 50, height: 50, borderRadius: 16, backgroundColor: t.colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    avatarText: { color: t.colors?.white || '#FFF', fontSize: 20, fontWeight: '800' },
    summaryName: { fontSize: 18, fontWeight: '800', color: t.colors?.text || '#1E293B' },
    summaryPayId: { color: t.colors?.muted || '#64748B', fontSize: 14, fontWeight: '500' },
    amountContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    currencyPrefix: { fontSize: 32, fontWeight: '800', color: t.colors.primary, marginRight: 5 },
    amountInput: { fontSize: 48, fontWeight: '800', color: t.colors.primary, minWidth: 100, textAlign: 'center' },
    presetsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
    presetBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: t.colors?.surfaceVariant || '#F1F5F9' },
    presetText: { fontWeight: '700', color: t.colors?.text || '#475569', fontSize: 13 },
    noteInput: { backgroundColor: t.colors?.surfaceVariant || '#F8F9FC', borderRadius: 16, padding: 15, height: 100, textAlignVertical: 'top', marginBottom: 30, fontSize: 16, color: t.colors?.text || '#1E293B' },
    sheetTitle: { fontSize: 22, fontWeight: '800', color: t.colors?.text || '#1E293B', textAlign: 'center', marginBottom: 20 },
    confirmBox: { alignItems: 'center', marginVertical: 20, width: '100%' },
    confirmLabel: { fontSize: 12, color: t.colors?.muted || '#94A3B8', fontWeight: '700', textTransform: 'uppercase', marginBottom: 5 },
    confirmAmount: { fontSize: 40, fontWeight: '900', color: t.colors.primary, marginBottom: 15 },
    confirmDivider: { width: '40%', height: 1, backgroundColor: t.colors?.border || '#F1F5F9', marginVertical: 20 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, borderTopWidth: 1, borderTopColor: t.colors?.border || '#F1F5F9', marginTop: 10, width: '100%' },
    infoLabel: { color: t.colors?.muted || '#64748B', fontWeight: '600' },
    infoValue: { fontWeight: '800', color: t.colors?.text || '#1E293B' },
    pinDotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 40 },
    pinDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: t.colors?.border || '#CBD5E1' },
    pinDotActive: { backgroundColor: t.colors.primary, borderColor: t.colors.primary, transform: [{ scale: 1.2 }] }
});

export default SendExdollarium;