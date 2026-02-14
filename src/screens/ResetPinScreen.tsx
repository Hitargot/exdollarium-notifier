import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';

// Project Imports
import authStorage from '../utils/authStorage';
import appTheme from '../styles/theme';
import { useTheme } from '../theme/index';
import UIButton from '../components/UIButton';
import { RootStackParamList } from './types';

const API_URL = Constants.expoConfig?.extra?.apiUrl;

type ResetPinScreenRouteProp = RouteProp<RootStackParamList, 'ResetPinScreen'>;

export default function ResetPinScreen() {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [statusMessage, setStatusMessage] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
    const [errorText, setErrorText] = useState('');
    
    const navigation = useNavigation<any>();
    const route = useRoute<ResetPinScreenRouteProp>();
    const { bank } = route.params;
    const { colors: tColors } = useTheme() || { colors: appTheme.colors };
    const styles = useMemo(() => createStyles(tColors), [tColors]);

    useEffect(() => {
        const fetchEmail = async () => {
            setLoading(true);
            try {
                const token = await authStorage.getToken();
                if (!token) throw new Error('No session found');
                
                const res = await axios.get(`${API_URL}/api/user/profile`, { 
                    headers: { Authorization: `Bearer ${token}` } 
                });
                setEmail(res.data?.email || '');
            } catch (e) {
                setErrorText('Unable to verify account details.');
            } finally {
                setLoading(false);
            }
        };
        fetchEmail();
    }, []);

    const handleSendOtp = async () => {
        setErrorText('');
        if (!email) return;

        setStatusMessage('sending');
        try {
            const token = await authStorage.getToken();
            await axios.post(`${API_URL}/api/user/send-otp-for-pin-reset`, { email }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStatusMessage('sent');
            // Pass bank details along to the next screen
            navigation.navigate('VerifyPinOtpScreen', { bank, email });
        } catch (e: any) {
            setErrorText(e?.response?.data?.message || 'Failed to send OTP. Please try again.');
            setStatusMessage('error');
        }
    };

    const canProceed = email && !loading;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                {/* Security Header */}
                <View style={styles.header}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="shield-outline" size={40} color={tColors.primary} />
                    </View>
                    <Text style={styles.title}>Reset Transaction PIN</Text>
                    <Text style={styles.subtitle}>
                        For your security, we need to verify your identity before you can change your PIN.
                    </Text>
                </View>

                {/* Info Card */}
                <View style={styles.card}>
                    <Text style={styles.cardLabel}>Verification Email</Text>
                    <View style={styles.emailRow}>
                        <Ionicons name="mail-outline" size={18} color={tColors.muted} style={{ marginRight: 8 }} />
                        {loading ? (
                            <ActivityIndicator size="small" color={tColors.primary} />
                        ) : (
                            <Text style={styles.email}>{email || 'Not Available'}</Text>
                        )}
                    </View>
                    <Text style={styles.hint}>
                        We will send a 6-digit verification code to the email address above.
                    </Text>
                </View>

                {statusMessage === 'error' && (
                    <View style={styles.errorBox}>
                        <Ionicons name="alert-circle" size={16} color="#ef4444" />
                        <Text style={styles.errorText}>{errorText}</Text>
                    </View>
                )}

                {/* Actions */}
                <UIButton 
                    title={statusMessage === 'sending' ? "" : "Send Verification Code"}
                    onPress={handleSendOtp}
                    disabled={!email || statusMessage === 'sending'}
                    style={styles.mainButton}
                >
                    {statusMessage === 'sending' && <ActivityIndicator color="#fff" />}
                </UIButton>

                <TouchableOpacity 
                    onPress={() => navigation.goBack()} 
                    style={styles.backButton}
                    disabled={statusMessage === 'sending'}
                >
                    <Text style={styles.backButtonText}>Cancel and Go Back</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const createStyles = (t: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: t.background },
    content: { flex: 1, padding: 24, justifyContent: 'center' },
    header: { alignItems: 'center', marginBottom: 40 },
    iconCircle: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: t.primary + '10', // 10% opacity
        justifyContent: 'center', alignItems: 'center', marginBottom: 20
    },
    title: { fontSize: 24, fontWeight: '800', color: t.text, marginBottom: 12 },
    subtitle: { fontSize: 15, color: t.muted, textAlign: 'center', lineHeight: 22, paddingHorizontal: 10 },
    card: { 
        backgroundColor: t.surface, padding: 20, borderRadius: 20, 
        borderWidth: 1, borderColor: t.border, marginBottom: 24,
        shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 10, elevation: 2
    },
    cardLabel: { color: t.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
    emailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    email: { color: t.text, fontWeight: '700', fontSize: 17 },
    hint: { fontSize: 13, color: t.muted, lineHeight: 18, borderTopWidth: 1, borderTopColor: t.border, paddingTop: 12 },
    mainButton: { height: 56, borderRadius: 16 },
    errorBox: { 
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', 
        backgroundColor: '#fee2e2', padding: 10, borderRadius: 8, marginBottom: 20 
    },
    errorText: { color: '#ef4444', fontSize: 13, fontWeight: '600', marginLeft: 6 },
    backButton: { marginTop: 20, padding: 10, alignItems: 'center' },
    backButtonText: { color: t.muted, fontWeight: '600', fontSize: 15 },
});