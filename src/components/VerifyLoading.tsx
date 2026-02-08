import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import appTheme from '../styles/theme';
import { useTheme } from '../theme/index';

type Status = 'idle' | 'loading' | 'success' | 'error' | 'exists';

type Props = {
  status?: Status;
  title?: string;
  message?: string;
  actionText?: string;
  onAction?: () => void;
  secondaryText?: string;
  small?: boolean;
};

const VerifyLoading: React.FC<Props> = ({
  status = 'loading',
  title,
  message,
  actionText,
  onAction,
  secondaryText,
  small = false,
}) => {
  const themeCtx = (() => { try { return useTheme(); } catch (e) { return undefined as any; } })();
  const t = themeCtx || appTheme;
  const styles = useMemo(() => createStyles(t), [t]);

  // Dynamic Color Palette for Statuses
  const color = useMemo(() => {
    switch (status) {
      case 'success': return t.colors.success;
      case 'error':   return t.colors.error;
      case 'exists':  return t.colors.primary; // Or a specific warning/info color
      default:        return t.colors.primary;
    }
  }, [status, t]);

  const renderIcon = () => {
    if (status === 'loading') return <ActivityIndicator color={color} size={small ? 'small' : 'large'} />;
    
    let iconName: keyof typeof Ionicons.glyphMap;
    switch (status) {
      case 'success': iconName = "checkmark-circle"; break;
      case 'error':   iconName = "close-circle"; break;
      case 'exists':  iconName = "information-circle"; break;
      default:        iconName = "help-circle";
    }

    return <Ionicons name={iconName} size={small ? 28 : 40} color={color} />;
  };

  const handleAction = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAction?.();
  };

  return (
    <View style={[
        styles.card, 
        { borderColor: color + '30', backgroundColor: status === 'exists' ? color + '08' : t.colors.surface }
    ]}> 
      <View style={styles.row}>
        <View style={styles.iconWrap}>{renderIcon()}</View>
        <View style={styles.meta}>
          {title ? (
            <Text 
                numberOfLines={1} 
                style={[styles.title, { color: status === 'error' ? t.colors.error : t.colors.text }]}
            >
                {title}
            </Text>
          ) : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {secondaryText ? <Text style={styles.secondary}>{secondaryText}</Text> : null}
        </View>
      </View>

      {actionText && onAction ? (
        <View style={styles.actions}>
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={handleAction} 
            style={[styles.actionBtn, { backgroundColor: color }]}
          > 
            <Text style={styles.actionText}>{actionText}</Text>
            <Ionicons name="arrow-forward" size={14} color={t.colors.white} />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

const createStyles = (t: any) => StyleSheet.create({
  card: {
    borderWidth: 1.5,
    padding: 14,
    borderRadius: 18,
    marginBottom: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 2 }
    })
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: { 
    width: 48, 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  meta: { 
    flex: 1, 
    paddingLeft: 12 
  },
  title: { 
    fontSize: 16, 
    fontWeight: '800', 
    marginBottom: 2,
    letterSpacing: -0.3
  },
  message: { 
    color: t.colors.muted, 
    fontSize: 13, 
    lineHeight: 18,
    fontWeight: '500'
  },
  secondary: { 
    color: t.colors.mutedLight, 
    fontSize: 11, 
    marginTop: 6,
    fontStyle: 'italic'
  },
  actions: { 
    marginTop: 14, 
    flexDirection: 'row', 
    justifyContent: 'flex-end' 
  },
  actionBtn: { 
    paddingVertical: 10, 
    paddingHorizontal: 16, 
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 4 },
        android: { elevation: 3 }
    })
  },
  actionText: { 
    color: t.colors.white, 
    fontWeight: '800',
    fontSize: 13
  },
});

export default VerifyLoading;