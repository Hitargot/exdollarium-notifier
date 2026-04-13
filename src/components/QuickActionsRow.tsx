import React, { useMemo } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

// Project Imports
import appTheme from '../styles/theme';
import { useTheme } from '../theme/index';

type Props = {
  onSend?: () => void;
  onWithdraw?: () => void;
  onTopup?: () => void;
};

const QuickActionItem = ({ icon, label, color, onPress, textColor }: any) => {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.action,
        pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 }
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: color + '15' }]}> 
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
};

const QuickActionsRow: React.FC<Props> = ({ onSend, onWithdraw, onTopup }) => {
  const t = useTheme();

  return (
    <View style={styles.row}>
      <QuickActionItem 
        label="Send" 
        icon="paper-plane-sharp" 
        color={t.colors.primary} 
        onPress={onSend}
        textColor={t.colors.text}
      />
      <QuickActionItem 
        label="Withdraw" 
        icon="arrow-down-circle-sharp" 
        color={t.colors.success} 
        onPress={onWithdraw}
        textColor={t.colors.text}
      />
      <QuickActionItem 
        label="Top-up" 
        icon="add-circle-sharp" 
        color={t.colors.warning || '#FF9F0A'} 
        onPress={onTopup}
        textColor={t.colors.text}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  row: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.02)', // Very subtle container
    borderRadius: 24,
    marginBottom: 16,
  },
  action: { 
    alignItems: 'center', 
    flex: 1,
  },
  iconWrap: { 
    width: 54, 
    height: 54, 
    borderRadius: 18, // Squircle-ish
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 10,
    // Soft inner glow/border
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  label: { 
    fontSize: 13, 
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});

export default QuickActionsRow;