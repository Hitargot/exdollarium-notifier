import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
} from "react-native";
import PhoneInput from "expo-phone-number-input";
import Checkbox from "expo-checkbox";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from '@expo/vector-icons';
import Constants from "expo-constants";

// Project Imports
import { showToast } from '../utils/toast';
import UIButton from '../components/UIButton';
import { useTheme } from '../theme/index';
import ConfirmModal from '../components/ConfirmModal';

const PhoneInputComp = (PhoneInput as unknown) as React.ComponentType<any>;
const API_URL = Constants.expoConfig?.extra?.apiUrl;

const SignUpScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors: tColors } = useTheme();
  const styles = useMemo(() => createStyles(tColors), [tColors]);

  // Form State
  const [form, setForm] = useState({
    username: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    phoneLocal: "",
    password: "",
    confirmPassword: "",
    referralCode: "",
  });

  const [selectedCountry, setSelectedCountry] = useState({ iso: 'NG', label: 'Nigeria', dialCode: '+234' });
  const [loading, setLoading] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);
  const [countryModalVisible, setCountryModalVisible] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const updateForm = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const validate = () => {
    const { firstName, lastName, username, email, password, confirmPassword } = form;
    if (!firstName || !lastName || !username) return "Please fill in all name fields";
    if (!email.includes("@")) return "Invalid email address";
    if (password.length < 8) return "Password must be at least 8 characters";
    if (password !== confirmPassword) return "Passwords do not match";
    if (!agreeTerms) return "Please accept the Terms & Conditions";
    return null;
  };
const [passwordScore, setPasswordScore] = useState(0);

