import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors } from '../styles/tokens';

type Props = {
  title?: string;
  onPress?: (() => void) | (() => Promise<void>);
  disabled?: boolean;
  style?: any;
  children?: React.ReactNode;
};

const UIButton: React.FC<Props> = ({ title, onPress, disabled, style, children }) => {
  return (
    <TouchableOpacity onPress={onPress as any} style={[styles.btn, disabled && styles.disabled, style]} disabled={disabled}>
      {children ? children : <Text style={styles.text}>{title}</Text>}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    backgroundColor: colors.brand.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
});

export default UIButton;