import React, { useState, useMemo, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator, 
  SafeAreaView, 
  Platform, 
  KeyboardAvoidingView, 
  ScrollView 
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';

// Project imports
import { useTheme } from '../theme/index';
import appTheme from '../styles/theme';
import { showToast } from '../utils/toast';
import UIButton from '../components/UIButton';

const API_URL = Constants.expoConfig?.extra?.apiUrl;

const VerifyPinOtpScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<any, 'VerifyPinOtpScreen'>>();
  const { email, bank } = route.params || {};

  const { colors: tColors } = useTheme() || { colors: appTheme.colors };
  const styles = useMemo(() => createStyles(tColors), [tColors]);

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  // Formatting function for the badge (if used elsewhere in this screen)
  const formatBadgeCount = (n: number) => {
    if (!n || n <= 0) return '';
    return n >= 20 ? '20+' : String(n);
  };

  const handleVerify = async () => {
    // Validation for Alphanumeric 6-character code
    if (!otp || otp.length < 6) {
      return showToast('Please enter the full 6-character code');
    }

    setLoading(true);
    try {
      // Server-side OTP verification
      const response = await axios.post(`${API_URL}/api/user/verify-otp-for-pin-reset`, { 
        email, 
        otp: otp.toUpperCase() // Ensure sent as uppercase
      });
      
      showToast('Identity verified!');
      // Navigate to SetPINScreen with the verified OTP
      navigation.navigate('SetPINScreen', { otp: otp.toUpperCase(), email, bank });

    } catch (e: any) {
      const errorMsg = e?.response?.data?.message || 'Invalid or expired code.';
      showToast(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          <TouchableOpacity 
            style={styles.backIcon} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={tColors.text} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="shield-checkmark-outline" size={40} color={tColors.primary} />
            </View>
            <Text style={styles.title}>Verification Code</Text>
            <Text style={styles.subtitle}>
              We sent a code with letters and numbers to{"\n"}
              <Text style={styles.emailHighlight}>{email || 'your email'}</Text>
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              value={otp}
              onChangeText={(text) => setOtp(text.toUpperCase())}
              // Standard keyboard for Alphanumeric, but optimized
              keyboardType={Platform.OS === 'ios' ? 'default' : 'visible-password'}
              autoCapitalize="characters"
              autoCorrect={false}
              spellCheck={false}
              maxLength={6}
              placeholder="A1B2C3"
              placeholderTextColor={tColors.muted + '80'}
              style={styles.otpInput}
              autoFocus={true}
              // Required for OS Autofill
              textContentType="oneTimeCode"
              autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
            />
          </View>

          <View style={styles.buttonWrapper}>
            <UIButton 
              title={loading ? "" : "Verify & Continue"} 
              onPress={handleVerify} 
              disabled={otp.length < 6 || loading} 
              style={styles.mainButton} 
            />
            {loading && (
              <ActivityIndicator 
                color="#fff" 
                style={StyleSheet.absoluteFill} 
              />
            )}
          </View>

          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.cancelButton} 
            disabled={loading}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (t: any) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: t.background 
  },
  scrollContent: { 
    flexGrow: 1, 
    padding: 24, 
    justifyContent: 'center' 
  },
  backIcon: {
    position: 'absolute',
    top: 20,
    left: 20,
    padding: 8,
  },
  header: { 
    alignItems: 'center', 
    marginBottom: 40 
  },
  iconCircle: { 
    width: 90, 
    height: 90, 
    borderRadius: 45, 
    backgroundColor: (t.primary || '#000') + '15', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 20 
  },
  title: { 
    fontSize: 24, 
    fontWeight: '800', 
    color: t.text, 
    marginBottom: 10 
  },
  subtitle: { 
    fontSize: 15, 
    color: t.muted, 
    textAlign: 'center', 
    lineHeight: 22 
  },
  emailHighlight: { 
    color: t.text, 
    fontWeight: '700' 
  },
  inputContainer: {
    width: '100%',
    marginBottom: 30,
  },
  otpInput: { 
    fontSize: 30, 
    fontWeight: '700', 
    padding: 18, 
    borderRadius: 16, 
    borderWidth: 2, 
    borderColor: t.border, 
    backgroundColor: t.surface, 
    color: t.text, 
    textAlign: 'center', 
    letterSpacing: 8,
  },
  buttonWrapper: {
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
  },
  mainButton: { 
    height: 56, 
    borderRadius: 14 
  },
  cancelButton: { 
    marginTop: 20, 
    alignItems: 'center',
    padding: 10 
  },
  cancelText: { 
    color: t.muted, 
    fontWeight: '600', 
    fontSize: 15 
  },
});

export default VerifyPinOtpScreen;