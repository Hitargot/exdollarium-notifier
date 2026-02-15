import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, 
  SafeAreaView, Keyboard, Platform, TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import Constants from 'expo-constants';

import authStorage from '../utils/authStorage';
import { useTheme } from '../theme/index';
import appTheme from '../styles/theme';
import showToast from '../utils/toast';
import UIButton from '../components/UIButton';

const API_URL = Constants.expoConfig?.extra?.apiUrl;

const SetPINScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<any, 'SetPINScreen'>>();
  const otp = route?.params?.otp;

  const { colors: tColors } = useTheme() || { colors: appTheme.colors };
  const styles = useMemo(() => createStyles(tColors), [tColors]);

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPinVisible, setIsPinVisible] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Focus on mount and when navigating back
  useEffect(() => {
    const focusSubscription = navigation.addListener('focus', () => {
      setTimeout(() => inputRef.current?.focus(), 500);
    });
    return focusSubscription;
  }, [navigation]);

  useEffect(() => {
    if (pin.length === 4 && !isConfirming) {
      setTimeout(() => setIsConfirming(true), 300);
    }
  }, [pin]);

  // Helper to force focus
  const forceFocus = () => {
    inputRef.current?.blur(); // Force a reset
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleAction = async () => {
    if (pin !== confirmPin) {
      showToast('PINs do not match. Try again.');
      setPin('');
      setConfirmPin('');
      setIsConfirming(false);
      forceFocus();
      return;
    }

    setLoading(true);
    try {
      const token = await authStorage.getToken();
      if (!token) throw new Error('Session expired. Please log in.');

  let endpoint = `${API_URL}/api/user/set-pin`;
      let payload: any = { newPin: pin };

      if (otp) {
        // Reset mode
  endpoint = `${API_URL}/api/user/reset-pin`;
        const decoded: any = jwtDecode(token);
        const userRes = await axios.get(`${API_URL}/api/users/user/${decoded.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        payload = { email: userRes.data.email, otp, newPin: pin };
      }

      console.log('[SetPINScreen] set/reset PIN request', { endpoint, payload });
      const resp = await axios.post(endpoint, payload, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      console.log('[SetPINScreen] set/reset PIN response', resp.status, resp.data);

      showToast(otp ? 'PIN reset successfully!' : 'PIN set successfully!');
      
      const { nextScreen, nextScreenParams } = route.params || {};

      if (nextScreen) {
        navigation.navigate(nextScreen, nextScreenParams);
      } else if (otp) {
        // If we are in reset mode, navigate back to withdrawal form with bank details
        navigation.navigate('WithdrawalFormScreen', { selectedBank: route.params?.bank });
      } else {
        // Otherwise, just go to the dashboard
        navigation.navigate('Dashboard');
      }

    } catch (err: any) {
      console.log('[SetPINScreen] set/reset PIN error', (err as any)?.response?.status, (err as any)?.response?.data || err.message || err);
      showToast((err as any)?.response?.data?.message || 'Verification failed.');
      setIsConfirming(false);
      setPin('');
      setConfirmPin('');
    } finally {
      setLoading(false);
    }
  };

  const renderPinBoxes = (isConfirm: boolean) => {
    const value = isConfirm ? confirmPin : pin;
    const boxes = [];
    for (let i = 0; i < 4; i++) {
      const digit = value[i] || '';
      const isFocused = value.length === i;

      boxes.push(
        <TouchableOpacity 
          key={i} 
          activeOpacity={1}
          style={[styles.pinBox, isFocused && styles.pinBoxFocused]} 
          onPress={forceFocus}
        >
          <Text style={styles.pinText}>
            {digit ? (isPinVisible ? digit : '●') : ''}
          </Text>
        </TouchableOpacity>
      );
    }
    return <View style={styles.pinBoxContainer}>{boxes}</View>;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Invisible input */}
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={isConfirming ? confirmPin : pin}
        onChangeText={isConfirming ? setConfirmPin : setPin}
        maxLength={4}
        keyboardType="number-pad"
        caretHidden
        autoFocus
      />

      <TouchableOpacity 
        style={styles.content} 
        activeOpacity={1} 
        onPress={forceFocus}
      >
        <View style={styles.header}>
          <Ionicons 
            name={isConfirming ? 'checkmark-circle-outline' : 'keypad-outline'} 
            size={48} 
            color={tColors.primary} 
          />
          <Text style={styles.title}>
            {isConfirming ? "Confirm PIN" : "Set Transaction PIN"}
          </Text>
          <Text style={styles.subtitle}>
            {isConfirming 
              ? "Re-enter your 4-digit PIN to confirm." 
              : "This PIN will be required for all withdrawals and transfers."}
          </Text>
        </View>

        {renderPinBoxes(isConfirming)}

        <TouchableOpacity onPress={() => setIsPinVisible(!isPinVisible)} style={styles.eyeIcon}>
          <Ionicons name={isPinVisible ? 'eye-off-outline' : 'eye-outline'} size={24} color={tColors.muted} />
          <Text style={styles.eyeText}>{isPinVisible ? 'Hide' : 'Show'} PIN</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          {isConfirming ? (
            <UIButton 
              title={loading ? "" : "Complete Setup"} 
              onPress={handleAction}
              disabled={confirmPin.length !== 4 || loading}
            >
              {loading && <ActivityIndicator color="#fff" />}
            </UIButton>
          ) : (
            <UIButton
              title="Continue"
              onPress={() => setIsConfirming(true)}
              disabled={pin.length !== 4}
            />
          )}
          
          <TouchableOpacity 
            onPress={() => {
              if (isConfirming) {
                setIsConfirming(false);
                setConfirmPin('');
                forceFocus();
              } else {
                navigation.goBack();
              }
            }}
            style={styles.backBtn}
          >
            <Text style={styles.backText}>{isConfirming ? "Change PIN" : "Cancel"}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const createStyles = (t: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.background },
  content: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: t.text, marginTop: 16 },
  subtitle: { fontSize: 15, color: t.muted, textAlign: 'center', marginTop: 10, paddingHorizontal: 20 },

  pinBoxContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '70%',
    marginBottom: 20,
  },
  hiddenInput: {
  position: 'absolute',
  width: 100, // Larger width makes it "tappable" by the system
  height: 40,
  opacity: 0, // Keep it invisible
  zIndex: -1, // Behind other elements
  top: 0,
},
  pinBox: {
    width: 50,
    height: 60,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: t.surface,
  },
  pinBoxFocused: {
    borderColor: t.primary,
    borderWidth: 2,
  },
  pinText: {
    fontSize: 24,
    color: t.text,
  },
  eyeIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginBottom: 20,
  },
  eyeText: {
    color: t.muted,
    marginLeft: 8,
  },
  footer: { width: '100%', paddingHorizontal: 20 },
  backBtn: { marginTop: 20, padding: 10, alignItems: 'center' },
  backText: { color: t.muted, fontWeight: '600' }
});

export default SetPINScreen;