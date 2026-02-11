import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";

// Styling & Components
import { useTheme } from "../theme/index";
import appTheme from "../styles/theme";
import UIButton from "../components/UIButton";
import { showToast } from "../utils/toast";

const API_URL = Constants.expoConfig?.extra?.apiUrl;

const OtpVerificationScreen = ({ route }: any) => {
  const navigation = useNavigation<any>();
  const { email } = route.params;

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const hiddenOtpRef = useRef<TextInput | null>(null);
  // Guard against very-rapid focus switches which can cause the visible
  // OTP boxes to jitter on some devices. We debounce programmatic focus
  // calls by requiring at least 120ms between them.
  const lastFocusTs = useRef<number>(0);
  // When the OS autofill or a paste supplies the entire 6-digit code we
  // apply it programmatically; while applying we want to ignore focus
  // events to avoid the visible boxes jittering. This flag indicates
  // that we're in that 'apply' window.
  const isApplyingOtpRef = useRef<boolean>(false);

  const { colors: tColors } = useTheme();
  const styles = useMemo(() => createStyles(tColors), [tColors]);

  // Resend Timer Logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Focus first input on mount
  useEffect(() => {
    const t = setTimeout(() => {
      // Focus the first visible digit input only. Focusing the hidden
      // autofill input as well was causing the visible boxes to steal
      // focus repeatedly which produced a "dancing" effect on some
      // devices (focus toggling). Keep the hidden input unfocused so
      // the visible inputs behave predictably.
      inputRefs.current[0]?.focus();
    }, 500);
    return () => clearTimeout(t);
  }, []);

  const handleOtpChange = (value: string, index: number) => {
    const digits = value.replace(/\D/g, "");
    const newOtp = [...otp];

    if (digits.length > 1) {
      // Handle Paste
      isApplyingOtpRef.current = true;
      const pasted = digits.slice(0, 6).split("");
      const updatedOtp = [
        ...pasted,
        ...Array(6 - pasted.length).fill(""),
      ].slice(0, 6);
      setOtp(updatedOtp);
      // When a full code is pasted, avoid focus changes and verify
      if (pasted.length === 6) {
        Keyboard.dismiss();
        // ensure visible UI updates before verification completes
        setFocusedIndex(5);
        // small delay to let inputs render without focus toggles
        setTimeout(() => verifyOtp(updatedOtp.join("")), 80);
      }
      // release the apply guard shortly after
      setTimeout(() => {
        isApplyingOtpRef.current = false;
      }, 300);
      return;
    }

    newOtp[index] = digits;
    setOtp(newOtp);

    if (digits && index < 5) {
      // debounce focus to avoid rapid toggle/jitter. If we're currently
      // applying a remote OTP (autofill/paste), skip programmatic focus
      // calls entirely to avoid stealing focus back and forth.
      const now = Date.now();
      setFocusedIndex(index + 1);
      if (!isApplyingOtpRef.current && now - lastFocusTs.current > 120) {
        lastFocusTs.current = now;
        inputRefs.current[index + 1]?.focus();
      }
    } else if (newOtp.every((d) => d !== "")) {
      Keyboard.dismiss();
      verifyOtp(newOtp.join(""));
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      const now = Date.now();
      setFocusedIndex(index - 1);
      if (!isApplyingOtpRef.current && now - lastFocusTs.current > 120) {
        lastFocusTs.current = now;
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const verifyOtp = async (code?: string) => {
    const finalOtp = code || otp.join("");
    if (finalOtp.length !== 6) return showToast("Please enter the full code");

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: finalOtp }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast("Identity verified successfully!");
        // After successful OTP verification, show onboarding success screen
        // then the onboarding screen will route the user to Login (or Dashboard)
        navigation.reset({ index: 0, routes: [{ name: "SuccessOnboarding" }] });
      } else {
        showToast(data.message || "Invalid OTP");
      }
    } catch (err) {
      showToast("Verification failed. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (resendTimer > 0) return;
    try {
      const res = await fetch(`${API_URL}/api/auth/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        showToast("A new code has been sent");
        setResendTimer(60);
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      showToast("Could not resend code");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: tColors.primary }]}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="shield-checkmark" size={50} color="#fff" />
        </View>

        <View style={styles.card}>
          <Text style={[styles.title, { color: tColors.primary }]}>
            Verification
          </Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{"\n"}
            <Text style={styles.emailText}>{email}</Text>
          </Text>

          <View style={styles.otpWrapper}>
            {otp.map((digit, idx) => (
              <TouchableOpacity
                key={idx}
                activeOpacity={1}
                onPress={() => inputRefs.current[idx]?.focus()} // Force focus when the box is tapped
                style={[
                  styles.inputBox,
                  focusedIndex === idx && styles.focusedBox,
                  digit !== "" && { borderColor: tColors.primary },
                ]}
              >
                <TextInput
                  ref={(ref) => {
                    inputRefs.current[idx] = ref;
                  }}
                  style={styles.otpInput}
                  keyboardType="number-pad"
                  maxLength={1}
                  value={digit}
                  // Remove onFocus if it's causing loops, or keep it but ensure
                  // handleOtpChange focus logic is delayed.
                  onFocus={() => setFocusedIndex(idx)}
                  onChangeText={(v) => handleOtpChange(v, idx)}
                  onKeyPress={(e) => handleKeyPress(e, idx)}
                  // Critical for iOS focus stability:
                  selectTextOnFocus={true}
                />
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ width: "100%", marginTop: 10 }}>
            <View style={{ position: "relative" }}>
              <UIButton
                title={loading ? "" : "Verify & Continue"}
                onPress={() => verifyOtp()}
                disabled={loading}
                style={styles.button}
              />
              {loading && (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { justifyContent: "center", alignItems: "center" },
                  ]}
                >
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </View>
          </View>

          <TouchableOpacity
            disabled={resendTimer > 0}
            onPress={resendOtp}
            style={styles.resendBtn}
          >
            <Text
              style={[styles.resendText, resendTimer > 0 && { color: "#999" }]}
            >
              {resendTimer > 0
                ? `Resend code in ${resendTimer}s`
                : "Didn't receive a code? Resend"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Invisible Autofill Input */}
        <TextInput
          ref={hiddenOtpRef}
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          style={{ height: 0, width: 0, opacity: 0 }}
          onChangeText={(text) => {
            if (text.length === 6) handleOtpChange(text, 0);
          }}
        />
      </View>
    </KeyboardAvoidingView>
  );
};

const createStyles = (t: any) =>
  StyleSheet.create({
    container: { flex: 1 },
    content: { flex: 1, justifyContent: "center", padding: 24 },
    iconContainer: {
      alignSelf: "center",
      backgroundColor: "rgba(255,255,255,0.2)",
      padding: 20,
      borderRadius: 40,
      marginBottom: 30,
    },
    card: {
      backgroundColor: "#fff",
      borderRadius: 24,
      padding: 24,
      alignItems: "center",
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 5,
    },
    title: { fontSize: 24, fontWeight: "800", marginBottom: 8 },
    subtitle: {
      fontSize: 15,
      color: "#666",
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 30,
    },
    emailText: { color: "#111", fontWeight: "700" },
    otpWrapper: {
      flexDirection: "row",
      justifyContent: "space-between",
      width: "100%",
      marginBottom: 30,
    },
    inputBox: {
      width: 44,
      height: 56,
      borderWidth: 1.5,
      borderColor: "#E1E8ED",
      borderRadius: 12,
      backgroundColor: "#F9FBFC",
      justifyContent: "center",
      alignItems: "center",
    },
    focusedBox: {
      borderColor: "#2563eb", // Standardized focus color
      backgroundColor: "#fff",
      shadowColor: "#2563eb",
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    otpInput: {
      fontSize: 22,
      fontWeight: "700",
      color: "#111",
      width: "100%",
      textAlign: "center",
    },
    button: { width: "100%", height: 55, borderRadius: 12, marginTop: 10 },
    resendBtn: { marginTop: 20, padding: 10 },
    resendText: { fontSize: 14, color: "#2563eb", fontWeight: "600" },
  });

export default OtpVerificationScreen;
