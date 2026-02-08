import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, Modal, FlatList, 
  StyleSheet, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import ScreenHeader from '../components/ScreenHeader';
import VerifyMatches from '../components/VerifyMatches';
import VerifyLoading from '../components/VerifyLoading';
import { showToast } from '../utils/toast';
import { useTheme } from '../theme/index';
import appTheme from '../styles/theme';
import authStorage from '../utils/authStorage';
import axios from 'axios';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra as { apiUrl: string };
const API_URL = extra.apiUrl;

const AddBankScreen = ({ navigation }: any) => {
  const [bankList, setBankList] = useState<any[]>([]);
  const [bankName, setBankName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [showList, setShowList] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [matchingBanks, setMatchingBanks] = useState<any[]>([]);
  const [resolveError, setResolveError] = useState('');

  const t = useTheme() || appTheme;
  const styles = useMemo(() => createStyles(t), [t]);

  useEffect(() => { fetchBanks(); }, []);

  // no auto-hide: keep resolveError visible until user dismisses or a successful resolve

  useEffect(() => {
    const acctLen = accountNumber.replace(/\D/g, '').length;
    // Clear the inline resolve error when the user clears the account number
    if (acctLen === 0) {
      try { setResolveError(''); } catch (e) { /* ignore */ }
    }
    if (bankCode && acctLen === 10) {
      resolve();
    } else { setAccountName(''); setMatchingBanks([]); }
  }, [bankCode, accountNumber]);

  const fetchBanks = async () => {
    try {
      const token = await authStorage.getToken();
      const res = await axios.get(`${API_URL}/api/banks`, { headers: { Authorization: `Bearer ${token}` }});
      setBankList(res.data.sort((a: any, b: any) => a.name.localeCompare(b.name)));
    } catch (e) { showToast('Banks unavailable'); }
  };

  const resolve = async () => {
    setResolving(true);
    try {
      const token = await authStorage.getToken();
      const res = await axios.post(`${API_URL}/api/wallet/resolve`, { bankCode, accountNumber }, { headers: { Authorization: `Bearer ${token}` }});
      const name = res.data.accountName || '';
      if (!name) {
        setAccountName('');
        // Primary UX: in-app toast. Also show a fallback alert to ensure visibility
        showToast('Account number does not match the selected bank. Please check and try again.');
        // Also show an inline message next to the verification area (persistent until dismissed)
        try { setResolveError('Account number does not match the selected bank. Please check and try again.'); } catch (e) { /* ignore */ }
        try { Alert.alert('', 'Account number does not match the selected bank. Please check and try again.'); } catch (e) { /* ignore */ }
      } else {
        setAccountName(name);
        // clear error when a valid name is found
        setResolveError('');
      }
    } catch (e) { 
      setAccountName(''); 
      // resolve error
      // Show a visible error for network/exception cases as well (persistent until dismissed)
      try {
        const msg = 'Account number could not be verified. Please check and try again.';
        showToast(msg);
        setResolveError(msg);
      } catch (err) { /* ignore */ }
    } finally { setResolving(false); }
  };

  const checkDuplicates = async () => {
    if (!accountName) return showToast('Fill all fields');
    try {
      const token = await authStorage.getToken();
      const res = await axios.get(`${API_URL}/api/wallet/banks`, { headers: { Authorization: `Bearer ${token}` }});
      const matches = (res.data.banks || []).filter((b: any) => b.accountNumber === accountNumber && b.bankCode === bankCode);
      if (matches.length > 0) {
          setMatchingBanks(matches);
          return;
      }
      setConfirmVisible(true);
    } catch (e) { setConfirmVisible(true); }
  };

  const submitToServer = async () => {
    setConfirmVisible(false);
    setSubmitting(true);
    try {
      const token = await authStorage.getToken();
      const acctNorm = (accountNumber || '').replace(/\D/g, '');
      const res = await axios.post(`${API_URL}/api/wallet/banks`, 
        { bankName, accountNumber: acctNorm, accountName, bankCode }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showToast('Bank added');
      navigation.navigate('WithdrawalFormScreen', { selectedBank: res.data.bank });
    } catch (err: any) {
      if (err.response?.status === 409) {
        showToast('Account already exists. Continuing...');
        // Try to resolve the existing bank record (so we can provide a valid _id for withdrawals)
        try {
          const token = await authStorage.getToken();
          const res = await axios.get(`${API_URL}/api/wallet/banks`, { headers: { Authorization: `Bearer ${token}` } });
          const banks = res.data.banks || [];
          // normalize helper
          const normalize = (s: any) => (String(s || '')).replace(/\D/g, '').replace(/^0+/, '');
          const targetNorm = normalize(accountNumber);

          // try exact normalized accountNumber + bankCode/code
          let found = banks.find((b: any) => normalize(b.accountNumber) === targetNorm && (b.bankCode === bankCode || b.code === bankCode));
          // try loose: match by last 6 digits and bank code
          if (!found && targetNorm.length >= 6) {
            const tail = targetNorm.slice(-6);
            found = banks.find((b: any) => normalize(b.accountNumber).endsWith(tail) && (b.bankCode === bankCode || b.code === bankCode));
          }
          // try match by accountName + bank code
          if (!found && accountName) {
            found = banks.find((b: any) => String(b.accountName || '').toLowerCase().includes(String(accountName || '').toLowerCase()) && (b.bankCode === bankCode || b.code === bankCode));
          }

          if (found) {
            navigation.navigate('WithdrawalFormScreen', { selectedBank: found });
          } else {
            // If we couldn't find a matching saved bank, surface the user's saved banks so they can pick one
            setMatchingBanks(banks);
            showToast('Account already exists in your saved banks. Please select it from the list below.');
            // open the confirm/modal area by leaving confirmVisible false; VerifyMatches at the bottom will show the list
          }
        } catch (e) {
          // if resolving fails, surface an instructive message and don't navigate with a partial object
          showToast('Could not find the existing bank record. Please try selecting a saved bank from your wallet.');
        }
      } else {
        showToast('Failed to add bank');
      }
    } finally { setSubmitting(false); }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Add Bank Account" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {/* Section 1: Bank Selection */}
          <View style={styles.inputSection}>
            <Text style={styles.label}>Financial Institution</Text>
            <TouchableOpacity 
              activeOpacity={0.7}
              onPress={() => setShowList(!showList)} 
              style={[styles.inputBox, showList && styles.activeInput]}
            >
              <Text style={[styles.inputText, !bankName && { color: t.colors?.mutedLight || '#94A3B8' }]}>
                {bankName || 'Select a bank'}
              </Text>
              <Ionicons name={showList ? "chevron-up" : "chevron-down"} size={20} color={t.colors?.muted} />
            </TouchableOpacity>

            {/* Bank list moved into a modal to avoid nesting VirtualizedList inside ScrollView */}
            <Modal visible={showList} transparent animationType="slide">
              <View style={styles.bankModalOverlay}>
                <View style={styles.bankModalSheet}>
                  <View style={styles.sheetHandle} />
                  <View style={styles.bankModalHeader}>
                    <TextInput
              placeholder="Search banks..."
              placeholderTextColor={t.colors?.muted || '#94A3B8'}
                      onChangeText={setSearchText}
                      style={[styles.searchBox, { paddingRight: 44 }]}
                      autoFocus
                    />
                    <TouchableOpacity onPress={() => setShowList(false)} style={styles.closeBanksBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Ionicons name="close" size={20} color={t.colors?.muted || '#64748B'} />
                    </TouchableOpacity>
                  </View>
                    <FlatList
                    data={bankList.filter(b => b.name.toLowerCase().includes(searchText.toLowerCase()))}
                    keyExtractor={item => item.code}
                    style={{ maxHeight: 360 }}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        onPress={() => { setBankName(item.name); setBankCode(item.code); setShowList(false); Haptics.selectionAsync(); }}
                        style={styles.bankItem}
                      >
                        <Text style={[styles.bankItemText, { color: t.colors?.text || '#334155' }]}>{item.name}</Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              </View>
            </Modal>
          </View>

          {/* Section 2: Account Details */}
          <View style={styles.inputSection}>
            <Text style={styles.label}>Account Number</Text>
            <View style={styles.inputContainer}>
              <TextInput 
                placeholder="0123456789"
                placeholderTextColor={t.colors?.muted || '#94A3B8'}
                maxLength={10} 
                keyboardType="numeric" 
                value={accountNumber} 
                onChangeText={(v) => { setAccountNumber(v); try { if (resolveError) setResolveError(''); } catch (e) { } }}
                style={styles.cleanInput} 
              />
              {resolving && <ActivityIndicator size="small" color={t.colors.primary} />}
            </View>
          </View>

          {/* Verification Display */}
          <View style={styles.statusSection}>
  {accountName ? (
    <VerifyLoading
      status="success"
      title={accountName}
      message="Verified Account Name"
      small
    />
  ) : (
            <View style={{ flex: 1 }}>
              {resolveError ? (
                <View style={styles.resolveErrorBox}>
                  <Ionicons name="alert-circle-outline" size={16} color={t.colors?.error || '#B00020'} />
                  <Text style={styles.resolveErrorText}>{resolveError}</Text>
                </View>
              ) : (
                <View style={styles.infoBox}>
                  <Ionicons
                    name="information-circle-outline"
                    size={16}
                    color={t.colors?.muted || '#64748B'}
                  />
                  <Text style={styles.infoText}>
                    We'll verify the account name automatically.
                  </Text>
                </View>
              )}
            </View>
  )}

  <VerifyMatches
    matches={matchingBanks}
    onSelect={(m) =>
      navigation.navigate('WithdrawalFormScreen', { selectedBank: m })
    }
  />
</View>

          <TouchableOpacity 
            onPress={checkDuplicates} 
            disabled={!accountName || submitting} 
            style={[styles.mainBtn, !accountName && { opacity: 0.5 }]}
          >
            <Text style={styles.mainBtnText}>Continue</Text>
          </TouchableOpacity>
          
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={confirmVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>Confirm Bank Details</Text>
            <View style={styles.confirmBox}>
              <Text style={styles.confirmLabel}>ACCOUNT NAME</Text>
              <Text style={styles.confirmValue}>{accountName}</Text>
              
              <View style={styles.divider} />
              
              <Text style={styles.confirmLabel}>BANK / ACCOUNT</Text>
              <Text style={styles.confirmValue}>{bankName}</Text>
              <Text style={[styles.confirmValue, { color: t.colors?.muted || '#64748B', fontSize: 14 }]}>{accountNumber}</Text>
            </View>
            
            <TouchableOpacity onPress={submitToServer} style={styles.mainBtn}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.mainBtnText}>Confirm & Save</Text>}
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => setConfirmVisible(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Back to edit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {matchingBanks.length > 0 && (
        <VerifyLoading
            status="exists"
            title="Account already exists"
            message="You've already saved this bank."
            actionText="Continue Withdrawal"
            onAction={() => {
              // Enforce strict matching: require account number + account name + bank to match before auto-selecting.
              try {
                const normalize = (s: any) => (String(s || '')).replace(/\D/g, '').replace(/^0+/, '');
                const targetNorm = normalize(accountNumber);

                // Candidate banks that match the bank code (preferred scope)
                const sameCode = matchingBanks.filter((b: any) => (b.bankCode === bankCode || b.code === bankCode));

                // Strict match: normalized account number AND account name contains (case-insensitive) AND same bank
                const strictMatches = (sameCode.length ? sameCode : matchingBanks).filter((b: any) => {
                  const bNorm = normalize(b.accountNumber || b.accountNumberNormalized || '');
                  const nameMatch = accountName && b.accountName && String(b.accountName).toLowerCase().includes(String(accountName).toLowerCase());
                  return bNorm === targetNorm && nameMatch;
                });

                if (strictMatches.length === 1) {
                  // Found an unambiguous strict match — navigate with it
                  const toUse = strictMatches[0];
                  if (typeof __DEV__ !== 'undefined' && __DEV__) {
                    try { console.log('strict match found:', toUse); } catch (e) {}
                  }
                  navigation.navigate('WithdrawalFormScreen', { selectedBank: toUse });
                  return;
                }

                if (strictMatches.length > 1) {
                  // Multiple strict matches — let the user pick explicitly
                  setMatchingBanks(strictMatches);
                  showToast('Multiple saved accounts match. Please select the correct one.');
                  return;
                }

                // No strict match. Do NOT auto-select a bank that doesn't match the name.
                // Instead, surface the matching banks list (already visible) and ask the user to pick.
                if (typeof __DEV__ !== 'undefined' && __DEV__) {
                  try {
                    console.log('matchingBanks list:', matchingBanks);
                    console.log('targetNorm:', targetNorm);
                    console.log('strictMatches:', strictMatches);
                  } catch (e) { /* ignore */ }
                }

                showToast('Could not auto-select a saved bank matching account number, name, and institution. Please select it from the list.');
                // keep the matchingBanks visible so the user can tap the correct one
                return;
              } catch (e) {
                // Fallback: if something unexpected happened, don't auto-select a possibly wrong bank.
                showToast('Please select the saved bank from the list to continue.');
                return;
              }
            }}
        />
      )}
    </View>
  );
};

const createStyles = (t: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: t.colors?.background || '#F8F9FC' },
  scrollContent: { padding: 24, paddingBottom: 60 },
  inputSection: { marginBottom: 28 }, // Added significant spacing between fields
  statusSection: { marginBottom: 32, minHeight: 60 },
  label: { 
    fontSize: 12, 
    fontWeight: '800', 
    color: t.colors?.muted || '#64748B', 
    marginBottom: 12, 
    textTransform: 'uppercase', 
    letterSpacing: 1 
  },
  inputBox: { 
    height: 64, 
    backgroundColor: t.colors?.surface || '#FFF', 
    borderRadius: 18, 
    paddingHorizontal: 20, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    borderWidth: 1, 
    borderColor: t.colors?.border || '#E2E8F0' 
  },
  activeInput: { borderColor: t.colors.primary, backgroundColor: t.colors?.surface || '#FFF' },
  inputText: { fontSize: 16, fontWeight: '700', color: t.colors?.text || '#1E293B' },
  inputContainer: { 
    height: 64, 
    backgroundColor: t.colors?.surface || '#FFF', 
    borderRadius: 18, 
    paddingHorizontal: 20, 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: t.colors?.border || '#E2E8F0' 
  },
  cleanInput: { flex: 1, fontSize: 18, fontWeight: '700', color: t.colors?.text || '#1E293B', letterSpacing: 2 },
  inlineList: { 
    backgroundColor: t.colors?.surface || '#FFF', 
    borderRadius: 18, 
    marginTop: 8, 
    borderWidth: 1, 
    borderColor: t.colors?.border || '#E2E8F0', 
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10
  },
  searchBox: { padding: 16, borderBottomWidth: 1, borderBottomColor: t.colors?.mutedLight || '#F1F5F9', color: t.colors?.text || '#1E293B', fontSize: 15 },
  bankItem: { padding: 18, borderBottomWidth: 1, borderBottomColor: t.colors?.mutedLight || '#F1F5F9' },
  bankItemText: { fontWeight: '600', color: t.colors?.text || '#334155' },
  mainBtn: { 
    height: 60, 
    backgroundColor: t.colors.primary, 
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: t.colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }
  },
  mainBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  infoBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  infoText: { fontSize: 13, color: t.colors?.muted || '#64748B', marginLeft: 8, fontWeight: '500' },
  resolveErrorBox: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: t.colors?.surfaceVariant ?? '#FFF5F6', borderLeftWidth: 4, borderLeftColor: t.colors?.error || '#B00020', marginBottom: 8 },
  resolveErrorText: { marginLeft: 8, color: t.colors?.error || '#B00020', fontSize: 13, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: t.colors?.surface || '#FFF', padding: 24, paddingBottom: 40, borderTopLeftRadius: 32, borderTopRightRadius: 32 },
  sheetHandle: { width: 40, height: 4, backgroundColor: t.colors?.border || '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 24, color: t.colors?.text },
  confirmBox: { backgroundColor: t.colors?.surfaceVariant ?? t.colors?.surface, padding: 24, borderRadius: 24, marginBottom: 30, borderWidth: 1, borderColor: t.colors?.mutedLight ?? t.colors?.border },
  confirmLabel: { fontSize: 11, fontWeight: '800', color: t.colors?.muted, letterSpacing: 1 },
  confirmValue: { fontSize: 18, fontWeight: '800', color: t.colors?.text || '#1E293B', marginTop: 6 },
  divider: { height: 1, backgroundColor: t.colors?.border ?? 'rgba(0,0,0,0.06)', marginVertical: 16 },
  cancelBtn: { marginTop: 20, padding: 10 },
  cancelBtnText: { textAlign: 'center', color: t.colors?.muted, fontWeight: '700', fontSize: 15 }
  ,
  bankModalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  bankModalSheet: { backgroundColor: t.colors?.surface || '#FFF', padding: 18, paddingBottom: 30, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%' },
  bankModalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, position: 'relative' },
  closeBanksBtn: { position: 'absolute', right: 12, top: 6, padding: 8, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  closeBanksBtnText: { color: t.colors?.muted || '#64748B', fontWeight: '700' },
  smallActionRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
  smallBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: t.colors?.surface || '#FFF', borderWidth: 1, borderColor: t.colors?.border || '#E2E8F0' },
  smallBtnText: { color: t.colors?.primary, fontWeight: '700' },
  smallBtnOutline: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: t.colors?.muted || '#64748B', backgroundColor: 'transparent' },
  smallBtnTextOutline: { color: t.colors?.muted || '#64748B', fontWeight: '700' },
  manualInput: { marginTop: 8, backgroundColor: t.colors?.surface || '#FFF', borderRadius: 12, padding: 12, fontSize: 15, color: t.colors?.text || '#111', borderWidth: 1, borderColor: t.colors?.border || '#E2E8F0' },
});

export default AddBankScreen;