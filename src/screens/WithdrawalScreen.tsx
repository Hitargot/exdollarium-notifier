import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from './types';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import appTheme from '../styles/theme';
import { useTheme } from '../theme/index';

type NavigationProp = StackNavigationProp<RootStackParamList, 'Withdrawal'>;

const WithdrawalScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const runtimeTheme = useTheme();
  const styles = React.useMemo(() => createStyles(runtimeTheme), [runtimeTheme]);

  return (
    <View style={styles.mainContainer}>
      <ScreenHeader title="Send Money" backgroundColor={runtimeTheme.colors?.background || '#F8F9FC'} />
      
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={styles.container} 
        keyboardShouldPersistTaps="handled"
      >
  <Text style={styles.sectionLabel}>Transfer Options</Text>

        {/* Option 1: Bank Transfer */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.optionCard}
          onPress={() => navigation.navigate('SendViaBankScreen')}
        >
          <View style={[styles.iconArea, { backgroundColor: runtimeTheme.colors?.surface || '#EEF2FF' }]}>
            <MaterialCommunityIcons name="bank" size={26} color={runtimeTheme.colors?.primary || runtimeTheme.colors.primary} />
          </View>
          <View style={styles.textArea}>
            <View style={styles.titleRow}>
              <Text style={styles.optionTitle}>Bank Transfer</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={runtimeTheme.colors?.mutedLight || '#CBD5E1'} />
            </View>
            <Text style={styles.optionDescription}>
              Send directly to a local bank account. Settles within minutes.
            </Text>
          </View>
        </TouchableOpacity>

        {/* Option 2: Exdollarium Transfer */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.optionCard}
          onPress={() => navigation.navigate('SendExdollarium')}
        >
          <View style={[styles.iconArea, { backgroundColor: runtimeTheme.colors?.surface || '#F0FDF4' }]}>
            <Text style={[styles.logoText, { color: runtimeTheme.colors?.success || '#16A34A' }]}>@</Text>
          </View>
          <View style={styles.textArea}>
            <View style={styles.titleRow}>
              <Text style={styles.optionTitle}>Exdollarium User</Text>
          <View style={[styles.instantBadge, { backgroundColor: runtimeTheme.colors?.successLight || '#DCFCE7' }]}> 
            <Text style={[styles.instantText, { color: runtimeTheme.colors?.success || '#16A34A' }]}>INSTANT</Text>
          </View>
            </View>
            <Text style={styles.optionDescription}>
              Zero-fee transfer to any Exdollarium tag or email.
            </Text>
          </View>
        </TouchableOpacity>

    <View style={styles.infoBox}>
      <MaterialCommunityIcons name="shield-check" size={18} color={runtimeTheme.colors?.muted || '#64748B'} />
      <Text style={styles.infoText}>All transfers are encrypted and secure.</Text>
    </View>
      </ScrollView>
    </View>
  );
};

function createStyles(t: any) {
  return StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: t.colors?.background || '#F8F9FC', // themed background
  },
    container: {
      padding: 20,
    },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: t.colors?.muted || '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 20,
    marginLeft: 4,
  },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 20,
      marginBottom: 16,
  backgroundColor: t.colors?.surface || '#FFFFFF',
      borderRadius: 24,
      // Premium Shadow
      ...Platform.select({
        ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.04,
            shadowRadius: 12,
        },
        android: {
            elevation: 2,
        },
      }),
      borderWidth: 1,
  borderColor: t.colors?.mutedLight || '#F1F5F9',
    },
    iconArea: {
      width: 56,
      height: 56,
      marginRight: 16,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },
    logoText: { 
        fontSize: 22, 
        fontWeight: 'bold', 
    },
    textArea: { 
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
  optionTitle: { 
    fontSize: 17, 
    fontWeight: '700', 
    color: t.colors?.text || '#1E293B',
  },
  optionDescription: { 
    fontSize: 14, 
    color: t.colors?.muted || '#64748B',
    lineHeight: 20,
  },
  instantBadge: {
    backgroundColor: t.colors?.successLight || '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  instantText: {
    fontSize: 10,
    fontWeight: '800',
    color: t.colors?.success || '#16A34A',
  },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
        opacity: 0.7,
    },
  infoText: {
    fontSize: 13,
    color: t.colors?.muted || '#64748B',
    marginLeft: 6,
  }
  });
}

export default WithdrawalScreen;