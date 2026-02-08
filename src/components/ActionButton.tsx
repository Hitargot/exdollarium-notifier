import React, { useMemo } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';

// Project Imports
import appTheme from '../styles/theme';
import { useTheme } from '../theme/index';
import { pickContrastText } from '../theme/colorUtils';

type Props = {
  onPress?: () => void;
  icon?: React.ReactElement<any> | null;
  label?: string;
  style?: any;
  disabled?: boolean;
  color?: string; // Allow overriding the primary color for specific actions (e.g., "Request" vs "Send")
};

const ActionButton: React.FC<Props> = ({ onPress, icon, label, style, disabled, color }) => {
  const { colors: tColors } = useTheme() || { colors: appTheme.colors };
  
  // Memoize styles to avoid re-calculation on every re-render
  const styles = useMemo(() => createStyles(tColors), [tColors]);

  // Determine colors
  const buttonBg = color || tColors.primary;
  const iconColor = pickContrastText(buttonBg, '#FFFFFF', tColors.text);

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={[
          styles.btn, 
          { backgroundColor: buttonBg },
          style, 
          disabled && styles.disabled
        ]}
        disabled={disabled}
      >
        {/* Pass the calculated contrast color to the icon if it's an Icon component */}
        {icon && React.isValidElement(icon)
          ? React.cloneElement(icon as React.ReactElement<any>, { 
              ...(icon.props as any),
              color: (icon.props as any).color ?? iconColor,
              size: (icon.props as any).size ?? 28 
            } as any)
          : icon}
      </TouchableOpacity>
      
      {label && (
        <Text numberOfLines={1} style={styles.label}>
          {label}
        </Text>
      )}
    </View>
  );
};

const createStyles = (t: any) => StyleSheet.create({
  wrap: { 
    alignItems: 'center', 
    width: 80, // Slightly narrower for better spacing in a row of 4
  },
  btn: { 
    width: 58, 
    height: 58, 
    borderRadius: 20, // Squircle look is more modern than a perfect circle
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 8,
    // Soft shadow for depth
    shadowColor: t.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  label: { 
    fontSize: 12, 
    fontWeight: '600',
    color: t.text,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.5,
    backgroundColor: t.muted,
    shadowOpacity: 0,
    elevation: 0,
  },
});

export default ActionButton;