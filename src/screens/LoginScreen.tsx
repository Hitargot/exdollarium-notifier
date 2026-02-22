import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Switch,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

// Icons & Theme
import { Ionicons } from '@expo/vector-icons'; // Assuming Expo usage based on your imports
import { useTheme } from '../theme/index';
import appTheme from '../styles/theme';
import common from '../styles/common';

// Logic & Utils
import { loginUser } from '../api/auth';
import { showInAppConfirm } from '../contexts/ConfirmContext';
import authStorage from '../utils/authStorage';
import { 
    getRememberedIdentifier, 
    setRememberedIdentifier, 
    removeRememberedIdentifier 
} from '../utils/rememberedIdentifier';
import showToast from '../utils/toast';
import { RootStackParamList } from './types';

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

const LoginScreen = () => {
    const navigation = useNavigation<LoginScreenNavigationProp>();
    
    // Form State
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [shouldRemember, setShouldRemember] = useState(true);

    // Theme integration
    const themeCtx = (() => { try { return useTheme(); } catch (e) { return undefined; } })();
    const theme = themeCtx || appTheme;
    const styles = useMemo(() => createStyles(theme), [theme]);

    useEffect(() => {
        (async () => {
            const remembered = await getRememberedIdentifier();
            if (remembered) {
                setIdentifier(remembered);
                setShouldRemember(true);
            }
        })();
    }, []);

    const navigateToDashboard = useCallback(() => {
        navigation.reset({ index: 0, routes: [{ name: 'Dashboard' as any }] });
    }, [navigation]);

    const handlePostLoginLogic = async (token: string, fcmToken?: string) => {
        // 1. Persist Session
        await authStorage.setToken(token);

        // 2. Background Tasks (Push Notification)
        try {
            const pushManager = await import('../utils/pushTokenManager');
            await pushManager.savePushToken(token, fcmToken || null);
        } catch (e) { /* silent fail */ }

        // 3. Remember Me Logic
        if (shouldRemember) {
            await setRememberedIdentifier(identifier.trim());
        } else {
            await removeRememberedIdentifier();
        }

        // 4. Security Flow (Passcode)
        const authLock = await import('../utils/authLock');
        await authLock.setLastLogin();
        await authLock.setLastAuth();

        const resetRequested = await AsyncStorage.getItem('passcodeResetRequested');
        if (resetRequested) {
            await authLock.clearPasscode();
            await AsyncStorage.removeItem('passcodeResetRequested');
            navigation.navigate('SetPasscode' as any);
            return;
        }

        const existingPasscode = await authLock.getPasscodeHash();
        if (!existingPasscode) {
            const wantsPasscode = await showInAppConfirm({
                title: 'Secure Your Account',
                message: 'Would you like to set a passcode for quicker access?',
                confirmText: 'Set Passcode',
                cancelText: 'Skip'
            });
            if (wantsPasscode) {
                navigation.navigate('SetPasscode' as any);
                return;
            }
        }
        
        navigateToDashboard();
    };

    const onLoginPress = async () => {
        if (!identifier || !password) {
            showToast('Please enter your credentials');
            return;
        }

        setLoading(true);
        try {
            const result = await loginUser(identifier.trim(), password);
            if (result) {
                showToast('Welcome back!');
                await handlePostLoginLogic(result.token, result.fcmToken ?? undefined);
            } else {
                showToast('Invalid email or password');
            }
        } catch (err: any) {
            showToast(err?.message || 'Connection error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
                {/* Decorative Background Element */}
                <View style={styles.topAccent} pointerEvents="none" />

                <View style={styles.header}>
                    <Text style={styles.brand}>EXDOLLARIUM</Text>
                    <Text style={styles.subtitle}>Secure payments. Smarter money.</Text>
                </View>

                <View style={styles.card}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Identifier</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Email, username or phone"
                            placeholderTextColor={theme.colors.muted}
                            value={identifier}
                            onChangeText={setIdentifier}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Password</Text>
                        <View style={styles.passwordContainer}>
                            <TextInput
                                style={styles.passwordInput}
                                placeholder="••••••••"
                                placeholderTextColor={theme.colors.muted}
                                value={password}
                                secureTextEntry={!isPasswordVisible}
                                onChangeText={setPassword}
                            />
                            <TouchableOpacity 
                                onPress={() => setIsPasswordVisible(!isPasswordVisible)} 
                                style={styles.eyeIcon}
                            >
                                <Ionicons 
                                    name={isPasswordVisible ? "eye-off-outline" : "eye-outline"} 
                                    size={20} 
                                    color={theme.colors.primary} 
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.actionsRow}>
                        <View style={styles.rememberMe}>
                            <Switch 
                                value={shouldRemember} 
                                onValueChange={setShouldRemember}
                                trackColor={{ false: '#767577', true: theme.colors.primaryLight }}
                                thumbColor={shouldRemember ? theme.colors.primary : '#f4f3f4'}
                            />
                            <Text style={styles.rememberText}>Remember me</Text>
                        </View>
                        <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword' as any)}>
                            <Text style={styles.forgotLink}>Forgot password?</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity 
                        style={[styles.loginButton, loading && styles.buttonDisabled]} 
                        onPress={onLoginPress} 
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={theme.colors.white} />
                        ) : (
                            <Text style={styles.loginButtonText}>Sign In</Text>
                        )}
                    </TouchableOpacity>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>New here?</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Signup' as any)}>
                            <Text style={styles.signupLink}> Create an account</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <TouchableOpacity 
                    style={styles.legalLinks}
                    onPress={() => Linking.openURL('https://exdollarium-6f0f5aab6a7d.herokuapp.com/privacy-policy')}
                >
                    <Text style={styles.legalText}>Privacy Policy • Terms of Service</Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const createStyles = (t: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: t.colors.primary,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingBottom: 40,
    },
    topAccent: {
        position: 'absolute',
        top: -150,
        right: -100,
        width: 400,
        height: 400,
        borderRadius: 200,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    header: {
        alignItems: 'center',
        marginBottom: 30,
    },
    brand: {
        fontSize: 36,
        fontWeight: '900',
        color: t.colors.white,
        letterSpacing: 1,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 5,
    },
    card: {
        backgroundColor: t.colors.white,
        marginHorizontal: 20,
        padding: 24,
        borderRadius: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 10,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: t.colors.textSecondary || '#666',
        marginBottom: 8,
    },
    input: {
        backgroundColor: t.colors.input || '#F5F7FA',
        color: t.colors.text,
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        borderWidth: 1,
        borderColor: t.colors.border || '#E1E8ED',
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: t.colors.input || '#F5F7FA',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: t.colors.border || '#E1E8ED',
    },
    passwordInput: {
        flex: 1,
        padding: 14,
        fontSize: 16,
        color: t.colors.text,
    },
    eyeIcon: {
        paddingHorizontal: 12,
    },
    actionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
    },
    rememberMe: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rememberText: {
        marginLeft: 8,
        fontSize: 14,
        color: t.colors.text,
    },
    forgotLink: {
        color: t.colors.primary,
        fontWeight: '600',
        fontSize: 14,
    },
    loginButton: {
        backgroundColor: t.colors.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 24,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    loginButtonText: {
        color: t.colors.white,
        fontSize: 18,
        fontWeight: '700',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 20,
    },
    footerText: {
        color: t.colors.muted,
        fontSize: 14,
    },
    signupLink: {
        color: t.colors.primary,
        fontWeight: '700',
        fontSize: 14,
    },
    legalLinks: {
        marginTop: 30,
        alignItems: 'center',
    },
    legalText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
    },
});

export default LoginScreen;