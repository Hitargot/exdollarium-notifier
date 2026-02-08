import React, { useState, useMemo } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet, 
    ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';

// Project Imports
import { showToast } from '../utils/toast';
import { useTheme } from '../theme/index';
import appTheme from '../styles/theme';
import UIButton from '../components/UIButton';

const API_URL = Constants.expoConfig?.extra?.apiUrl;

const ResetOtpScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const email = route.params?.email;

    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const { colors: tColors } = useTheme() || { colors: appTheme.colors };
    const styles = useMemo(() => createStyles(tColors), [tColors]);

    const passwordStrength = useMemo(() => {
        if (!newPassword) return null;
        let score = 0;
        if (newPassword.length >= 8) score++;
        if (/[A-Z]/.test(newPassword)) score++;
        if (/[0-9]/.test(newPassword)) score++;
        if (/[^A-Za-z0-9]/.test(newPassword)) score++;
        return score;
    }, [newPassword]);

    const handleReset = async () => {
        if (!otp || !newPassword || !confirm) return showToast('All fields required');
        if (newPassword !== confirm) return showToast('Passwords do not match');
        if (!email) return showToast('Session expired. Please try again.');

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/auth/reset-password-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, otp, newPassword })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Reset failed');

            showToast('Password updated! Please log in.');
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        } catch (err: any) {
            showToast(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="lock-open-outline" size={32} color={tColors.primary} />
                    </View>
                    <Text style={styles.title}>Create New Password</Text>
                    <Text style={styles.subtitle}>Enter the code sent to {email} and choose a strong password.</Text>
                </View>

                <View style={styles.card}>
                    {/* OTP Input */}
                    <Text style={styles.label}>Reset Code</Text>
                    <View style={styles.inputWrapper}>
                        <Ionicons name="keypad-outline" size={20} color={tColors.muted} style={styles.inputIcon} />
                        <TextInput
                            placeholder="6-digit code"
                            placeholderTextColor={tColors.muted}
                            keyboardType="number-pad"
                            style={styles.input}
                            value={otp}
                            onChangeText={setOtp}
                            maxLength={6}
                        />
                    </View>

                    {/* New Password */}
                    <Text style={styles.label}>New Password</Text>
                    <View style={styles.inputWrapper}>
                        <Ionicons name="lock-closed-outline" size={20} color={tColors.muted} style={styles.inputIcon} />
                        <TextInput
                            placeholder="Min. 8 characters"
                            placeholderTextColor={tColors.muted}
                            secureTextEntry={!showPassword}
                            style={styles.input}
                            value={newPassword}
                            onChangeText={setNewPassword}
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={tColors.muted} />
                        </TouchableOpacity>
                    </View>

                    {/* Strength Indicator */}
                    {passwordStrength !== null && (
                        <View style={styles.strengthContainer}>
                            <View style={styles.strengthBarBg}>
                                <View style={[
                                    styles.strengthBarActive, 
                                    { 
                                        width: `${(passwordStrength / 4) * 100}%`,
                                        backgroundColor: passwordStrength <= 1 ? '#ff4d4d' : passwordStrength === 2 ? '#ffad33' : '#00cc66'
                                    }
                                ]} />
                            </View>
                            <Text style={styles.strengthText}>
                                {passwordStrength <= 1 ? 'Weak' : passwordStrength === 2 ? 'Fair' : 'Strong'}
                            </Text>
                        </View>
                    )}

                    {/* Confirm Password */}
                    <Text style={styles.label}>Confirm Password</Text>
                    <View style={styles.inputWrapper}>
                        <Ionicons name="shield-checkmark-outline" size={20} color={tColors.muted} style={styles.inputIcon} />
                        <TextInput
                            placeholder="Repeat password"
                            placeholderTextColor={tColors.muted}
                            secureTextEntry={!showPassword}
                            style={styles.input}
                            value={confirm}
                            onChangeText={setConfirm}
                        />
                    </View>

                    <UIButton 
                        title={loading ? "" : "Update Password"} 
                        onPress={handleReset} 
                        disabled={loading}
                        style={styles.submitBtn}
                    >
                        {loading && <ActivityIndicator color="#fff" />}
                    </UIButton>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const createStyles = (t: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: t.background },
    scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
    header: { alignItems: 'center', marginBottom: 30 },
    iconCircle: { 
        width: 70, height: 70, borderRadius: 35, 
        backgroundColor: t.primary + '15', justifyContent: 'center', alignItems: 'center', marginBottom: 15 
    },
    title: { fontSize: 24, fontWeight: '800', color: t.text },
    subtitle: { color: t.muted, textAlign: 'center', marginTop: 8, lineHeight: 20 },
    card: { 
        backgroundColor: t.surface, padding: 24, borderRadius: 24, 
        shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 15, elevation: 3 
    },
    label: { fontSize: 13, fontWeight: '700', color: t.text, marginBottom: 8, marginLeft: 4 },
    inputWrapper: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: t.background,
        borderRadius: 12, borderWidth: 1, borderColor: t.border, paddingHorizontal: 12,
        marginBottom: 16
    },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, paddingVertical: 14, color: t.text, fontSize: 16 },
    strengthContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 },
    strengthBarBg: { flex: 1, height: 4, backgroundColor: '#eee', borderRadius: 2, marginRight: 10 },
    strengthBarActive: { height: '100%', borderRadius: 2 },
    strengthText: { fontSize: 11, fontWeight: '700', color: t.muted, width: 40, textAlign: 'right' },
    submitBtn: { marginTop: 10, borderRadius: 12, height: 56 }
});

export default ResetOtpScreen;