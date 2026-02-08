import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../theme/index";
import UIButton from "../components/UIButton";

const { width } = Dimensions.get("window");

const onboardingSteps = [
  {
    icon: "wallet-outline",
    title: "Secure Wallet",
    desc: "Your assets are protected with institutional-grade security and multi-sig encryption.",
  },
  {
    icon: "swap-horizontal-outline",
    title: "Instant Exchange",
    desc: "Swap between USD and local currencies at the best market rates in seconds.",
  },
  {
    icon: "trending-up-outline",
    title: "Grow Wealth",
    desc: "Track your portfolio performance with real-time analytics and insights.",
  },
];

const SuccessOnboarding = () => {
  const navigation = useNavigation<any>();
  const { colors: tColors } = useTheme();
  const [step, setStep] = useState(0);

  // Animations
  const checkScale = useRef(new Animated.Value(0)).current;
  const fadeContent = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Sequence: Pop the checkmark, then fade in onboarding content
    Animated.sequence([
      Animated.spring(checkScale, { toValue: 1, friction: 5, useNativeDriver: true }),
      Animated.timing(fadeContent, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleNext = () => {
    if (step < onboardingSteps.length - 1) {
      setStep(step + 1);
    } else {
      // After finishing onboarding, return user to login so they can sign in
      navigation.replace("Login");
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: tColors.background }]}>
      <View style={styles.topSection}>
        <Animated.View style={[styles.successCircle, { transform: [{ scale: checkScale }], backgroundColor: tColors.primary }]}>
          <Ionicons name="checkmark" size={60} color="#fff" />
        </Animated.View>
        <Animated.Text style={[styles.successTitle, { opacity: fadeContent }]}>
          Account Verified!
        </Animated.Text>
      </View>

      <Animated.View style={[styles.onboardingCard, { opacity: fadeContent }]}>
        <Ionicons name={onboardingSteps[step].icon as any} size={48} color={tColors.primary} />
        <Text style={[styles.stepTitle, { color: tColors.text }]}>
          {onboardingSteps[step].title}
        </Text>
        <Text style={styles.stepDesc}>
          {onboardingSteps[step].desc}
        </Text>

        {/* Indicator Dots */}
        <View style={styles.dotRow}>
          {onboardingSteps.map((_, i) => (
            <View 
              key={i} 
              style={[
                styles.dot, 
                { backgroundColor: i === step ? tColors.primary : '#E1E8ED', width: i === step ? 20 : 8 }
              ]} 
            />
          ))}
        </View>
      </Animated.View>

      <View style={styles.footer}>
        <UIButton 
          title={step === onboardingSteps.length - 1 ? "Go to Dashboard" : "Next"} 
          onPress={handleNext}
          style={styles.btn}
        />
        <TouchableOpacity onPress={() => navigation.replace("Login")} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip Onboarding</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  topSection: { alignItems: 'center', marginTop: 60 },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 15,
  },
  successTitle: { fontSize: 24, fontWeight: '800' },
  onboardingCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  stepTitle: { fontSize: 22, fontWeight: '700', marginTop: 24, marginBottom: 12 },
  stepDesc: { fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 24 },
  dotRow: { flexDirection: 'row', marginTop: 40 },
  dot: { height: 8, borderRadius: 4, marginHorizontal: 4 },
  footer: { padding: 24, paddingBottom: 40 },
  btn: { height: 56, borderRadius: 16 },
  skipBtn: { marginTop: 16, alignItems: 'center' },
  skipText: { color: '#999', fontWeight: '600' }
});

export default SuccessOnboarding;