import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet,
  Modal, TextInput, RefreshControl, Linking, NativeModules, Image, ScrollView,
  KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authStorage from '../utils/authStorage';
import * as Clipboard from 'expo-clipboard';
import { MaterialIcons as Icon } from '@expo/vector-icons';

import client, { getPreSubmissions } from '../api/client';
import SkeletonBox from '../components/SkeletonBox';
import ScreenHeader from '../components/ScreenHeader';
import appTheme from '../styles/theme';
import { useTheme } from '../theme/index';
import { showToast } from '../utils/toast';

const MyPreSubmissionsScreen = ({ navigation }: any) => {
  const API_HOST_FALLBACK = Constants.expoConfig?.extra?.apiUrl || 'https://exdollarium-6f0f5aab6a7d.herokuapp.com';
  // --- States ---
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [counts, setCounts] = useState<Record<string, string>>({});

  // Modals Visibility
  const [modalVisible, setModalVisible] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);

  // Form/Selected Data
  const [selected, setSelected] = useState<any | null>(null);
  const [amount, setAmount] = useState('');
  const [files, setFiles] = useState<any[]>([]);
  const [currency, setCurrency] = useState<'USD' | 'EUR' | 'GBP'>('USD');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const themeCtx = useTheme();
  const theme = themeCtx || appTheme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  // --- Logic Helpers ---
  const displayPreId = (it: any) => {
    if (it?.preId) return String(it.preId);
    return `ID-${String(it?._id || '...').slice(-6).toUpperCase()}`;
  };

  // Normalize attachment URLs so local dev hosts and signed URLs work on device
  const normalizeUrl = (raw?: string | null) => {
    if (!raw) return '';
    let u = String(raw).trim();
    // leading colon port ':22222/...' -> join with current host
    if (u.startsWith(':')) {
      const host = (typeof window !== 'undefined' && (window as any).location && (window as any).location.hostname) ? (window as any).location.hostname : 'localhost';
      return `http://${host}${u}`;
    }
    if (/^https?:\/\//i.test(u)) {
      if (/localhost|127\.0\.0\.1/.test(u) && /^https:\/\//i.test(u)) {
        u = u.replace(/^https:\/\//i, 'http://');
      }
      // prefer configured apiUrl host when expo provides it
      try {
        const extras = (Constants.expoConfig && (Constants.expoConfig as any).extra) || {};
        const apiBase = extras.apiUrl || extras.API_URL || '';
        if (apiBase && /localhost|127\.0\.0\.1/.test(u)) {
          try {
            const parsed = new URL(String(apiBase));
            const hostWithPort = parsed.host;
            u = u.replace(/localhost(:\d+)?|127\.0\.0\.1(:\d+)?/i, hostWithPort);
          } catch (e) {}
        }
      } catch (e) {}
      return u;
    }
    // relative path: join with apiBase if available
    try {
      const extras = (Constants.expoConfig && (Constants.expoConfig as any).extra) || {};
      const apiBase = extras.apiUrl || '';
      if (u.startsWith('/') && apiBase) {
        let base = String(apiBase).replace(/\/$/, '');
        if (/localhost|127\.0\.0\.1/.test(base) && /^https:\/\//i.test(base)) base = base.replace(/^https:\/\//i, 'http://');
        return base + u;
      }
    } catch (e) {}
    return u;
  };

  const fetchItems = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await getPreSubmissions();
      const data = res.preSubmissions || res.data || res || [];
      setItems(data || []);
    } catch (e) {
      showToast('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const next: Record<string, string> = {};
      items.forEach((it) => {
        const remainingMs = (24 * 60 * 60 * 1000) - (Date.now() - new Date(it.createdAt).getTime());
        if (remainingMs > 0) {
          const hrs = Math.floor(remainingMs / 3600000);
          const mins = Math.floor((remainingMs % 3600000) / 60000);
          next[it._id] = `${hrs}h ${mins}m`;
        } else { next[it._id] = 'Ready'; }
      });
      setCounts(next);
    }, 1000);
    return () => clearInterval(interval);
  }, [items]);

  // --- Actions ---
  const handleCompleteSubmit = async () => {
    if (!selected || !amount || files.length === 0) return showToast('Fill all fields and attach files');
    setCompletingId(selected._id);
    try {
      const form = new FormData();
      // send numeric amount and a human-friendly display that includes the currency
      form.append('amount', amount);
      form.append('currency', currency);
      const currencySymbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' };
      const display = `${currency} ${currencySymbols[currency] || ''}${Number(amount).toFixed(2)}`.replace(/\s+/g, ' ').trim();
      form.append('amountDisplay', display);
      files.forEach(f => form.append('files', {
        uri: f.uri,
        name: f.name || 'proof.jpg',
        type: f.mimeType || 'image/jpeg'
      } as any));

      // Use fetch for multipart uploads to avoid axios/FormData issues in React Native
      const extras = (Constants.expoConfig && (Constants.expoConfig as any).extra) || {};
      const rawApi = extras.apiUrl || extras.API_URL || '';
      let base = String(rawApi).trim().replace(/\/+$/, '');
      // fall back to api client baseURL when present
      if (!base && (client && (client as any).defaults && (client as any).defaults.baseURL)) {
        base = (client as any).defaults.baseURL;
      }
      const url = base ? `${base.replace(/\/+$/, '')}/api/pre-submissions/${selected._id}/complete` : `${API_HOST_FALLBACK}/api/pre-submissions/${selected._id}/complete`;

      // Prefer secure storage token when available
      let token: string | null | undefined = null;
      try { token = await authStorage.getToken(); } catch (e) { token = null; }
      if (!token) {
        try { token = await AsyncStorage.getItem('jwtToken'); } catch (e) { /* ignore */ }
      }

      const headers: any = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const resp = await fetch(url, { method: 'POST', headers, body: form as any });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) throw data || new Error('complete pre-submission failed');

      setModalVisible(false);
      fetchItems({ silent: true });
      navigation.navigate('SuccessScreen', { message: 'Submission Completed' });
    } catch (e) {
      showToast('Failed to complete');
    } finally {
      setCompletingId(null);
    }
  };

  const handleCancelSubmit = async () => {
    if (!selected || cancelReason.length < 3) return showToast('Provide a reason (min 3 chars)');
    setCancelSubmitting(true);
    try {
      const response = await client.post(`/api/pre-submissions/${selected._id}/cancel`, { reason: cancelReason });
      // Ensure we check the response data for success, as some HTTP clients might not throw for all non-2xx statuses
      if (response.data && response.data.success) {
        setCancelModalVisible(false);
        fetchItems(); // Refetch the list to show the "Cancelled" status
        showToast('Cancelled successfully');
      } else {
        // Handle cases where the server responds with a success=false message
        throw new Error(response.data.message || 'Cancellation failed');
      }
    } catch (e: any) {
      // Log the actual error for debugging and show a generic message
      console.error('Cancellation error:', e);
      const message = e.response?.data?.message || e.message || 'Cancel failed';
      showToast(message);
    } finally {
      setCancelSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const awaitLabel = counts[item._id] || '...';
    const isReady = awaitLabel === 'Ready';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.username[0].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{item.username}</Text>
            <Text style={styles.cardSubtitle}>{item.serviceId?.name || 'Standard Service'}</Text>
          </View>
          <View style={[styles.badge, item.status === 'Completed' ? styles.badgeSuccess : item.status === 'Cancelled' ? styles.badgeError : styles.badgePending]}>
            <Text style={[styles.badgeText, item.status === 'Completed' ? styles.textSuccess : item.status === 'Cancelled' ? styles.textError : styles.textPending]}>
              {item.status}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <TouchableOpacity style={styles.viewBtn} onPress={() => { setSelected(item); setDetailsModalVisible(true); }}>
            <Icon name="visibility" size={18} color={theme.colors.primary} />
            <Text style={styles.viewBtnText}>View</Text>
          </TouchableOpacity>

          {item.status === 'Pending' && (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {isReady && (
                <TouchableOpacity style={styles.cancelLink} onPress={() => { setSelected(item); setCancelModalVisible(true); }}>
                  <Text style={{ color: theme.colors.error, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.primaryAction, !isReady && { backgroundColor: '#E2E8F0' }]}
                disabled={!isReady}
                onPress={() => { setSelected(item); setAmount(''); setFiles([]); setModalVisible(true); }}
              >
                <Text style={[styles.primaryActionText, !isReady && { color: '#94A3B8' }]}>
                  {isReady ? 'Complete' : awaitLabel}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="My Pre-Submissions" />

      {loading && !refreshing ? (
        <View style={{ padding: 16 }}>
          {[1, 2, 3].map(i => <SkeletonBox key={i} height={120} width="100%" radius={20} style={{ marginBottom: 16 }} shimmer />)}
        </View>
      ) : (
        items.length === 0 ? (
          <View style={{ padding: 16, paddingTop: 40 }}>
            <Text style={styles.emptyText}>You have no pre-submissions yet.</Text>
            <Text style={[styles.emptyText, { marginTop: 8 }]}>Pre-submissions appear here after you create one. Tap "New Submission" to get started.</Text>
            <TouchableOpacity
              style={[styles.primaryAction, { alignSelf: 'center', marginTop: 20, paddingHorizontal: 20 }]}
              onPress={() => navigation.navigate('TradeConfirmation' as any, { serviceName: '' })}
            >
              <Text style={styles.primaryActionText}>Create Confirmation</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={items}
            renderItem={renderItem}
            keyExtractor={item => item._id}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchItems()} />}
          />
        )
      )}


      {/* COMPLETE MODAL */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.premiumModal}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Complete Submission</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Icon name="close" size={24} color="#94A3B8" /></TouchableOpacity>
            </View>

            <View style={styles.currencyRow}>
              {['USD', 'EUR', 'GBP'].map(c => (
                <TouchableOpacity key={c} onPress={() => setCurrency(c as any)} style={[styles.currBtn, currency === c && styles.currBtnActive]}>
                  <Text style={{ color: currency === c ? '#FFF' : theme.colors.primary, fontWeight: '700' }}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              placeholder="0.00"
              style={styles.premiumInput}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />

            <TouchableOpacity style={styles.uploadArea} onPress={async () => {
              const res = await DocumentPicker.getDocumentAsync({ multiple: true });
              if (!res.canceled) setFiles(res.assets);
            }}>
              <Icon name="cloud-upload" size={32} color={theme.colors.primary} />
              <Text style={styles.uploadText}>{files.length ? `${files.length} Files Selected` : 'Tap to Upload Proof'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.submitFull} onPress={handleCompleteSubmit} disabled={!!completingId}>
              {completingId ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitFullText}>Finish Submission</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* CANCEL MODAL */}
      <Modal visible={cancelModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={80}>
          <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); }}>
            <View style={styles.modalOverlay}>
              <View style={styles.premiumModal}>
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>Reason for Cancellation</Text>
                  <TouchableOpacity onPress={() => setCancelModalVisible(false)}>
                    <Icon name="close" size={24} color={theme.dark ? '#fff' : '#94A3B8'} />
                  </TouchableOpacity>
                </View>

                <TextInput
                  placeholder="Why are you cancelling this?"
                  multiline
                  style={styles.premiumTextArea}
                  value={cancelReason}
                  onChangeText={setCancelReason}
                  textAlignVertical="top"
                  autoFocus={false}
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.btnSecondary} onPress={() => setCancelModalVisible(false)}><Text>Back</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: theme.colors.error }]} onPress={handleCancelSubmit}>
                    {cancelSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Confirm Cancel</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* VIEW DETAILS MODAL */}
      <Modal visible={detailsModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.premiumModal, { maxHeight: '85%' }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Submission Details</Text>
              <TouchableOpacity onPress={() => setDetailsModalVisible(false)}><Icon name="close" size={24} color="#94A3B8" /></TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Basic Info */}
              <DetailBox label="Username" value={selected?.username} icon="person" />
              <DetailBox label="Unique ID" value={displayPreId(selected)} icon="fingerprint" copyable />

              {/* Service Info */}
              <DetailBox label="Service Name" value={selected?.serviceId?.name} icon="layers" />
              <DetailBox
                label="Service Tag"
                value={selected?.serviceTag || selected?.serviceId?.tag || 'N/A'}
                icon="local-offer"
              />

              {/* Status & Timing */}
              <DetailBox label="Status" value={selected?.status} icon="info" isStatus />
              <DetailBox
                label="Date Submitted"
                value={selected?.createdAt ? new Date(selected.createdAt).toLocaleString() : 'N/A'}
                icon="event"
              />

              <Text style={styles.sectionTitle}>Attached Proofs</Text>
              {selected?.fileUrls?.length > 0 ? selected.fileUrls.map((url: string, i: number) => {
                // Use your existing normalizeUrl logic to ensure the path is correct
                const finalUrl = normalizeUrl(url);

                return (
                  <TouchableOpacity
                    key={i}
                    style={styles.fileCard}
                    onPress={() => {
                      setDetailsModalVisible(false); // Close modal before navigating for smoother transition
                      navigation.navigate('ImagePreview', { url: finalUrl });
                    }}
                  >
                    <Icon name="insert-photo" size={20} color={theme.colors.primary} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.fileCardText}>View Document {i + 1}</Text>
                      <Text style={{ fontSize: 10, color: theme.colors.muted }}>Tap to preview</Text>
                    </View>
                    <Icon name="chevron-right" size={20} color={theme.colors.muted || "#94A3B8"} />
                  </TouchableOpacity>
                );
              }) : (
                <Text style={styles.emptyText}>No files attached</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// --- Custom Sub-Components ---
const DetailBox = ({ label, value, icon, copyable }: any) => {
  const theme = useTheme() || appTheme;
  const styles = createStyles(theme);
  return (
    <View style={styles.detailBox}>
      <Icon name={icon} size={18} color="#94A3B8" style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value || 'N/A'}</Text>
      </View>
      {copyable && (
        <TouchableOpacity onPress={() => { Clipboard.setStringAsync(value); showToast('Copied to clipboard'); }}>
          <Icon name="content-copy" size={18} color={theme.colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

// --- Styles ---
// --- Styles ---
const createStyles = (theme: any) => StyleSheet.create({
  // Main screen container
  container: { 
    flex: 1, 
    backgroundColor: theme.colors.background 
  },

  // Premium Card Layout
  card: { 
    backgroundColor: theme.colors.surface, 
    borderRadius: 24, 
    padding: 20, 
    marginBottom: 16, 
    marginHorizontal: 2, 
    elevation: 4, 
    shadowColor: theme.dark ? '#000' : '#0F172A', 
    shadowOpacity: theme.dark ? 0.3 : 0.08, 
    shadowRadius: 12, 
    shadowOffset: { width: 0, height: 6 },
    borderWidth: theme.dark ? 1 : 0,
    borderColor: theme.colors.border
  },
  cardHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 20 
  },
  avatar: { 
    width: 48, 
    height: 48, 
    borderRadius: 16, 
    backgroundColor: theme.colors.primary + '15', // Subtle primary tint
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 14 
  },
  avatarText: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: theme.colors.primary 
  },
  cardTitle: { 
    fontSize: 17, 
    fontWeight: '700', 
    color: theme.colors.text 
  },
  cardSubtitle: { 
    fontSize: 13, 
    color: theme.colors.muted, 
    marginTop: 2 
  },

  // Badge System with Dynamic Opacity
  badge: { 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 12 
  },
  badgePending: { backgroundColor: '#FEF3C720' }, // 20% opacity Amber
  badgeSuccess: { backgroundColor: '#DCFCE720' }, // 20% opacity Green
  badgeError: { backgroundColor: '#FEE2E220' },   // 20% opacity Red
  badgeText: { 
    fontSize: 11, 
    fontWeight: '800', 
    textTransform: 'uppercase' 
  },
  textPending: { color: '#D97706' },
  textSuccess: { color: '#16A34A' },
  textError: { color: '#DC2626' },

  // Interactive Elements
  cardFooter: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    borderTopWidth: 1, 
    borderTopColor: theme.colors.border, 
    paddingTop: 16 
  },
  viewBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: theme.colors.backgroundAlt, 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 10 
  },
  viewBtnText: { 
    marginLeft: 6, 
    fontWeight: '700', 
    color: theme.colors.primary 
  },
  primaryAction: { 
    backgroundColor: theme.colors.primary, 
    paddingHorizontal: 18, 
    paddingVertical: 10, 
    borderRadius: 14 
  },
  primaryActionText: { 
    color: '#FFF', 
    fontWeight: '800' 
  },
  cancelLink: { 
    marginRight: 16 
  },

  // Modal Styling
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0, 0, 0, 0.7)', 
    justifyContent: 'flex-end' 
  },
  premiumModal: { 
    backgroundColor: theme.colors.surface, 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    padding: 28, 
    paddingBottom: 40,
    borderTopWidth: theme.dark ? 1 : 0,
    borderColor: theme.colors.border
  },
  modalHeaderRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 24 
  },
  modalTitle: { 
    fontSize: 22, 
    fontWeight: '800', 
    color: theme.colors.text 
  },

  // Forms & Inputs
  premiumInput: { 
    backgroundColor: theme.colors.backgroundAlt, 
    borderRadius: 16, 
    padding: 20, 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: theme.colors.text, 
    marginBottom: 20, 
    borderWidth: 1, 
    borderColor: theme.colors.border 
  },
  premiumTextArea: { 
    backgroundColor: theme.colors.backgroundAlt, 
    borderRadius: 16, 
    padding: 16, 
    height: 120, 
    textAlignVertical: 'top', 
    marginBottom: 24, 
    fontSize: 16,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  uploadArea: { 
    borderStyle: 'dashed', 
    borderWidth: 2, 
    borderColor: theme.colors.primary + '40', 
    borderRadius: 20, 
    padding: 30, 
    alignItems: 'center', 
    marginBottom: 24, 
    backgroundColor: theme.colors.primary + '05' 
  },
  uploadText: { 
    marginTop: 10, 
    fontWeight: '600', 
    color: theme.colors.primary 
  },

  // Detail View Layout
  detailBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: theme.colors.backgroundAlt, 
    padding: 16, 
    borderRadius: 16, 
    marginBottom: 12 
  },
  detailLabel: { 
    fontSize: 11, 
    color: theme.colors.muted, 
    textTransform: 'uppercase', 
    letterSpacing: 0.5 
  },
  detailValue: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: theme.colors.text, 
    marginTop: 2 
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: '800', 
    color: theme.colors.text, 
    marginTop: 20, 
    marginBottom: 12 
  },

  // File Preview Cards
  fileCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: theme.colors.surface, 
    padding: 14, 
    borderRadius: 14, 
    marginBottom: 8, 
    borderWidth: 1, 
    borderColor: theme.colors.border 
  },
  fileCardText: { 
    flex: 1, 
    marginLeft: 12, 
    fontWeight: '600', 
    color: theme.colors.text 
  },

  // Utility Buttons
  btnPrimary: { 
    flex: 1, 
    padding: 16, 
    borderRadius: 16, 
    alignItems: 'center', 
    marginLeft: 6 
  },
  btnSecondary: { 
    flex: 1, 
    backgroundColor: theme.colors.backgroundAlt, 
    padding: 16, 
    borderRadius: 16, 
    alignItems: 'center', 
    marginRight: 6 
  },
  currBtn: { 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 12, 
    marginRight: 8, 
    backgroundColor: theme.colors.backgroundAlt 
  },
  currBtnActive: { 
    backgroundColor: theme.colors.primary 
  },
  
  emptyText: { 
    color: theme.colors.muted, 
    fontStyle: 'italic', 
    textAlign: 'center', 
    marginVertical: 10 
  }
  ,
  // Small modal/button styles referenced in the component
  currencyRow: { flexDirection: 'row', marginTop: 12, marginBottom: 12 },
  submitFull: { backgroundColor: theme.colors.primary, padding: 14, borderRadius: 12, alignItems: 'center' },
  submitFullText: { color: '#FFF', fontWeight: '800' },
  modalButtons: { flexDirection: 'row', marginTop: 16 }
});

export default MyPreSubmissionsScreen;