import React, { useEffect, useRef, useState, useMemo } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Animated 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRememberedIdentifier } from '../utils/rememberedIdentifier';
import { useTheme } from '../theme/index';
import staticTheme from '../styles/theme';
import authLock from '../utils/authLock';
import authStorage from '../utils/authStorage';
import clearLocalData from '../utils/clearLocalData';
import { signalPasscodeReady } from '../utils/splashController';
import { showInAppConfirm } from '../contexts/ConfirmContext';
import PinPad from '../components/PinPad';

const PasscodeUnlockScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors: tColors } = useTheme() || { colors: staticTheme.colors };
  const styles = useMemo(() => createStyles(tColors), [tColors]);

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => signalPasscodeReady(), 100);
    return () => clearTimeout(timer);
  }, []);

  const getUsernameFromToken = (token: string): string | null => {
  try {
    const payloadBase64 = token.split('.')[1]; // Get the payload part of the JWT
    const decodedPayload = JSON.parse(atob(payloadBase64)); // Decode Base64 string
    // Usually, JWTs store the username in 'username', 'sub', or 'email'
    return decodedPayload.username || decodedPayload.sub || null;
  } catch (e) {
    return null;
  }
};
  useEffect(() => {
    const fetchUserDisplayName = async () => {
      try {
        // 1. Get the token from secure storage
        const token = await authStorage.getToken();
        if (token) {
          const username = getUsernameFromToken(token);
          if (username) {
            setDisplayName(username);
            return;
          }
        }

        // 2. Fallback: Check the Profile Cache if token decoding fails
        const rawProfile = await AsyncStorage.getItem('@profile_cache_v2');
        if (rawProfile) {
          const parsed = JSON.parse(rawProfile);
          const name = parsed.data?.username || parsed.data?.firstName;
          if (name) {
            setDisplayName(name);
            return;
          }
        }

        // 3. Last Resort: Generic label
        setDisplayName('User');
      } catch (e) {
        setDisplayName('User');
      }
    };
    fetchUserDisplayName();
  }, []);

  // Fix 2: Handle "Forgot Passcode" by clearing lock and forcing re-login
  const handleForgotPasscode = async () => {
    const ok = await showInAppConfirm({
      title: 'Reset Passcode?',
      message: 'For security, you will be logged out and must sign in again to set a new passcode.',
      confirmText: 'Reset & Logout',
      // No cancelText means it's a one-button alert
    });

    if (ok) {
      // Clear all local data before forcing a re-login
      await clearLocalData().catch(() => null);
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    }
  };

  const performVerification = async (attempt: string) => {
    setIsVerifying(true);
    try {
      const isValid = await authLock.verifyPasscode(attempt);
      if (isValid) {
        await authLock.setLastAuth();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
      } else {
        triggerShake();
        setError('Invalid passcode');
        setPin('');
        setIsVerifying(false);
      }
    } catch (e) {
      setError('System error. Try again.');
      setIsVerifying(false);
    }
  };

  const handleKeyPress = (num: string) => {
    if (pin.length >= 4 || isVerifying) return;
    const nextPin = pin + num;
    setPin(nextPin);
    setError('');
    if (nextPin.length === 4) {
      setTimeout(() => performVerification(nextPin), 200);
    }
  };

  const triggerShake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.nameText}>{displayName || '...'}</Text>
        </View>

        <View style={styles.statusArea}>
          {isVerifying ? (
            <ActivityIndicator color={tColors.primary} />
          ) : (
            <Text style={styles.instructionText}>Enter your passcode</Text>
          )}
        </View>

        <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
          {[0, 1, 2, 3].map((i) => (
            <View 
              key={i} 
              style={[
                styles.dot, 
                pin.length > i && { backgroundColor: tColors.primary, borderColor: tColors.primary }
              ]} 
            />
          ))}
        </Animated.View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <PinPad onKeyPress={handleKeyPress} onDelete={() => setPin(pin.slice(0, -1))} />

        <View style={styles.footer}>
          <TouchableOpacity onPress={handleForgotPasscode}>
            <Text style={styles.footerLink}>Forgot passcode?</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={async () => {
            // When switching accounts we must remove any local data to avoid
            // leaking another user's cached state onto the next login.
            await clearLocalData().catch(() => null);
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          }}>
            <Text style={[styles.footerLink, { color: tColors.error }]}>Switch Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const createStyles = (t: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 30 },
  welcomeText: { fontSize: 16, color: t.muted },
  nameText: { fontSize: 24, fontWeight: '800', color: t.text, marginTop: 4 },
  statusArea: { height: 40, justifyContent: 'center' },
  instructionText: { color: t.muted, fontSize: 14 },
  dotsRow: { flexDirection: 'row', gap: 20, marginVertical: 20 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: t.border },
  errorText: { color: t.error, fontWeight: '600', marginBottom: 10 },
  footer: { marginTop: 40, alignItems: 'center', gap: 15 },
  footerLink: { fontSize: 14, fontWeight: '600', color: t.primary },
});

export default PasscodeUnlockScreen;