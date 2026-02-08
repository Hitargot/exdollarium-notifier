import React, { useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

// Project Imports
import staticTheme from '../styles/theme';
import { useTheme } from '../theme/index';

const { width } = Dimensions.get('window');
const BUTTON_SIZE = width < 400 ? 75 : 84; // Responsive sizing

type Props = {
  onKeyPress?: (key: string) => void;
  onDelete?: () => void;
  value?: string;
  onChange?: (next: string) => void;
  maxLength?: number;
};

// Extracted for performance
const PadButton = ({ children, onPress, themeStyles }: any) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    // Subtle tactile feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(scale, {
      toValue: 0.9,
      useNativeDriver: true,
      duration: 90,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scale, {
      toValue: 1,
      useNativeDriver: true,
      duration: 160,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={({ pressed }) => [
        themeStyles.button,
        pressed && { backgroundColor: themeStyles.activeBg }
      ]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

const PinPad = (props: Props) => {
  const { onKeyPress, onDelete, value, onChange, maxLength = 4 } = props;
  const { colors: tColors } = useTheme() || { colors: staticTheme.colors };
  
  // Memoize theme-specific styles for the buttons
  const themeStyles = useMemo(() => ({
    button: {
      width: BUTTON_SIZE,
      height: BUTTON_SIZE,
      borderRadius: BUTTON_SIZE / 2,
      backgroundColor: tColors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      marginHorizontal: 12,
      borderWidth: 1,
      borderColor: tColors.border || 'rgba(0,0,0,0.05)',
    },
    activeBg: tColors.primary + '10', // 10% opacity primary color
  digit: { fontSize: 32, fontWeight: 700 as any, color: tColors.text },
    delColor: tColors.primary,
  }), [tColors]);

  const handleDigit = (k: string) => {
    if (onKeyPress) return onKeyPress(k);
    if (onChange) {
      const cur = value || '';
      if (cur.length < maxLength) onChange(cur + k);
    }
  };

  const handleDel = () => {
    if (onDelete) return onDelete();
    if (onChange) {
      const cur = value || '';
      onChange(cur.slice(0, -1));
    }
  };

  const rows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'del'],
  ];

  return (
    <View style={styles.container}>
      {rows.map((row, ri) => (
        <View style={styles.row} key={`row-${ri}`}>
          {row.map((k, ci) => {
            if (k === '') return <View key={`empty-${ci}`} style={{ width: BUTTON_SIZE, marginHorizontal: 12 }} />;
            
            if (k === 'del') {
              return (
                <PadButton key="del" onPress={handleDel} themeStyles={themeStyles}>
                  <Ionicons name="backspace-outline" size={28} color={themeStyles.delColor} />
                </PadButton>
              );
            }

            return (
              <PadButton key={k} onPress={() => handleDigit(k)} themeStyles={themeStyles}>
                <Text style={themeStyles.digit}>{k}</Text>
              </PadButton>
            );
          })}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    width: '100%', 
    alignItems: 'center', 
    justifyContent: 'center',
    marginTop: 20 
  },
  row: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    width: '100%', 
    marginVertical: 10 
  },
});

export default PinPad;