const calculateStrength = (pass: string) => {
  let score = 0;
  if (pass.length >= 8) score++;
  if (/[A-Z]/.test(pass)) score++;
  if (/[0-9]/.test(pass)) score++;
  if (/[^A-Za-z0-9]/.test(pass)) score++;
  setPasswordScore(score);
};
  const handleSignUp = async () => {
    const error = validate();
    if (error) return showToast(error);

    setLoading(true);
    try {
      const finalPhone = form.phone || `${selectedCountry.dialCode}${form.phoneLocal}`;
      const response = await fetch(`${API_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, phone: finalPhone, agreedToTerms: agreeTerms, fromApp: true }),
      });

      const data = await response.json();
      if (response.status === 201) {
        showToast('Account created! Please verify your email.');
        navigation.navigate("OtpVerification", { email: form.email, phone: finalPhone });
      } else {
        showToast(data.message || "Sign up failed");
      }
    } catch (e: any) {
      showToast("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.container, { backgroundColor: tColors.primary }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <Text style={styles.brand}>EXDOLLARIUM</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.subtext}>Already have an account? <Text style={{ color: '#fff', fontWeight: 'bold' }}>Log in</Text></Text>
          </TouchableOpacity>
        </View>

        <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={[styles.title, { color: tColors.primary }]}>Create Account</Text>

          {/* Name Row */}
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>First Name</Text>
              <TextInput style={styles.input} placeholder="John" value={form.firstName} onChangeText={(v: string) => updateForm('firstName', v)} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput style={styles.input} placeholder="Doe" value={form.lastName} onChangeText={(v: string) => updateForm('lastName', v)} />
            </View>
          </View>

          <Text style={styles.label}>Username</Text>
          <TextInput style={styles.input} placeholder="johndoe123" autoCapitalize="none" value={form.username} onChangeText={(v: string) => updateForm('username', v)} />

          <Text style={styles.label}>Email Address</Text>
          <TextInput style={styles.input} placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={(v: string) => updateForm('email', v)} />

          <Text style={styles.label}>Phone Number</Text>
          {PhoneInputComp ? (
            <PhoneInputComp
              defaultCode={selectedCountry.iso}
              layout="first"
              value={form.phone}
              onChangeFormattedText={(v: string) => updateForm('phone', v || '')}
              containerStyle={styles.phoneContainer}
              textContainerStyle={styles.phoneTextContainer}
            />
          ) : (
            <View style={styles.fallbackPhoneRow}>
              <TouchableOpacity style={styles.countryPicker} onPress={() => setCountryModalVisible(true)}>
                <Text style={styles.countryCode}>{selectedCountry.dialCode}</Text>
                <Ionicons name="chevron-down" size={14} color="#666" />
              </TouchableOpacity>
              <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} keyboardType="phone-pad" value={form.phoneLocal} onChangeText={(v: string) => updateForm('phoneLocal', v)} />
            </View>
          )}

          <Text style={styles.label}>Password</Text>
          <View style={{ marginBottom: 8 }}>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0, borderWidth: 0 }]}
                placeholder="Create a password"
                placeholderTextColor="#8a94a6"
                secureTextEntry={!showPassword}
                value={form.password}
                onChangeText={(v: string) => { updateForm('password', v); calculateStrength(v); }}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(s => !s)}>
                <Ionicons name={showPassword ? 'eye' : 'eye-off'} size={18} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={[styles.input, { marginBottom: 0 }]}
              placeholder="Confirm password"
              placeholderTextColor="#8a94a6"
              secureTextEntry={!showPassword}
              value={form.confirmPassword}
              onChangeText={(v: string) => updateForm('confirmPassword', v)}
              autoCapitalize="none"
            />
          </View>

          {form.password.length > 0 && (
  <View style={styles.strengthWrapper}>
    <View style={styles.strengthBarBackground}>
      <Animated.View 
        style={[
          styles.strengthBarActive, 
          { 
            width: `${(passwordScore / 4) * 100}%`,
            backgroundColor: passwordScore <= 1 ? '#ff4d4d' : passwordScore === 2 ? '#ffad33' : '#00cc66'
          }
        ]} 
      />
    </View>
    <Text style={[styles.strengthText, { color: passwordScore <= 1 ? '#ff4d4d' : '#00cc66' }]}>
      {passwordScore <= 1 ? 'Weak' : passwordScore === 2 ? 'Fair' : passwordScore === 3 ? 'Good' : 'Strong'}
    </Text>
  </View>
)}

          <View style={styles.termsRow}>
            <Checkbox value={agreeTerms} onValueChange={setAgreeTerms} color={agreeTerms ? tColors.primary : undefined} />
            <TouchableOpacity onPress={() => setTermsVisible(true)}>
              <Text style={styles.termsText}>I agree to the <Text style={styles.linkText}>Terms & Conditions</Text></Text>
            </TouchableOpacity>
          </View>

          <View style={styles.submitBtn}>
            <UIButton
              title={loading ? "" : "Create Account"}
              onPress={handleSignUp}
              disabled={loading}
              style={{ flex: 1 }}
            />
            {loading && <ActivityIndicator style={{ position: 'absolute', alignSelf: 'center', top: 18 }} color="#fff" />}
          </View>
        </Animated.View>

    <ConfirmModal
      visible={termsVisible}
      title="Terms & Conditions"
      fullScreen
      confirmText="I Accept"
      onConfirm={() => { setAgreeTerms(true); setTermsVisible(false); }}
      onCancel={() => setTermsVisible(false)}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.legalText}>{"\u2022"} By creating an account on Exdollarium, you agree to comply with our financial safety guidelines.</Text>
        <Text style={styles.legalText}>{"\u2022"} All transactions are processed securely.</Text>
        <Text style={styles.legalText}>{"\u2022"} We reserve the right to suspend accounts suspected of fraudulent activity to protect our community.</Text>
        <Text style={styles.legalText}>{"\u2022"} You may be required to complete identity verification (KYC) before using certain features; please provide accurate documents when requested.</Text>
        <Text style={styles.legalText}>{"\u2022"} Fees, limits and exchange rates may apply to transactions — review our fee schedule and limits before transacting.</Text>
        <Text style={styles.legalText}>{"\u2022"} You are responsible for securing your account credentials; report any unauthorized access immediately.</Text>
        <Text style={styles.legalText}>{"\u2022"} Funds transferred and confirmed are final; disputes will be handled according to our policies.</Text>
        <Text style={styles.legalText}>{"\u2022"} We may share information with regulators, law enforcement or service providers to comply with legal obligations.</Text>
        <Text style={styles.legalText}>{"\u2022"} Service availability may vary; we may modify or suspend features with notice where required.</Text>
      </ScrollView>
    </ConfirmModal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
const createStyles = (tColors: any) => StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 30 },
  brand: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  subtext: { color: 'rgba(255,255,255,0.7)', marginTop: 8 },
  card: { 
    backgroundColor: tColors.surface, 
    borderRadius: 24, 
    padding: 24, 
    shadowColor: '#000', 
    shadowOpacity: 0.1, 
    shadowRadius: 10, 
    elevation: 5 
  },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 0 },
  label: { fontSize: 13, fontWeight: '600', color: tColors.text, marginBottom: 6, marginTop: 12 },
  input: { 
    backgroundColor: tColors.input || '#F3F6F9', 
    borderRadius: 12, 
    padding: 14, 
    fontSize: 15, 
    color: tColors.text, 
    borderWidth: 1, 
    borderColor: tColors.border || '#E1E8ED' 
  },
  phoneContainer: { 
    width: '100%', 
    backgroundColor: tColors.input || '#F3F6F9', 
    borderRadius: 12, 
    height: 55, 
    borderWidth: 1, 
    borderColor: tColors.border || '#E1E8ED' 
  },
  phoneTextContainer: { backgroundColor: 'transparent', paddingVertical: 0 },
  fallbackPhoneRow: { flexDirection: 'row', alignItems: 'center' },
  countryPicker: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: tColors.input || '#F3F6F9', 
    padding: 14, 
    borderRadius: 12, 
    marginRight: 8, 
    borderWidth: 1, 
    borderColor: tColors.border || '#E1E8ED' 
  },
  countryCode: { fontWeight: '700', marginRight: 4, color: tColors.text },
  passwordWrapper: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: tColors.input || '#F3F6F9', 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: tColors.border || '#E1E8ED' 
  },
  eyeIcon: { padding: 12 },
  termsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  termsText: { marginLeft: 10, fontSize: 14, color: tColors.muted },
  linkText: { color: tColors.primary, fontWeight: '600' },
  submitBtn: { marginTop: 24, height: 55, borderRadius: 12, justifyContent: 'center' },
  legalText: { fontSize: 15, lineHeight: 22, color: tColors.text },
  strengthWrapper: {
  marginTop: 8,
  flexDirection: 'row',
  alignItems: 'center',
},
strengthBarBackground: {
  flex: 1,
  height: 4,
  backgroundColor: tColors.border || '#E1E8ED',
  borderRadius: 2,
  overflow: 'hidden',
  marginRight: 10,
},
strengthBarActive: {
  height: '100%',
  borderRadius: 2,
},
strengthText: {
  fontSize: 12,
  fontWeight: '700',
  width: 50,
  textAlign: 'right',
},
});

export default SignUpScreen;