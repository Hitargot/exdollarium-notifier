import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Pressable, ScrollView, KeyboardAvoidingView, Platform, Share, ActivityIndicator
} from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../screens/types';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import staticTheme from '../styles/theme';
import { useTheme } from '../theme/index';
import { pickContrastText } from '../theme/colorUtils';
import ServicePickerModal from '../components/ServicePickerModal';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { showToast } from '../utils/toast';
import Constants from 'expo-constants';

type Extra = { apiUrl: string; env: string; };
const extra = Constants.expoConfig?.extra as Extra;
export const API_URL = extra?.apiUrl || '';

type Props = StackScreenProps<RootStackParamList, 'Calculator'>;
type NavigationProp = StackNavigationProp<RootStackParamList, 'Calculator'>;

const CalculatorScreen: React.FC<Props> = ({ route }) => {
  const serviceNameParam = route?.params?.serviceName ?? '';
  const navigation = useNavigation<NavigationProp>();
  
  const themeCtx = (() => { try { return useTheme(); } catch (e) { return undefined; } })();
  const theme = themeCtx || staticTheme;
  const styles = useStyles(theme);

  // States
  const [services, setServices] = useState<string[]>([]);
  const [selectedService, setSelectedService] = useState<string>(serviceNameParam);
  const [selectedServiceLabel, setSelectedServiceLabel] = useState<string>('');
  const [selectedServiceLabelLoading, setSelectedServiceLabelLoading] = useState<boolean>(false);
  const [serviceData, setServiceData] = useState<any>(null);
  const [amount, setAmount] = useState<string>('');
  const [amountDisplay, setAmountDisplay] = useState<string>('');
  const [targetCurrency, setTargetCurrency] = useState<'usd' | 'eur' | 'gbp'>('usd');
  const [showModal, setShowModal] = useState(false);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);

  // Initial Data Fetch
  useEffect(() => {
    fetchServices();
    if (serviceNameParam) {
      hydrateServiceLabel(serviceNameParam);
    }
  }, []);

  // Fetch details when service changes
  useEffect(() => {
    if (selectedService) fetchServiceDetails();
  }, [selectedService]);

  const hydrateServiceLabel = async (name: string) => {
    setSelectedServiceLabelLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/services/${encodeURIComponent(name)}`);
      if (res.ok) {
        const s = await res.json();
        setSelectedServiceLabel((s.label || s.name || '') + (s.isNew ? ' (NEW)' : ''));
      } else {
        const listRes = await fetch(`${API_URL}/api/services`);
        if (listRes.ok) {
          const arr = await listRes.json();
          const found = arr.find((x: any) => x._id === name || x.name === name);
          if (found) setSelectedServiceLabel((found.label || found.name || '') + (found.isNew ? ' (NEW)' : ''));
        }
      }
    } catch (e) {
      setSelectedServiceLabel('');
    } finally {
      setSelectedServiceLabelLoading(false);
    }
  };

  const fetchServices = async () => {
    setIsLoadingServices(true);
    try {
      const res = await fetch(`${API_URL}/api/services`);
      const data = await res.json();
      setServices(data.map((s: any) => s.name));
    } catch {
      showToast('Could not load services');
    } finally {
      setIsLoadingServices(false);
    }
  };

  const fetchServiceDetails = async () => {
    setIsFetchingRate(true);
    try {
      const res = await fetch(`${API_URL}/api/services/${selectedService}`);
      const data = await res.json();
      setServiceData(data);
      // Reset currency if new service doesn't support current target
      if (selectedService === 'Website Recharge') setTargetCurrency('usd');
    } catch {
      showToast('Failed to fetch service details');
    } finally {
      setIsFetchingRate(false);
    }
  };

  const formatNumber = (n?: number | string) => {
    if (n === undefined || n === null || n === '') return '—';
    const num = typeof n === 'string' ? Number(n) : n;
    return isNaN(num) ? '—' : num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const calculateConversion = useMemo(() => {
    const rate = serviceData?.exchangeRates?.[targetCurrency];
    if (!rate) return null;

    let ngnEquivalent = 0;
    if (selectedService === 'Website Recharge') {
      const multipliers: Record<number, number> = { 5: 1, 10: 2, 20: 3, 30: 4, 50: 5 };
      if (selectedAmount && multipliers[selectedAmount]) {
        ngnEquivalent = rate * multipliers[selectedAmount];
      } else return null;
    } else {
      if (!amount || isNaN(Number(amount))) return null;
      ngnEquivalent = parseFloat(amount) * rate;
    }
    return Number(ngnEquivalent.toFixed(2));
  }, [serviceData, targetCurrency, selectedAmount, amount, selectedService]);

  const handleShare = async () => {
    const converted = calculateConversion;
    const core = `💱 Conversion Details\nService: ${selectedService}\nAmount: ${selectedService === 'Website Recharge' ? selectedAmount : amount} ${targetCurrency.toUpperCase()}\nReceiving: ₦${converted ? formatNumber(converted) : '—'}\nRate: ₦${currentRate ? formatNumber(currentRate) : '—'}`;
    const message = `Shared via Exdollarium\n\n${core}`;
    try {
      await Share.share({ message });
    } catch {
      showToast('Failed to share');
    }
  };

  const currentRate = serviceData?.exchangeRates?.[targetCurrency];
  const convertedValue = calculateConversion;

  return (
    <>
      <ScreenHeader title="Converter" backgroundColor={theme.colors.surface} />
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {/* Service Selector */}
          <TouchableOpacity
            style={[styles.serviceSelectorTop, isLoadingServices && styles.serviceSelectorDisabled]}
            onPress={() => setShowModal(true)}
            activeOpacity={0.8}
          >
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.labelSmall}>Active Service</Text>
                <Text style={[styles.serviceSelectorTextTop, { flexShrink: 1 }]} numberOfLines={1} ellipsizeMode="tail">
                  {selectedServiceLabel || (selectedServiceLabelLoading ? 'Loading...' : (selectedService || 'Choose a service'))}
                </Text>
              </View>
            <Ionicons name="chevron-down-circle" size={24} color={theme.colors.primary} />
          </TouchableOpacity>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.title}>Live Rates</Text>
                <Text style={styles.subtitle}>Fast conversion based on current market</Text>
              </View>
              {isFetchingRate && <ActivityIndicator size="small" color={theme.colors.primary} />}
            </View>

            {/* Currency Switcher */}
            <View style={styles.currencyRow}>
              {['usd', 'eur', 'gbp'].map((cur) => {
                const isUSDOnly = selectedService === 'Website Recharge' && cur !== 'usd';
                if (isUSDOnly) return null;

                return (
                  <Pressable
                    key={cur}
                    style={[styles.currencyBtn, targetCurrency === cur && styles.currencyBtnActive]}
                    onPress={() => setTargetCurrency(cur as any)}
                  >
                    <Text style={[styles.currencyText, targetCurrency === cur && styles.currencyTextActive]}>
                      {cur.toUpperCase()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.rateText}>
              {selectedService === 'Website Recharge'
                ? `Base Rate (5 USD) = ₦${currentRate ? formatNumber(currentRate) : '—'}`
                : `1 ${targetCurrency.toUpperCase()} = ₦${currentRate ? formatNumber(currentRate) : '—'}`}
            </Text>

            {/* Input Section */}
            {selectedService === 'Website Recharge' ? (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.label}>Select Package Amount (USD)</Text>
                <View style={styles.amountOptions}>
                  {[5, 10, 20, 30, 50].map((val) => (
                    <TouchableOpacity
                      key={val}
                      onPress={() => setSelectedAmount(val)}
                      style={[styles.amountBtn, selectedAmount === val && styles.amountBtnActive]}
                    >
                      <Text style={[styles.amountText, selectedAmount === val && styles.amountTextActive]}>
                        ${val}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.label}>Enter amount ({targetCurrency.toUpperCase()})</Text>
                <TextInput
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.muted}
                  keyboardType="decimal-pad"
                  style={styles.input}
                  value={amountDisplay}
                  onChangeText={(t) => {
                    const raw = t.replace(/[^0-9.]/g, '');
                    setAmount(raw);
                    try { setAmountDisplay(require('../utils/numberFormat').formatWithCommas(raw)); } catch { setAmountDisplay(raw); }
                  }}
                />
              </View>
            )}

            {/* Result Area */}
            <View style={[styles.resultCard, convertedValue ? { borderColor: theme.colors.primary + '40' } : {}]}>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Estimated Payout</Text>
                <View style={styles.ngnBadge}>
                   <Text style={styles.ngnBadgeText}>NGN</Text>
                </View>
              </View>
              <Text style={styles.resultValueLarge}>
                {convertedValue ? `₦${formatNumber(convertedValue)}` : '₦ 0.00'}
              </Text>
              <View style={styles.divider} />
              <Text style={styles.breakdown}>
                Rate: ₦{currentRate ? formatNumber(currentRate) : '—'} • 
                Service: {selectedServiceLabel || selectedService || 'None'}
              </Text>
            </View>
          </View>

          <Text style={styles.commentText}>
            🚀 Ready when you are. Convert and continue in a flash.
          </Text>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.shareBtn, !convertedValue && styles.btnDisabled]}
              onPress={handleShare}
              disabled={!convertedValue}
            >
              <Ionicons name="share-social-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.btnText, { color: theme.colors.primary }]}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, !convertedValue && styles.btnDisabled]}
              onPress={() => convertedValue && navigation.navigate('GetTag', { serviceName: selectedService })}
              disabled={!convertedValue}
            >
              <Text style={styles.btnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={20} color={theme.colors.white} />
            </TouchableOpacity>
          </View>

          <ServicePickerModal
            visible={showModal}
            onClose={() => setShowModal(false)}
            onSelect={(s: any) => {
              const name = typeof s === 'string' ? s : (s.name || s._id || '');
              const label = typeof s === 'string' ? '' : (s.label || s.name || '');
              setSelectedService(name);
              setSelectedServiceLabel(label);
              setShowModal(false);
            }}
            services={services}
            loading={isLoadingServices}
            title="Select a Service"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
};

const useStyles = (theme: any) => StyleSheet.create({
  scrollContent: { padding: 20, paddingBottom: 60 },
  labelSmall: { fontSize: 10, fontWeight: '800', color: theme.colors.muted, textTransform: 'uppercase', marginBottom: 2 },
  serviceSelectorTop: {
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 }, android: { elevation: 2 } })
  },
  serviceSelectorTextTop: { color: theme.colors.text, fontWeight: '800', fontSize: 16, flexShrink: 1 },
  serviceSelectorDisabled: { opacity: 0.6 },
  card: {
    backgroundColor: theme.colors.surface,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.text },
  subtitle: { fontSize: 13, color: theme.colors.muted, marginTop: 2 },
  currencyRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  currencyBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: theme.colors.background, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border },
  currencyBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  currencyText: { fontWeight: '700', color: theme.colors.muted },
  currencyTextActive: { color: theme.colors.white },
  rateText: { fontSize: 12, fontWeight: '700', color: theme.colors.primary, textAlign: 'center', backgroundColor: theme.colors.primary + '10', padding: 8, borderRadius: 8, marginBottom: 20 },
  label: { marginBottom: 10, fontSize: 14, fontWeight: '700', color: theme.colors.text },
  input: { backgroundColor: theme.colors.background, padding: 16, borderRadius: 14, fontSize: 18, fontWeight: '700', color: theme.colors.text, borderWidth: 1, borderColor: theme.colors.border },
  amountOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amountBtn: { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: theme.colors.background, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border },
  amountBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  amountText: { color: theme.colors.text, fontWeight: '700' },
  amountTextActive: { color: theme.colors.white },
  resultCard: { backgroundColor: theme.colors.background, padding: 20, borderRadius: 20, marginTop: 25, borderWidth: 1, borderColor: theme.colors.border },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.muted },
  ngnBadge: { backgroundColor: '#E1F5FE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  ngnBadgeText: { color: '#0288D1', fontSize: 10, fontWeight: '900' },
  resultValueLarge: { fontSize: 32, fontWeight: '900', color: theme.colors.text, marginTop: 10 },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 15 },
  breakdown: { color: theme.colors.muted, fontSize: 11, fontWeight: '500' },
  commentText: { textAlign: 'center', fontSize: 13, color: theme.colors.muted, marginTop: 30, paddingHorizontal: 20 },
  buttonRow: { flexDirection: 'row', marginTop: 20, gap: 12 },
  actionBtn: { flex: 1.5, flexDirection: 'row', backgroundColor: theme.colors.primary, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', gap: 8 },
  shareBtn: { flex: 1, backgroundColor: 'transparent', borderWidth: 2, borderColor: theme.colors.primary },
  btnText: { color: theme.colors.white, fontWeight: '800', fontSize: 16 },
  btnDisabled: { opacity: 0.4 },
});

export default CalculatorScreen;