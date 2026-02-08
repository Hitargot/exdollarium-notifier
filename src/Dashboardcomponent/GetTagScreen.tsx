import React, { useEffect, useState, useRef, useMemo } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Linking, Platform, 
  ScrollView, RefreshControl, Animated, Modal, Pressable, Share 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import Constants from 'expo-constants';

import ServicePickerModal from '../components/ServicePickerModal';
import ScreenHeader from '../components/ScreenHeader';
import staticTheme from '../styles/theme';
import { useTheme } from '../theme/index';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../screens/types';
import { showToast } from '../utils/toast';
import { 
  get as cacheGet, 
  set as cacheSet, 
  getLastLoadedAt as cacheGetLastLoadedAt, 
  setFetching as cacheSetFetching, 
  isFetching as cacheIsFetching 
} from '../utils/simpleCache';

type Extra = { apiUrl: string; env: string; };
const extra = Constants.expoConfig?.extra as Extra;
export const API_URL = extra?.apiUrl || '';

type Props = StackScreenProps<RootStackParamList, 'GetTag'>;
const TOOLTIP_KEY = 'seen_gettag_tooltip_v1';

const GetTagScreen: React.FC<Props> = ({ route, navigation }) => {
  const themeCtx = (() => { try { return useTheme(); } catch (e) { return undefined; } })();
  const theme = themeCtx || staticTheme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const serviceNameFromRoute = route?.params?.serviceName ?? '';
  
  const [currentServiceName, setCurrentServiceName] = useState<string>(serviceNameFromRoute);
  const [service, setService] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState<boolean>(false);
  const [showModal, setShowModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [pickerServices, setPickerServices] = useState<any[] | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);

  const pulse = useRef(new Animated.Value(1)).current;

  // --- Helper Component (Moved Inside to fix 'styles' error) ---
  const InfoItem = ({ icon, label, value, half, isLast }: any) => (
    <View style={[styles.infoItem, half && { flex: 1 }, isLast && { borderBottomWidth: 0 }]}>
      <View style={styles.infoLabelRow}>
        <MaterialIcons name={icon} size={16} color={theme.colors.primary} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value || 'N/A'}</Text>
    </View>
  );

  // --- Logic ---
  const fetchServiceDetails = async (isRefresh = false) => {
    if (!currentServiceName) return;
    const key = `service:${currentServiceName}`;
    const TTL = 5 * 60 * 1000;

    if (!isRefresh) {
      const cached = cacheGet(key);
      const last = cacheGetLastLoadedAt(key);
      if (cached && last && (Date.now() - last) <= TTL) {
        setService(cached);
        setLoading(false);
        return;
      }
    }

    try {
      cacheSetFetching(key, true);
      const res = await fetch(`${API_URL}/api/services/${encodeURIComponent(currentServiceName)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch service');
      setService(data);
      cacheSet(key, data);
    } catch (error: any) {
      showToast(error.message || 'Failed to load service');
    } finally {
      cacheSetFetching(key, false);
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchServiceDetails(); }, [currentServiceName]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchServiceDetails(true);
  };

  useEffect(() => {
    const checkTooltip = async () => {
      const seen = await AsyncStorage.getItem(TOOLTIP_KEY);
      if (!seen) {
        setTooltipVisible(true);
        setTimeout(async () => {
          setTooltipVisible(false);
          await AsyncStorage.setItem(TOOLTIP_KEY, '1');
        }, 4000);
      }
    };
    checkTooltip();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
      { iterations: 4 }
    ).start();
  }, []);

  const handleCopy = async (val: string) => {
    if (!val) return;
    await Clipboard.setStringAsync(val);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast('Tag copied to clipboard');
    setTooltipVisible(false);
  };

  const statusColor = service.status === 'valid' ? theme.colors.success : theme.colors.error;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScreenHeader title="Service Details" />
      
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        <TouchableOpacity
          style={styles.pickerTrigger}
          onPress={() => setShowModal(true)}
        >
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.pickerLabel}>Switch Service</Text>
            <Text style={[styles.pickerTriggerText, { flexShrink: 1 }]} numberOfLines={1} ellipsizeMode="tail">
              {currentServiceName || 'Select service'}
            </Text>
          </View>
          <Ionicons name="swap-horizontal" size={20} color={theme.colors.primary} />
        </TouchableOpacity>

        <View style={styles.advancedCard}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{service.name || 'Loading...'}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {service.status === 'valid' ? 'Active & Verified' : 'Currently Inactive'}
                </Text>
              </View>
            </View>
            {service?.isNew && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>NEW</Text>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>Collection Tag</Text>
          <View style={styles.tagContainer}>
            {tooltipVisible && (
              <View style={styles.tooltip}>
                <Text style={styles.tooltipText}>Tap eye to view</Text>
                <View style={styles.tooltipArrow} />
              </View>
            )}
            <Pressable style={styles.tagInner} onPress={() => handleCopy(service.tag)}>
              <Text style={styles.tagText} numberOfLines={1} ellipsizeMode="middle">
                {service.tag || '••••••••••••'}
              </Text>
              <Animated.View style={{ transform: [{ scale: pulse }] }}>
                <TouchableOpacity onPress={() => setShowTagModal(true)} style={styles.eyeBtn}>
                  <Ionicons name="eye" size={20} color={theme.colors.white} />
                </TouchableOpacity>
              </Animated.View>
            </Pressable>
          </View>

          <View style={styles.infoGrid}>
            <InfoItem icon="description" label="Description" value={service.description} />
            <InfoItem icon="attach-money" label="Service Fees" value={service.fees} />
            <View style={styles.row}>
               <InfoItem icon="arrow-downward" label="Min" value={service.minAmount} half />
               <InfoItem icon="arrow-upward" label="Max" value={service.maxAmount} half />
            </View>
            <InfoItem icon="sticky-note-2" label="Important Note" value={service.note} isLast={true} />
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.helpBtn} onPress={() => Linking.openURL('https://t.me/Exdollarium')}>
              <FontAwesome5 name="telegram-plane" size={18} color={theme.colors.primary} />
              <Text style={styles.actionText}>Support</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareBtn} onPress={() => Share.share({ message: `Service: ${service.name}\nTag: ${service.tag}` })}>
              <Ionicons name="share-outline" size={20} color={theme.colors.text} />
              <Text style={[styles.actionText, { color: theme.colors.text }]}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <ServicePickerModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        services={pickerServices || undefined}
        loading={pickerLoading}
        onSelect={(s: any) => {
          const name = typeof s === 'string' ? s : (s.name || s._id);
          setCurrentServiceName(name);
          setShowModal(false);
        }}
      />

      <Modal visible={showTagModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Copy Collection Tag</Text>
            <View style={styles.modalTagBox}>
              <Text style={styles.modalTagText} selectable>{service.tag}</Text>
            </View>
            <View style={styles.modalActions}>
               <TouchableOpacity style={styles.closeBtn} onPress={() => setShowTagModal(false)}>
                <Text style={{ fontWeight: '700' }}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.copyBtn} onPress={() => { handleCopy(service.tag); setShowTagModal(false); }}>
                <Text style={styles.copyBtnText}>Copy Tag</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (t: any) => StyleSheet.create({
  scrollContent: { padding: 20, paddingBottom: 40 },
  pickerTrigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: t.colors.surface, padding: 16, borderRadius: 16,
    marginBottom: 20, borderWidth: 1, borderColor: t.colors.border
  },
  pickerLabel: { fontSize: 10, fontWeight: '800', color: t.colors.muted, textTransform: 'uppercase', marginBottom: 2 },
  pickerTriggerText: { fontSize: 16, fontWeight: '700', color: t.colors.text, flexShrink: 1 },
  advancedCard: {
    backgroundColor: t.colors.surface, borderRadius: 24, padding: 20,
    borderWidth: 1, borderColor: t.colors.border,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 }, android: { elevation: 3 } })
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 22, fontWeight: '900', color: t.colors.text, letterSpacing: -0.5 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  newBadge: { backgroundColor: t.colors.error, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  newBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  divider: { height: 1, backgroundColor: t.colors.border, marginVertical: 20 },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: t.colors.muted, textTransform: 'uppercase', marginBottom: 10 },
  tagContainer: { marginBottom: 25 },
  tagInner: { backgroundColor: t.colors.primary, borderRadius: 14, flexDirection: 'row', alignItems: 'center', padding: 4, paddingLeft: 16 },
  tagText: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  eyeBtn: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 12, borderRadius: 10 },
  infoGrid: { backgroundColor: t.colors.background, borderRadius: 16, padding: 12, marginBottom: 20 },
  infoItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  infoLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  infoLabel: { fontSize: 11, fontWeight: '700', color: t.colors.muted, marginLeft: 6, textTransform: 'uppercase' },
  infoValue: { fontSize: 15, fontWeight: '600', color: t.colors.text, lineHeight: 20 },
  row: { flexDirection: 'row', gap: 12 },
  actionRow: { flexDirection: 'row', gap: 12 },
  helpBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.primary + '10', padding: 14, borderRadius: 14, gap: 8 },
  shareBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.background, borderWidth: 1, borderColor: t.colors.border, padding: 14, borderRadius: 14, gap: 8 },
  actionText: { fontWeight: '800', color: t.colors.primary, fontSize: 14 },
  tooltip: { position: 'absolute', top: -45, alignSelf: 'center', backgroundColor: t.colors.text, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, zIndex: 10 },
  tooltipText: { color: t.colors.surface, fontSize: 11, fontWeight: '700' },
  tooltipArrow: { position: 'absolute', bottom: -5, left: '50%', marginLeft: -5, width: 10, height: 10, backgroundColor: t.colors.text, transform: [{ rotate: '45deg' }] },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: t.colors.surface, borderRadius: 24, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 15 },
  modalTagBox: { backgroundColor: t.colors.background, padding: 20, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: t.colors.border },
  modalTagText: { fontSize: 20, fontWeight: '700', color: t.colors.primary, textAlign: 'center' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  copyBtn: { backgroundColor: t.colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  copyBtnText: { color: '#fff', fontWeight: '800' },
  closeBtn: { paddingHorizontal: 20, paddingVertical: 12 },
});

export default GetTagScreen;