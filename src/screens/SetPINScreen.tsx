import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, 
  SafeAreaView, Keyboard, Platform, TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import Constants from 'expo-constants';

// Project Imports
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
  const inputRef = React.useRef<TextInput>(null);

  useEffect(() => {
    // Focus the hidden input when the screen is ready
    const focusSubscription = navigation.addListener('focus', () => {
      inputRef.current?.focus();
    });
    return focusSubscription;
  }, [navigation]);

  // Auto-trigger validation when 4 digits are entered
  useEffect(() => {
    if (pin.length === 4 && !isConfirming) {
      setTimeout(() => setIsConfirming(true), 300);
    }
  }, [pin]);

  const handleAction = async () => {
    if (pin !== confirmPin) {
      showToast('PINs do not match. Try again.');
      setPin('');
      setConfirmPin('');
      setIsConfirming(false);
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
        const decoded: any = jwtDecode(token);
        const userRes = await axios.get(`${API_URL}/api/users/user/${decoded.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        endpoint = `${API_URL}/api/user/reset-pin`;
        payload = { email: userRes.data.email, otp, newPin: pin };
      }

      await axios.post(endpoint, payload, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });

      showToast(otp ? 'PIN reset successfully!' : 'PIN set successfully!');
      
      if (otp) {
        // If we are in reset mode, navigate back to withdrawal form with bank details
        navigation.navigate('WithdrawalFormScreen', { selectedBank: route.params?.bank });
      } else {
        // Otherwise, just go to the dashboard
        navigation.navigate('Dashboard');
      }

    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Verification failed.');
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
        <TouchableOpacity key={i} style={[styles.pinBox, isFocused && styles.pinBoxFocused]} onPress={() => inputRef.current?.focus()}>
          <Text style={styles.pinText}>
            {digit ? (isPinVisible ? digit : '●') : ''}
          </Text>
        </TouchableOpacity>
      );
    }
    return (
      <View style={styles.pinBoxContainer}>
        {boxes}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.content} activeOpacity={1} onPress={() => inputRef.current?.focus()}>
        <View style={styles.header}>
          {(() => {
            const iconName = isConfirming ? 'checkmark-circle-outline' : 'keypad-outline';
            return <Ionicons name={iconName as any} size={48} color={tColors.primary} />;
          })()}
          <Text style={styles.title}>
            {isConfirming ? "Confirm PIN" : "Set Transaction PIN"}
          </Text>
          <Text style={styles.subtitle}>
            {isConfirming 
              ? "Re-enter your 4-digit PIN to confirm." 
              : "This PIN will be required for all withdrawals and transfers."}
          </Text>
        </View>

        {/* Hidden Input to manage keyboard and state */}
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

        {isConfirming ? renderPinBoxes(true) : renderPinBoxes(false)}

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
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  pinBoxContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '70%',
    marginBottom: 20,
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