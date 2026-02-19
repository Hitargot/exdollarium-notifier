import React, { useRef, useState, useMemo } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, 
  Platform, Animated, ActivityIndicator, SafeAreaView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

// Project Imports
import appTheme from '../styles/theme';
import { useTheme } from '../theme/index';
import authLock from '../utils/authLock';
import { showInAppConfirm } from '../contexts/ConfirmContext';

const SetPasscodeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors: tColors } = useTheme() || { colors: appTheme.colors };
  const styles = useMemo(() => createStyles(tColors), [tColors]);

  const [stage, setStage] = useState<1 | 2>(1);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const triggerShake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleKeyPress = (num: string) => {
    setError(null);
    const currentPin = stage === 1 ? pin : confirmPin;
    
    if (currentPin.length < 4) {
      const nextPin = currentPin + num;
      if (stage === 1) setPin(nextPin);
      else setConfirmPin(nextPin);

      if (nextPin.length === 4) {
        setTimeout(() => validateStage(nextPin), 250);
      }
    }
  };

  const validateStage = async (finalPin: string) => {
    if (stage === 1) {
      setStage(2);
    } else {
      if (pin !== finalPin) {
        setError('Passcodes do not match');
        triggerShake();
        setConfirmPin('');
        return;
      }
      savePasscode();
    }
  };

  const savePasscode = async () => {
    setLoading(true);
    try {
      await authLock.setPasscode(pin);
      await authLock.setLastAuth();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Changed confirmText to 'Okay'
      await showInAppConfirm({ 
        title: 'Security Active', 
        message: 'Your app passcode has been set successfully.', 
        confirmText: 'Okay',
        // explicit empty cancelText -> single-button modal (no cancel)
        cancelText: ''
      });

      navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
    } catch (e) {
      setError('Failed to save security settings.');
    } finally {
      setLoading(false);
    }
  };

  const renderPinDots = () => {
    const currentLength = stage === 1 ? pin.length : confirmPin.length;
    return (
      <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
        {[1, 2, 3, 4].map((_, i) => (
          <View 
            key={i} 
            style={[
              styles.dot, 
              currentLength > i && { 
                backgroundColor: tColors.primary, 
                borderColor: tColors.primary,
                transform: [{ scale: 1.1 }] 
              }
            ]} 
          />
        ))}
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconBox}>
            <Ionicons name="finger-print" size={32} color={tColors.primary} />
          </View>
          <Text style={styles.title}>{stage === 1 ? 'Create Passcode' : 'Confirm Passcode'}</Text>
          <Text style={styles.subtitle}>
            {stage === 1 
              ? 'Secure your account with a 4-digit lock.' 
              : 'Please repeat your passcode to verify.'}
          </Text>
        </View>

        {renderPinDots()}

        <View style={styles.errorContainer}>
            {error && <Text style={styles.errorText}>{error}</Text>}
        </View>

        <View style={styles.keypad}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'back'].map((val, i) => {
            if (val === '') return <View key={i} style={styles.key} />;
            return (
              <TouchableOpacity 
                key={i} 
                style={styles.key} 
                onPress={() => {
                  if (val === 'back') {
                    stage === 1 ? setPin(pin.slice(0, -1)) : setConfirmPin(confirmPin.slice(0, -1));
                  } else {
                    handleKeyPress(val.toString());
                  }
                }}
              >
                {val === 'back' ? (
                  <Ionicons name="backspace-outline" size={28} color={tColors.text} />
                ) : (
                  <Text style={styles.keyText}>{val}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.loaderContainer}>
            {loading && <ActivityIndicator color={tColors.primary} />}
        </View>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (t: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.background },
  content: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 40 },
  iconBox: { 
    width: 64, height: 64, borderRadius: 20, backgroundColor: t.primary + '15',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16
  },
  title: { fontSize: 24, fontWeight: '800', color: t.text },
  subtitle: { color: t.muted, marginTop: 8, textAlign: 'center', fontSize: 15 },
  dotsRow: { flexDirection: 'row', gap: 24, marginVertical: 30 },
  dot: { 
    width: 18, height: 18, borderRadius: 9, 
    borderWidth: 2, borderColor: t.border, backgroundColor: 'transparent' 
  },
  errorContainer: { height: 30, marginBottom: 10 },
  errorText: { color: t.error || '#ef4444', fontWeight: '600', textAlign: 'center' },
  keypad: { 
    flexDirection: 'row', flexWrap: 'wrap', width: '100%', 
    justifyContent: 'center', maxWidth: 320 
  },
  key: { 
    width: 75, height: 75, justifyContent: 'center', alignItems: 'center',
    margin: 8, borderRadius: 40
  },
  keyText: { fontSize: 28, fontWeight: '600', color: t.text },
  loaderContainer: { height: 40, marginTop: 10 }
});

export default SetPasscodeScreen;