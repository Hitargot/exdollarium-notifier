import React, { useState, useEffect, useMemo } from 'react';
import PinPad from '../components/PinPad';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  ScrollView,
  Keyboard,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authStorage from '../utils/authStorage';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import Constants from 'expo-constants';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from './types';
import { showToast } from '../utils/toast';
import { buildTransactionReceipt } from '../utils/receiptBuilders';
import { sanitizeReceipt } from '../utils/receiptSanitizer';
import { getTransactionReceipt } from '../api/client';
import { showInAppConfirm } from '../contexts/ConfirmContext';
import appTheme from '../styles/theme';
import { useTheme } from '../theme/index';

type Extra = { apiUrl: string; env: string };
const extra = Constants.expoConfig?.extra as Extra;
const API_URL = extra.apiUrl;

type WithdrawalFormScreenRouteProp = RouteProp<RootStackParamList, 'WithdrawalFormScreen'>;
type NavigationProp = StackNavigationProp<RootStackParamList, 'WithdrawalFormScreen'>;

const WithdrawalFormScreen = () => {
  const route = useRoute<WithdrawalFormScreenRouteProp>();
  const { selectedBank } = route.params;
  const [bank, setBank] = useState<any>(selectedBank);
  const navigation = useNavigation<NavigationProp>();
  
  const themeCtx = useTheme();
  const t = themeCtx || appTheme;
  const styles = useMemo(() => createStyles(t), [t]);

  const [amount, setAmount] = useState('');
  const [amountDisplay, setAmountDisplay] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [showPinModal, setShowPinModal] = useState(false);
  const [withdrawNote, setWithdrawNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [estimatedAfter, setEstimatedAfter] = useState<number | null>(null);
  
  const WITHDRAW_FEE = 50;

  useEffect(() => {
    fetchWalletBalance();
  }, []);

  useEffect(() => {
    const numericAmount = Number(amount.replace(/,/g, ''));
    if (walletBalance === null) return;
    if (!numericAmount || isNaN(numericAmount)) {
      setEstimatedAfter(walletBalance);
    } else {
      setEstimatedAfter(walletBalance - numericAmount - WITHDRAW_FEE);
    }
  }, [amount, walletBalance]);

  const fetchWalletBalance = async () => {
    setLoadingBalance(true);
    try {
      const token = await authStorage.getToken();
      const res = await axios.get(`${API_URL}/api/wallet/data`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const balance = res.data.balance || 0;
      setWalletBalance(balance);
      await AsyncStorage.setItem('walletBalanceCache', JSON.stringify({ balance, ts: Date.now() }));
    } catch (err) {
      showToast('Could not sync balance');
    } finally {
      setLoadingBalance(false);
    }
  };

  const handleWithdrawAction = async () => {
    setError('');
    const numeric = Number(amount.replace(/,/g, ''));
    
    if (!amount || numeric <= 0) return setError('Enter a valid amount');
    if (numeric < 100) return setError('Minimum withdrawal is ₦100');
    if (walletBalance !== null && numeric + WITHDRAW_FEE > walletBalance) {
      return setError('Insufficient funds (including ₦50 fee)');
    }

    Keyboard.dismiss();
    setShowPinModal(true);
  };

  const confirmWithdraw = async () => {
    if (pin.length < 4) return;
    
    const numeric = Number(amount.replace(/,/g, ''));
    const totalDebit = numeric + WITHDRAW_FEE;
    
    // Ensure we have a valid bank record with _id. If not, try to resolve from saved banks.
    if (!bank || !bank._id) {
      try {
        const token = await authStorage.getToken();
        const list = await axios.get(`${API_URL}/api/wallet/banks`, { headers: { Authorization: `Bearer ${token}` } });
        const found = (list.data.banks || []).find((b: any) => (String(b.accountNumber) === String(bank?.accountNumber) || String(b.accountNumber) === String((bank?.accountNumber || '').replace(/\D/g, ''))) && (b.bankCode === bank?.bankCode || b.code === bank?.bankCode));
        if (found) {
          setBank(found);
        }
      } catch (e) {
        // ignore - we'll show a friendly error below if still missing
      }
    }

    if (!bank || !bank._id) {
      showToast('Bank record missing or invalid. Please re-add the bank from Add Bank screen or select a saved bank.');
      return;
    }

    const isConfirmed = await showInAppConfirm({
      title: 'Confirm Transfer',
      message: `Send ₦${numeric.toLocaleString()} to ${bank.bankName}?\nTotal Debit: ₦${totalDebit.toLocaleString()}`,
      confirmText: 'Send Money',
      cancelText: 'Cancel',
    });

    if (!isConfirmed) return;

    setConfirming(true);
    try {
      const token = await authStorage.getToken();
      const res = await axios.post(
        `${API_URL}/api/wallet/withdraw`,
        {
          amount: numeric,
          bankId: bank._id,
          accountNumber: bank.accountNumber,
          bankCode: (bank as any).bankCode || (bank as any).code,
          withdrawPin: pin,
          note: withdrawNote,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.status === 200) {
        setConfirmed(true);
  setTimeout(async () => {
          setShowPinModal(false);

          // Dev log to inspect server response shape (remove after verification)
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            try { console.log('withdraw response', res.data); } catch (e) {}
          }

          // Normalize receipt payload: unwrap common wrappers. If payload is minimal (only transactionId),
          // attempt to fetch the full transaction from the API (history) so the receipt contains all fields.
          let raw = res.data;
          let payload: any = (raw && raw.transaction) ? raw.transaction : raw;

          // If payload lacks labeled `fields` but has a transactionId, try to fetch the full txn from history endpoints
          try {
            const txnId = payload.transactionId || payload.transactionRef || payload._id || raw.transactionId || raw.transactionRef;
            if ((!Array.isArray(payload.fields) || payload.fields.length === 0) && txnId) {
              try {
                const fetched = await getTransactionReceipt(String(txnId));
                if (fetched) {
                  // getTransactionReceipt may return an object or a wrapper
                  payload = (fetched.transaction || fetched.data || fetched) as any;
                }
              } catch (e) {
                // ignore fetch errors and fall back to building a receipt locally
              }
            }

            if (!Array.isArray(payload.fields) || payload.fields.length === 0) {
              // build a transaction-style receipt from whatever payload we have
              payload = buildTransactionReceipt(payload || raw);
            }
          } catch (e) {
            // fallback to raw if building/fetching fails
            payload = raw;
          }

          const sanitized = sanitizeReceipt(payload);

          navigation.replace('WithdrawalSuccess', {
            receiptData: sanitized,
            status: 'success',
          });
        }, 800);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Transaction failed');
      setPin('');
    } finally {
      setConfirming(false);
    }
  };

  const handleForgotPin = () => {
    setShowPinModal(false);
    setPin('');
    navigation.navigate('ResetPinScreen');
  };

  return (
    <View style={styles.root}>
  <ScreenHeader title="Withdrawal" backgroundColor={t.colors?.background} />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          keyboardShouldPersistTaps="handled"
        >
          {/* Balance Section */}
          <View style={styles.balanceCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.balanceLabel}>AVAILABLE BALANCE</Text>
              <TouchableOpacity onPress={fetchWalletBalance} style={styles.refreshBtn}>
                {loadingBalance ? (
                  <ActivityIndicator size="small" color={t.colors?.onPrimary || '#FFF'} />
                ) : (
                  <Ionicons name="refresh" size={16} color={t.colors?.onPrimary || '#FFF'} />
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.balanceAmount}>
              ₦{walletBalance?.toLocaleString() ?? '0.00'}
            </Text>
          </View>

          {/* Amount Input Section */}
          <View style={styles.whiteCard}>
            <Text style={styles.sectionLabel}>Amount to Withdraw</Text>
            <View style={styles.hugeInputContainer}>
              <Text style={styles.currencySymbol}>₦</Text>
              <TextInput
                placeholder="0.00"
                value={amountDisplay}
                onChangeText={(t) => {
                  const raw = t.replace(/[^0-9.]/g, '');
                  setAmount(raw);
                  try { setAmountDisplay(require('../utils/numberFormat').formatWithCommas(raw)); } catch { setAmountDisplay(raw); }
                }}
                keyboardType="numeric"
                style={styles.hugeInput}
                placeholderTextColor="#CBD5E1"
              />
            </View>

            <View style={styles.quickRow}>
              {[1000, 5000, 10000].map((v) => (
                <TouchableOpacity 
                  key={v} 
                  style={styles.quickBtn} 
                  onPress={() => { setAmount(String(v)); try { setAmountDisplay(require('../utils/numberFormat').formatWithCommas(String(v))); } catch { setAmountDisplay(String(v)); } }}
                >
                  <Text style={styles.quickText}>₦{v.toLocaleString()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {amount !== '' && (
              <View style={styles.feeContainer}>
                <View style={styles.feeRow}>
                  <Text style={styles.feeLabel}>Transaction Fee</Text>
                  <Text style={styles.feeValue}>₦{WITHDRAW_FEE}</Text>
                </View>
                <View style={styles.feeRow}>
                  <Text style={styles.feeLabel}>New Balance</Text>
                  <Text style={[styles.feeValue, estimatedAfter! < 0 && { color: t.colors.error }]}>
                    ₦{estimatedAfter?.toLocaleString()}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Destination Section */}
          <View style={styles.whiteCard}>
            <Text style={styles.sectionLabel}>Sending To</Text>
            <View style={styles.bankInfoRow}>
              <View style={styles.bankIcon}>
                <Ionicons name="business" size={24} color={t.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bankName}>{selectedBank.bankName}</Text>
                <Text style={styles.accountDetails}>
                  {selectedBank.accountNumber} • {selectedBank.accountName}
                </Text>
              </View>
            </View>
          </View>

          {/* Optional Note */}
          <View style={styles.noteContainer}>
            <Text style={styles.labelSmall}>NOTE (OPTIONAL)</Text>
            <TextInput
              placeholder="What's this for?"
              value={withdrawNote}
              onChangeText={setWithdrawNote}
              style={styles.noteInput}
              placeholderTextColor="#94A3B8"
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity 
            style={[styles.mainBtn, !amount && styles.btnDisabled]} 
            onPress={handleWithdrawAction}
            disabled={!amount || confirming}
          >
            <Text style={styles.mainBtnText}>Continue</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* PIN Modal */}
      <Modal visible={showPinModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.pinSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>Security Verification</Text>
            <Text style={styles.modalSub}>Enter your 4-digit PIN to authorize this transfer</Text>

            <View style={styles.pinDisplay}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={[styles.pinDot, pin.length > i && styles.pinDotFilled]} />
              ))}
            </View>

            <PinPad value={pin} onChange={setPin} maxLength={4} />

            <TouchableOpacity
              onPress={confirmWithdraw}
              disabled={pin.length < 4 || confirming}
              style={[styles.confirmBtn, (pin.length < 4 || confirming) && styles.btnDisabled]}
            >
              {confirming ? <ActivityIndicator color={t.colors?.onPrimary || '#FFF'} /> : <Text style={styles.mainBtnText}>{confirmed ? 'Success!' : 'Confirm Transfer'}</Text>}
            </TouchableOpacity>

            <View style={styles.modalFooter}>
              <TouchableOpacity onPress={handleForgotPin} style={styles.footerBtn}>
                <Text style={[styles.footerBtnText, { color: t.colors.primary }]}>Forgot PIN?</Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => { setShowPinModal(false); setPin(''); }} style={styles.footerBtn}>
                <Text style={styles.footerBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (t: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: t.colors?.background || '#F8F9FC' },
  scrollContent: { padding: 20, paddingBottom: 60 },
  
  balanceCard: { 
    backgroundColor: t.colors.primary, 
    padding: 24, 
    borderRadius: 24, 
    marginBottom: 24,
    shadowColor: t.colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  refreshBtn: { backgroundColor: 'rgba(255,255,255,0.15)', padding: 8, borderRadius: 12 },
  balanceAmount: { color: '#FFF', fontSize: 32, fontWeight: '900', marginTop: 10 },

  whiteCard: { 
    backgroundColor: t.colors?.surface || '#FFF', 
    padding: 20, 
    borderRadius: 24, 
    marginBottom: 20, 
    borderWidth: 1, 
    borderColor: t.colors?.mutedLight || '#EDF2F7' 
  },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: t.colors?.muted || '#64748B', marginBottom: 15 },
  
  hugeInputContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginVertical: 10 },
  currencySymbol: { fontSize: 32, fontWeight: '800', color: t.colors?.primary || '#1E293B', marginRight: 4 },
  hugeInput: { fontSize: 44, fontWeight: '900', color: t.colors?.text || '#1E293B', textAlign: 'center', minWidth: 100 },
  
  quickRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  quickBtn: { backgroundColor: t.colors?.surface || '#F1F5F9', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, flex: 0.3, alignItems: 'center' },
  quickText: { color: t.colors?.primary || t.colors.primary, fontWeight: '700', fontSize: 13 },

  feeContainer: { marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  feeLabel: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
  feeValue: { fontSize: 13, color: '#475569', fontWeight: '700' },

  bankInfoRow: { flexDirection: 'row', alignItems: 'center' },
  bankIcon: { width: 50, height: 50, backgroundColor: t.colors?.surface || '#EFF6FF', borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  bankName: { fontSize: 16, fontWeight: '800', color: t.colors?.text || '#1E293B' },
  accountDetails: { fontSize: 13, color: t.colors?.muted || '#64748B', marginTop: 2 },

  noteContainer: { paddingHorizontal: 4, marginBottom: 30 },
  labelSmall: { fontSize: 11, fontWeight: '800', color: '#94A3B8', marginBottom: 8 },
  noteInput: { fontSize: 16, color: t.colors?.text || '#1E293B', borderBottomWidth: 1, borderBottomColor: t.colors?.mutedLight || '#E2E8F0', paddingVertical: 8 },

  mainBtn: { 
    height: 62, 
    backgroundColor: t.colors.primary, 
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  mainBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  btnDisabled: { opacity: 0.5 },
  errorText: { color: '#EF4444', textAlign: 'center', marginBottom: 15, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.8)', justifyContent: 'flex-end' },
  pinSheet: { backgroundColor: t.colors?.surface || '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  sheetHandle: { width: 40, height: 4, backgroundColor: t.colors?.mutedLight || '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '900', textAlign: 'center', color: t.colors?.text || '#1E293B' },
  modalSub: { fontSize: 14, color: t.colors?.muted || '#64748B', textAlign: 'center', marginTop: 8, marginBottom: 25 },
  pinDisplay: { flexDirection: 'row', justifyContent: 'center', marginBottom: 30 },
  pinDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: t.colors?.mutedLight || '#E2E8F0', marginHorizontal: 10 },
  pinDotFilled: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  confirmBtn: { height: 60, backgroundColor: t.colors.primary, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  
  modalFooter: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 25, 
    paddingHorizontal: 10 
  },
  footerBtn: { padding: 10 },
  footerBtnText: { color: t.colors?.muted || '#94A3B8', fontWeight: '700', fontSize: 15 },
});

export default WithdrawalFormScreen;