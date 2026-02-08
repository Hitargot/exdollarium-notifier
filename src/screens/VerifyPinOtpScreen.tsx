import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, 
  SafeAreaView, Keyboard, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import {jwtDecode} from 'jwt-decode';
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
      
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.replace('Dashboard');
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

  // Helper to render the PIN "dots"
  const renderDots = (code: string) => {
    return [1, 2, 3, 4].map((_, i) => (
      <View 
        key={i} 
        style={[
          styles.dot, 
          code.length > i && { backgroundColor: tColors.primary, borderColor: tColors.primary }
        ]} 
      />
    ));
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Ionicons 
            name={isConfirming ? "checkmark-circle-outline" : "keypad-outline"} 
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

        <View style={styles.dotsContainer}>
          {renderDots(isConfirming ? confirmPin : pin)}
        </View>

        {/* Hidden Input to trigger keyboard */}
        <TextInput
          autoFocus
          keyboardType="number-pad"
          maxLength={4}
          value={isConfirming ? confirmPin : pin}
          onChangeText={isConfirming ? setConfirmPin : setPin}
          style={{ height: 0, opacity: 0 }}
          caretHidden
        />

        <View style={styles.footer}>
          {isConfirming && (
            <UIButton 
              title={loading ? "" : "Complete Setup"} 
              onPress={handleAction}
              disabled={confirmPin.length !== 4 || loading}
            >
              {loading && <ActivityIndicator color="#fff" />}
            </UIButton>
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
      </View>
    </SafeAreaView>
  );
};

const createStyles = (t: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.background },
  content: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: t.text, marginTop: 16 },
  subtitle: { fontSize: 15, color: t.muted, textAlign: 'center', marginTop: 10, paddingHorizontal: 20 },
  dotsContainer: { flexDirection: 'row', gap: 20, marginBottom: 40 },
  dot: { 
    width: 20, height: 20, borderRadius: 10, 
    borderWidth: 2, borderColor: t.border, backgroundColor: 'transparent' 
  },
  footer: { width: '100%', paddingHorizontal: 20 },
  backBtn: { marginTop: 20, padding: 10, alignItems: 'center' },
  backText: { color: t.muted, fontWeight: '600' }
});

export default SetPINScreen;