import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

// Project Imports
import staticTheme from '../styles/theme';
import { useTheme } from '../theme/index';

type Props = {
  matches: any[];
  title?: string;
  onSelect?: (match: any) => void;
};

const VerifyMatches: React.FC<Props> = ({ matches, title = 'Found in your saved accounts', onSelect }) => {
  const themeCtx = (() => { try { return useTheme(); } catch (e) { return undefined as any; } })();
  const t = themeCtx || staticTheme;
  const styles = useMemo(() => createStyles(t), [t]);

  if (!Array.isArray(matches) || matches.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="information-circle" size={18} color={t.colors.primary} />
        <Text style={styles.title}>{title}</Text>
      </View>

      {matches.map((m, idx) => (
        <Pressable 
          key={idx} 
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onSelect?.(m);
          }}
          style={({ pressed }) => [
            styles.item,
            pressed && { backgroundColor: 'rgba(0,0,0,0.03)' }
          ]}
        >
          <View style={styles.leftContent}>
            <Text style={styles.bankName}>{m.bankName || m.name || m.bank || 'Bank'}</Text>
            <Text style={styles.accountName}>{m.accountName || 'Unknown Name'}</Text>
            <View style={styles.accountRow}>
               <Text style={styles.accountNumber}>
                 {String(m.accountNumber || m.account || '').replace(/\D/g, '')}
               </Text>
               {m.bankCode && <Text style={styles.dot}> • </Text>}
               {m.bankCode && <Text style={styles.bankCode}>{m.bankCode}</Text>}
            </View>
          </View>
          
          <View style={styles.selectBadge}>
            <Text style={styles.selectText}>Select</Text>
            <Ionicons name="chevron-forward" size={14} color={t.colors.primary} />
          </View>
        </Pressable>
      ))}
    </View>
  );
};

const createStyles = (t: any) => StyleSheet.create({
  container: {
    backgroundColor: t.colors.primary + '08', // 8% opacity of primary color for a soft tint
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: t.colors.primary + '20', // Subtle border
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  title: {
    color: t.colors.primary,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: t.colors.surface,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    // Soft shadow for the cards inside the container
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  leftContent: {
    flex: 1,
  },
  bankName: {
    fontSize: 15,
    fontWeight: '700',
    color: t.colors.text,
    marginBottom: 2,
  },
  accountName: {
    fontSize: 13,
    color: t.colors.text,
    opacity: 0.7,
    marginBottom: 4,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: t.colors.muted,
    letterSpacing: 1,
  },
  dot: {
    color: t.colors.muted,
  },
  bankCode: {
    fontSize: 11,
    fontWeight: '700',
    color: t.colors.primary,
    backgroundColor: t.colors.primary + '15',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  selectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 12,
  },
  selectText: {
    fontSize: 12,
    fontWeight: '700',
    color: t.colors.primary,
  }
});

export default VerifyMatches;