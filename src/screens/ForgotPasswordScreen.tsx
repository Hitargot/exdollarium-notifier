import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';

// Project Imports
import { showToast } from '../utils/toast';
import { useTheme } from '../theme/index';
import appTheme from '../styles/theme';
import UIButton from '../components/UIButton';

const API_URL = Constants.expoConfig?.extra?.apiUrl;

const ForgotPasswordScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);

  const { colors: tColors } = useTheme() || { colors: appTheme.colors };

  // Memoize styles to prevent unnecessary re-calculations on every render
  const styles = useMemo(() => createStyles(tColors), [tColors]);

  const handleSubmit = async () => {
    const cleanId = identifier.trim();
    if (!cleanId) return showToast('Please enter your email or phone.');

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password-by-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanId, fromApp: true })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || 'User not found.');

      showToast('Reset code sent successfully.');
      
      // Navigate to OTP reset screen
      navigation.navigate('ResetOtp', { email: cleanId });
    } catch (err: any) {
      showToast(err?.message || 'Could not send OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        
        {/* Back Button */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={tColors.text} />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="key-outline" size={32} color={tColors.primary} />
          </View>
          <Text style={styles.brand}>Forgot Password?</Text>
          <Text style={styles.subtitle}>
            Don't worry! Enter your registered details below and we'll send you a code to reset your password.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Email Address or Phone Number</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="person-outline" size={20} color={tColors.muted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="e.g. name@domain.com"
              placeholderTextColor={tColors.muted}
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="send"
              onSubmitEditing={handleSubmit}
            />
          </View>

          <View style={{ position: 'relative', alignSelf: 'stretch' }}>
            <UIButton 
              title={loading ? "" : "Send Reset Code"} 
              onPress={handleSubmit} 
              disabled={loading}
              style={styles.button}
            />
            {loading && (
              <View style={[styles.button, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
          </View>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Remembered your password? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.link}>Login</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const createStyles = (t: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  backBtn: { position: 'absolute', top: 50, left: 20, zIndex: 10, padding: 8 },
  header: { alignItems: 'center', marginBottom: 32 },
  iconCircle: { 
    width: 80, height: 80, borderRadius: 40, 
    backgroundColor: t.primary + '15', // 15% opacity primary
    justifyContent: 'center', alignItems: 'center', marginBottom: 20 
  },
  brand: { fontSize: 26, fontWeight: '800', color: t.text, textAlign: 'center' },
  subtitle: { 
    color: t.muted, marginTop: 10, textAlign: 'center', 
    lineHeight: 22, paddingHorizontal: 20, fontSize: 15 
  },
  card: { 
    backgroundColor: t.surface, padding: 24, borderRadius: 20, 
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 
  },
  label: { color: t.text, fontSize: 14, fontWeight: '600', marginBottom: 10 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: t.background,
    borderRadius: 12, borderWidth: 1, borderColor: t.border, paddingHorizontal: 12,
    marginBottom: 20
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 14, color: t.text, fontSize: 16 },
  button: { borderRadius: 12, height: 56, justifyContent: 'center' },
  footerRow: { marginTop: 30, flexDirection: 'row', justifyContent: 'center' },
  footerText: { color: t.muted, fontSize: 15 },
  link: { color: t.primary, fontWeight: '700', fontSize: 15 }
});

export default ForgotPasswordScreen;