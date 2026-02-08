import React, { useEffect, useState, useCallback, useRef } from 'react';
// Attempt to load @react-navigation/native at runtime; provide safe fallbacks when it's not available
let useFocusEffect: any;
let useNavigation: any;
let useRoute: any;
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nav = require('@react-navigation/native');
    useFocusEffect = nav.useFocusEffect;
    useNavigation = nav.useNavigation;
    useRoute = nav.useRoute;
} catch (e) {
    // Fallbacks: lightweight no-ops so the screen can render in environments without react-navigation
    useFocusEffect = (cb: any) => {
        // mimic the hook shape by invoking the callback immediately for environments without navigation
        try { if (typeof cb === 'function') cb(); } catch {}
        return;
    };
    useNavigation = () => ({ replace: () => {}, navigate: () => {}, dispatch: () => {} });
    useRoute = () => ({ name: 'History' });
}
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Linking,
    Alert,
    Pressable,
    Modal,
    TextInput,
    Platform,
    FlatList,
    SectionList,
    Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProfile, getWalletData, getTransactions, getConfirmations } from '../api/client';
// removed import of StackNavigationProp (module not available in this project); navigation will be typed as any
import { Ionicons } from '@expo/vector-icons';
import staticTheme from '../styles/theme';
import { useTheme } from '../theme/index';
import { pickContrastText } from '../theme/colorUtils';
import Constants from 'expo-constants';
import DateTimePicker from '@react-native-community/datetimepicker';
// Prefer `react-native-modal-datetime-picker` when available because it presents
// a modal overlay that avoids z-order issues with RN `Modal` on Android.
let ModalDateTimePicker: any = null;
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ModalDateTimePicker = require('react-native-modal-datetime-picker').default;
} catch (e) {
    ModalDateTimePicker = null;
}

// optional clipboard fallback
let ClipboardAPI: any = null;
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ClipboardAPI = require('expo-clipboard');
} catch (e) {
    ClipboardAPI = null;
}

// optional file system and sharing for robust exports
let FileSystem: any = null;
let Sharing: any = null;
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    FileSystem = require('expo-file-system');
} catch (e) {
    FileSystem = null;
}
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Sharing = require('expo-sharing');
} catch (e) {
    Sharing = null;
}
// optional printing (PDF) support
let PrintAPI: any = null;
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    PrintAPI = require('expo-print');
} catch (e) {
    PrintAPI = null;
}

import { RootStackParamList } from './types';
import SkeletonBox from '../components/SkeletonBox';
import TransactionItem from '../components/TransactionItem';
import ScreenHeader from '../components/ScreenHeader';
import NavBar from '../components/NavBar';

const extra = Constants.expoConfig?.extra as { apiUrl: string; env: string };
export const API_URL = extra?.apiUrl || 'http://localhost:3000';

// StackNavigationProp import isn't available in this environment; use a permissive any type to avoid compile errors.
// If you later add @react-navigation/stack, replace `any` with the proper StackNavigationProp<RootStackParamList>.
type NavigationProp = any;
// Use normalized type names that match the transaction normalization logic
// (we create 'Funding' entries for deposits in normalize earlier)
// Include Trade Confirmation and remove the generic 'Transfer' option
const FILTER_TYPES = ['All', 'Funding', 'Withdrawal', 'Sent Transfer', 'Received Transfer', 'Trade Confirmation'];

const HistoryScreen = () => {
        const themeCtx = (() => { try { return useTheme(); } catch (e) { return undefined as any; } })();
        const theme = themeCtx || staticTheme;
    const navigation = useNavigation() as NavigationProp;
    const styles = React.useMemo(() => createStyles(theme), [theme]);
    const route = useRoute();
    const currentScreen = route.name as string;

    // State
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [filtersLoaded, setFiltersLoaded] = useState(false);
    const [allTransactions, setAllTransactions] = useState<any[]>([]);
    const [walletBalance, setWalletBalance] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedType, setSelectedType] = useState('All');
    const [isBalanceVisible, setIsBalanceVisible] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [showFilter, setShowFilter] = useState(false);
    const [startDate, setStartDate] = useState(new Date('2024-01-01'));
    const [endDate, setEndDate] = useState(new Date());
    // modal-local temporary filter state (user edits here until Apply)
    const [modalSelectedType, setModalSelectedType] = useState<string>(selectedType);
    const [modalStartDate, setModalStartDate] = useState<Date | undefined>(startDate);
    const [modalEndDate, setModalEndDate] = useState<Date | undefined>(endDate);
    type FilterState = { type: string; startDate: Date; endDate: Date; status?: string };
    // derived filtered list (useMemo to avoid extra renders and heavy setState loops)
    // we previously stored filtered in state which caused extra re-renders when computing large lists
    const [appliedFilters, setAppliedFilters] = useState<FilterState>({ type: 'All', startDate: new Date('2024-01-01'), endDate: new Date(), status: 'All' });
    const [countdowns, setCountdowns] = useState<{ [txnId: string]: string }>({});
    const [user, setUser] = useState<any>(null);
    const [dataFetched, setDataFetched] = useState(false);
    const navigatedToReceipt = React.useRef(false);

    // incremental rendering
    const CHUNK_SIZE = 20;
    const [visibleCount, setVisibleCount] = useState<number>(CHUNK_SIZE);
    // reset visible count whenever the computed filtered list changes
    // (filtered is derived below with useMemo)

    // countdowns for confirmations
    useEffect(() => {
        const interval = setInterval(() => {
            const newCountdowns: { [txnId: string]: string } = {};
            allTransactions.forEach((txn) => {
                if (txn.type === 'Trade Confirmation' && txn.status?.toLowerCase() === 'pending' && txn.createdAt) {
                    const created = new Date(txn.createdAt);
                    const now = new Date();
                    const totalMinutes = 180;
                    const elapsed = Math.floor((now.getTime() - created.getTime()) / 60000);
                    const remaining = totalMinutes - elapsed;
                    if (remaining > 0) {
                        const hrs = Math.floor(remaining / 60);
                        const mins = remaining % 60;
                        newCountdowns[txn._id] = `${hrs > 0 ? `${hrs}h ` : ''}${mins}m left`;
                    } else {
                        newCountdowns[txn._id] = 'expired';
                    }
                }
            });
            setCountdowns(newCountdowns);
        }, 1000);
        return () => clearInterval(interval);
    }, [allTransactions]);

    // loadMore will be declared after we compute `filtered` to avoid referencing it before declaration

    // fetchAll with in-flight guard to avoid re-entrancy loops when focus/refresh
    const isFetchingRef = useRef(false);
    const fetchAll = async () => {
            if (isFetchingRef.current) return;
            isFetchingRef.current = true;
            // Try to show cached transactions immediately and avoid showing the
            // full-screen skeleton when cached data exists.
            try {
                const cached = await AsyncStorage.getItem('transactionsCache');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed) && parsed.length) {
                        setAllTransactions(parsed);
                        setDataFetched(true);
                    }
                }
            } catch (e) {
                // ignore cache read/parse errors
            }
            // Show skeleton only if we don't have cached data
            if (!dataFetched && (!allTransactions || allTransactions.length === 0)) {
                setLoading(true);
            }
            try {
                // Try to show cached transactions immediately for poor networks
                try {
                    const cached = await AsyncStorage.getItem('transactionsCache');
                    if (cached) {
                        const parsed = JSON.parse(cached);
                        if (Array.isArray(parsed) && parsed.length) {
                            setAllTransactions(parsed);
                        }
                    }
                } catch (e) { /* ignore cache read/parse errors */ }

                const [profileRes, walletRes, txRes, confRes] = await Promise.all([
                    getProfile().catch(() => null),
                    getWalletData().catch(() => ({ transactions: [], balance: 0 })),
                    getTransactions().catch(() => ({ transactions: [] })),
                    getConfirmations().catch(() => ({ confirmations: [] })),
                ]);

                setUser(profileRes || null);

                // capture wallet balance when available for premium header
                try {
                    const bal = walletRes?.balance ?? walletRes?.data?.balance ?? null;
                    if (bal !== undefined) setWalletBalance(bal === null ? null : Number(bal));
                } catch (e) { /* ignore */ }

                const userId = profileRes?._id;
                const walletTxns = walletRes?.transactions || walletRes?.data?.transactions || [];
                const apiTxns = txRes?.transactions || txRes?.data?.transactions || [];
                const confs = confRes?.confirmations || confRes?.data?.confirmations || [];

                const normalize = (t: any, fallbackType?: string) => ({ ...t, rawType: t.type, type: t.type || fallbackType || 'Unknown', time: new Date(t.createdAt || t.date || Date.now()).getTime() });

                const fundings = (walletTxns || []).filter((t: any) => t.type === 'Funding').map((t: any) => normalize(t, 'Funding'));

                const withdrawals = (apiTxns || []).filter((t: any) => (t.type || '').toString().toLowerCase().includes('withdrawal') || t.type === 'Withdrawal').map((t: any) => normalize(t, 'Withdrawal'));

                const transfers = (apiTxns || []).filter((t: any) => (t.type || '').toString().toLowerCase().includes('transfer')).map((t: any) => {
                    const senderIdStr = typeof t.senderId === 'object' ? t.senderId?._id?.toString() : t.senderId?.toString?.();
                    const isSender = !!(userId && senderIdStr === userId?.toString());
                    return { ...normalize(t, 'Transfer'), type: isSender ? 'Sent Transfer' : 'Received Transfer' };
                });

                const confirmations = (confs || []).map((c: any) => ({ ...normalize(c, 'Trade Confirmation'), type: 'Trade Confirmation', serviceName: c.serviceId?.name || c.serviceName || 'N/A', serviceTag: c.tag || c.serviceTag || undefined }));

                const combined = [...fundings, ...withdrawals, ...transfers, ...confirmations].sort((a, b) => b.time - a.time);
                setAllTransactions(combined);

                // cache the combined list for faster subsequent loads
                try { await AsyncStorage.setItem('transactionsCache', JSON.stringify(combined)); } catch (e) { /* ignore */ }
            } catch (err) {
                console.error('❌ Error fetching full history:', err);
            } finally {
                setLoading(false);
                setRefreshing(false);
                setDataFetched(true);
                isFetchingRef.current = false;
            }
    };

    const loadSavedFilters = async () => {
        try {
            let savedType = await AsyncStorage.getItem('filter:type');
            let savedStart = await AsyncStorage.getItem('filter:startDate');
            let savedEnd = await AsyncStorage.getItem('filter:endDate');
            // debug logs removed
            if (!savedType || !FILTER_TYPES.includes(savedType)) savedType = 'All';
            const start = savedStart ? new Date(savedStart) : new Date('2024-01-01');
            const end = savedEnd ? new Date(savedEnd) : new Date();
            const newFilters: FilterState = { type: savedType, startDate: start, endDate: end };
            setSelectedType(savedType);
            setStartDate(start);
            setEndDate(end);
            setAppliedFilters(newFilters);
            setFiltersLoaded(true);
            // debug logs removed
        } catch (err) {
            console.warn('Error loading saved filters', err);
        }
    };

    const saveFilters = async (filters?: FilterState) => {
        const f = filters || appliedFilters;
        if (!f) return;
    // debug logs removed
        await AsyncStorage.setItem('filter:type', f.type);
        await AsyncStorage.setItem('filter:startDate', f.startDate.toISOString());
        await AsyncStorage.setItem('filter:endDate', f.endDate.toISOString());
    };

    useEffect(() => {
        const init = async () => {
            await Promise.allSettled([fetchAll(), loadSavedFilters()]);
            setDataFetched(true);
        };
        init();
    }, []);
    // Sync modal internal state with actual applied state whenever the modal opens
useEffect(() => {
    if (showFilter) {
        setModalStartDate(startDate);
        setModalEndDate(endDate);
        setModalSelectedType(selectedType);
    }
}, [showFilter]);

    // debug effects removed

    const filtered = React.useMemo(() => {
        if (!filtersLoaded || !dataFetched) return [];
        const lowerSearch = searchText?.toString().toLowerCase() || '';
        return allTransactions.filter((txn) => {
            const matchText = (txn.serviceName?.toString().toLowerCase().includes(lowerSearch)) || (txn.amount?.toString().includes(lowerSearch)) || (txn.serviceTag?.toString().toLowerCase().includes(lowerSearch));
            if (!appliedFilters) return matchText;
            const matchType = appliedFilters.type === 'All' || (txn.type?.toString().toLowerCase().trim() === appliedFilters.type.toLowerCase().trim());
            const txnTimestamp = txn.time || new Date(txn.createdAt || txn.date).getTime();
            const inDateRange = txnTimestamp >= new Date(appliedFilters.startDate).getTime() && txnTimestamp <= new Date(appliedFilters.endDate).getTime();
            return Boolean(matchText) && matchType && inDateRange;
        });
    }, [searchText, appliedFilters, allTransactions, filtersLoaded, dataFetched]);

    // (Removed premium gating — features available to all users)

    // Summary stats used by premium header
    const premiumSummary = React.useMemo(() => {
        const totalCount = filtered.length;
        let totalVolume = 0;
        filtered.forEach((t) => {
            const a = Number(t.amount || t.amountInForeignCurrency || 0);
            if (!Number.isNaN(a)) totalVolume += a;
        });
        return { totalCount, totalVolume };
    }, [filtered]);

    // apply quick preset filters for premium users
    const applyPreset = async (preset: 'all' | '7' | '30' | 'confirmations') => {
        const now = new Date();
        let start = new Date();
        let type = 'All';
        if (preset === 'all') {
            // show everything since app started (or a reasonable default)
            start = new Date('2024-01-01');
            type = 'All';
        } else if (preset === '7') {
            start.setDate(now.getDate() - 7);
        } else if (preset === '30') {
            start.setDate(now.getDate() - 30);
        } else if (preset === 'confirmations') {
            start = new Date('2024-01-01');
            type = 'Trade Confirmation';
        }
        const newFilters: FilterState = { type, startDate: start, endDate: now };
        setSelectedType(type);
        setStartDate(start);
        setEndDate(now);
        setAppliedFilters(newFilters);
        try { await saveFilters(newFilters); } catch (e) { /* ignore */ }
    };

    // Export filtered transactions as CSV and invoke native share, fallback to clipboard
    const exportFilteredAsCSV = async () => {
        try {
            if (!filtered || !filtered.length) {
                Alert.alert('Nothing to export', 'There are no transactions for the current filters.');
                return;
            }
            const headers = ['Date','Type','Amount','Status','Transaction ID','Service','Service Tag','Note'];
            const escape = (v: any) => {
                if (v === undefined || v === null) return '';
                const s = String(v);
                if (s.includes(',') || s.includes('\n') || s.includes('"')) return `"${s.replace(/"/g, '""')}"`;
                return s;
            };
            const rows = filtered.map((t) => ([
                new Date(t.createdAt || t.date || t.time || Date.now()).toISOString(),
                t.type || '',
                t.amount ?? t.amountInForeignCurrency ?? '',
                t.status || '',
                t.transactionId || t._id || '',
                t.serviceName || '',
                t.serviceTag || t.tag || '',
                t.note || t.rejectionReason || '',
            ].map(escape).join(',')));
            const csv = `${headers.join(',')}\n${rows.join('\n')}`;
            // Try file-based share when available (expo-file-system + expo-sharing)
            try {
                if (FileSystem && Sharing) {
                    try {
                        const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
                        const safe = new Date().toISOString().replace(/[:.]/g, '-');
                        const fileName = `Transactions-${safe}.csv`;
                        const path = `${dir}${fileName}`;
                        await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
                        // prefer expo-sharing when available
                        try {
                            if (Sharing.isAvailableAsync && (await Sharing.isAvailableAsync())) {
                                await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Share transactions CSV' });
                            } else {
                                // fallback to RN Share with URL
                                await Share.share({ url: path, title: 'Transactions CSV' } as any);
                            }
                        } finally {
                            // best-effort cleanup
                            try { await FileSystem.deleteAsync(path, { idempotent: true }); } catch (e) { /* ignore */ }
                        }
                        return;
                    } catch (fileErr) {
                        // continue to text-based fallback
                        console.warn('File-based share failed', fileErr);
                    }
                }

                // fallback to text share
                await Share.share({ title: 'Transactions CSV', message: csv });
                return;
            } catch (shareErr) {
                // fallback to clipboard
                if (ClipboardAPI && ClipboardAPI.setStringAsync) {
                    await ClipboardAPI.setStringAsync(csv);
                    Alert.alert('CSV copied', 'CSV copied to clipboard. You can paste it into a file or app to save.');
                    return;
                }
                Alert.alert('Export failed', 'Unable to share or copy CSV.');
            }
        } catch (err) {
            console.warn('Export CSV failed', err);
            Alert.alert('Export failed', 'An unexpected error occurred while exporting.');
        }
    };

    // Export filtered transactions as a simple PDF (uses expo-print + sharing)
    const exportFilteredAsPDF = async () => {
        try {
            if (!filtered || !filtered.length) {
                Alert.alert('Nothing to export', 'There are no transactions for the current filters.');
                return;
            }
            // Build a simple HTML table
            const rowsHtml = filtered.map((t) => {
                const date = new Date(t.createdAt || t.date || t.time || Date.now()).toLocaleString();
                const amt = t.amount ?? t.amountInForeignCurrency ?? '';
                const type = t.type || '';
                const status = t.status || '';
                const id = t.transactionId || t._id || '';
                const service = t.serviceName || '';
                const note = (t.note || t.rejectionReason || '').toString().replace(/</g, '&lt;').replace(/>/g, '&gt;');
                return `<tr><td>${date}</td><td>${type}</td><td>${amt}</td><td>${status}</td><td>${id}</td><td>${service}</td><td>${note}</td></tr>`;
            }).join('');
            const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f4f4f4}</style></head><body><h2>Transactions</h2><table><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Status</th><th>Transaction ID</th><th>Service</th><th>Note</th></tr></thead><tbody>${rowsHtml}</tbody></table></body></html>`;

            // Use expo-print if available to create a PDF file
            if (PrintAPI && FileSystem && Sharing) {
                try {
                    const { uri } = await PrintAPI.printToFileAsync({ html });
                    // Share the generated file
                    if (Sharing.isAvailableAsync && (await Sharing.isAvailableAsync())) {
                        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share transactions PDF' });
                    } else {
                        await Share.share({ url: uri, title: 'Transactions PDF' } as any);
                    }
                    // cleanup: if uri is in cache, optionally delete - many runtimes auto-manage print temp files
                    try { if (uri && FileSystem && FileSystem.deleteAsync) await FileSystem.deleteAsync(uri, { idempotent: true }); } catch (e) { /* ignore */ }
                    return;
                } catch (e) {
                    console.warn('PDF generation failed', e);
                    // fallback to CSV export
                }
            }

            // fallback: share CSV if PDF not available
            await exportFilteredAsCSV();
        } catch (err) {
            console.warn('Export PDF failed', err);
            Alert.alert('Export failed', 'An unexpected error occurred while exporting PDF.');
        }
    };

    useEffect(() => setVisibleCount(CHUNK_SIZE), [filtered]);

    const loadMore = useCallback(() => setVisibleCount((v) => Math.min(filtered.length, v + CHUNK_SIZE)), [filtered.length]);

    const onRefresh = useCallback(async () => {
        // Pull-to-refresh: show the inline refreshing spinner but avoid
        // toggling the full-screen skeleton state.
        setRefreshing(true);
        try {
            await fetchAll();
            const reset: FilterState = { type: 'All', startDate: new Date('2024-01-01'), endDate: new Date() };
            setSelectedType('All');
            setStartDate(reset.startDate);
            setEndDate(reset.endDate);
            setAppliedFilters(reset);
            await saveFilters(reset);
        } finally {
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            (async () => {
                try {
                    if (navigatedToReceipt.current) {
                        navigatedToReceipt.current = false;
                        return;
                    }
                    // Call fetchAll directly on focus to avoid showing the
                    // pull-to-refresh UI or full-screen skeleton unnecessarily.
                    await fetchAll();
                } catch (e) {
                    console.warn('Focus refresh failed', e);
                }
            })();
            return () => { };
        }, [])
    );

    const renderFilterModal = React.useCallback(() => {
        const resetFilters = () => {
            const reset: FilterState = { type: 'All', startDate: new Date('2024-01-01'), endDate: new Date() };
            // reset modal-local state and applied/global state
            setModalSelectedType('All');
            setModalStartDate(reset.startDate);
            setModalEndDate(reset.endDate);
            setSelectedType('All');
            setStartDate(reset.startDate);
            setEndDate(reset.endDate);
            setAppliedFilters(reset);
            
            saveFilters(reset);
            setShowFilter(false);
        };
        if (loading) return null;
        return (
            <Modal visible={showFilter} animationType="none" transparent statusBarTranslucent onRequestClose={() => setShowFilter(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.filterModal}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Filter Transactions</Text>
                            <TouchableOpacity onPress={() => setShowFilter(false)} style={styles.closeBtn}>
                                <Ionicons name="close" size={20} color={theme.colors.text} />
                            </TouchableOpacity>
                        </View>

                        {/* debug UI removed */}


                        {/* Type chips */}
                        <View style={styles.chipsRow}>
                            <FlatList
                                horizontal
                                data={FILTER_TYPES}
                                keyExtractor={(item) => item}
                                contentContainerStyle={{ paddingVertical: 10, paddingHorizontal: 4 }}
                                showsHorizontalScrollIndicator={false}
                                renderItem={({ item }) => {
                                    const isSelected = modalSelectedType === item;
                                    return (
                                        <TouchableOpacity
                                            onPress={() => {
                                                setModalSelectedType(item);
                                            }}
                                            style={[styles.chip, isSelected && styles.chipSelected]}
                                        >
                                            <Text style={[styles.chipText, isSelected ? { color: pickContrastText(theme.colors.primary, theme.colors.white, theme.colors.text) } : { color: theme.colors.text }]}>{item}</Text>
                                        </TouchableOpacity>
                                    );
                                }}
                            />
                        </View>

                        {/* Date pickers */}
                        <View style={styles.dateRow}>
                            <Text style={styles.modalLabel}>From</Text>
                            <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.datePickerBtn}>
                                <Text style={[styles.dateText, !modalStartDate && styles.placeholder]}>{modalStartDate ? modalStartDate.toDateString() : 'Select start date'}</Text>
                            </TouchableOpacity>
                        </View>
                        {/* DateTimePicker moved out of modal to avoid Android/modal interaction issues */}

                        <View style={styles.dateRow}>
                            <Text style={styles.modalLabel}>To</Text>
                            <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.datePickerBtn}>
                                <Text style={[styles.dateText, !modalEndDate && styles.placeholder]}>{modalEndDate ? modalEndDate.toDateString() : 'Select end date'}</Text>
                            </TouchableOpacity>
                        </View>
                        {/* DateTimePicker moved out of modal to avoid Android/modal interaction issues */}

                        {/* Actions */}
                        <View style={styles.btnRow}>
                            <TouchableOpacity style={styles.resetBtn} onPress={resetFilters}>
                                <Text style={styles.resetText}>Reset</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.applyBtn} onPress={() => {
                                const newFilters = { type: modalSelectedType || 'All', startDate: modalStartDate || new Date('2024-01-01'), endDate: modalEndDate || new Date() };
                                // update both modal and global state
                                setSelectedType(newFilters.type);
                                setStartDate(newFilters.startDate);
                                setEndDate(newFilters.endDate);
                                setAppliedFilters(newFilters);
                                AsyncStorage.setItem('filter:type', newFilters.type);
                                AsyncStorage.setItem('filter:startDate', newFilters.startDate.toISOString());
                                AsyncStorage.setItem('filter:endDate', newFilters.endDate.toISOString());
                                
                                setShowFilter(false);
                            }}>
                                <Text style={[styles.applyText, { color: pickContrastText(theme.colors.primary, theme.colors.white, theme.colors.text) }]}>Apply Filters</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        );
    }, [showFilter, modalSelectedType, modalStartDate, modalEndDate, showStartPicker, showEndPicker, loading]);

    const handleViewReceipt = async (txn: any) => {
        // If the transaction already carries a pre-built receipt object, prefer that but sanitize it so
        // we don't pass React elements or functions into navigation params (non-serializable).
        const sanitizeReceipt = (r: any) => {
            const isReactElement = (v: any) => v && typeof v === 'object' && v.$$typeof !== undefined;
            const cloned: any = { ...r };
            cloned.fields = (r.fields || []).map((f: any) => {
                let value = f.value;
                if (isReactElement(value)) {
                    // Replace complex element with a descriptive string placeholder.
                    value = '[attachment]';
                } else if (Array.isArray(value)) {
                    value = value.map((v2: any) => {
                        if (typeof v2 === 'string' || typeof v2 === 'number' || typeof v2 === 'boolean') return v2;
                        if (v2 && typeof v2 === 'object') {
                            if (v2.uri) return v2.uri;
                            if (v2.props && typeof v2.props.children === 'string') return v2.props.children;
                            // fallback to JSON representation
                            try { return JSON.stringify(v2); } catch { return String(v2); }
                        }
                        return String(v2);
                    }).filter(Boolean);
                }
                return { ...f, value };
            });
            // Ensure transactionRef is a string if present
            if (cloned.transactionRef) cloned.transactionRef = String(cloned.transactionRef);
            return cloned;
        };

        // ensure we have profile info to attach username/email for PDFs
        const profile = user || await getProfile().catch(() => null);

        if (txn.receipt) {
            const sanitized = sanitizeReceipt(txn.receipt);
            sanitized.header = sanitized.header || {};
            if (profile?.username) sanitized.header.username = profile.username;
            if (profile?.email) sanitized.header.email = profile.email;
            navigatedToReceipt.current = true;
            return navigation.navigate('Receipt', { receiptData: sanitized });
        }

    const receiptData: any = { title: 'Transaction Receipt', fields: [] };
    // Ensure top-level type is present so ReceiptScreen can use it when fields omit 'Type'
    receiptData.type = txn.type || receiptData.type;
        const transactionId = txn.transactionId || txn._id || 'N/A';
        const typeNorm = (txn.type || '').toString().toLowerCase();
        if (typeNorm === 'withdrawal' || typeNorm.includes('withdrawal')) {
            const { formatSignedAmount } = require('../utils/formatAmount');
            receiptData.fields.push({ label: 'Type', value: txn.type }, { label: 'Amount', value: formatSignedAmount(txn.amount, txn.type) }, { label: 'Transaction ID', value: transactionId, copyable: true }, { label: 'Date', value: new Date(txn.createdAt).toLocaleString() || 'N/A' }, { label: 'Status', value: txn.status || 'N/A' });
            const bankLabel = txn.bankMeta || (txn.bank && (txn.bank.bankName ? `${txn.bank.bankName} - ${txn.bank.accountNumber}` : JSON.stringify(txn.bank))) || txn.bankId || null;
            if (txn.fee !== undefined && txn.fee !== null && Number(txn.fee) !== 0) {
                receiptData.fields.push({ label: 'Fee', value: `₦${Number(txn.fee).toLocaleString()}` });
                try {
                    const total = (Number(txn.amount || 0) + Number(txn.fee || 0));
                    receiptData.fields.push({ label: 'Total Debited', value: `₦${total.toLocaleString()}` });
                } catch (e) { /* ignore */ }
            }
            if (bankLabel) receiptData.fields.push({ label: 'Bank', value: bankLabel });
            const acctName = txn.accountName || txn.accountHolderName || (txn.bank && (txn.bank.accountName || txn.bank.accountHolderName));
            if (acctName) receiptData.fields.push({ label: 'Account Name', value: acctName });
            if (txn.note) receiptData.fields.push({ label: 'Note', value: txn.note });
            // include any admin-uploaded receipt files
            if (txn.adminReceipts && Array.isArray(txn.adminReceipts) && txn.adminReceipts.length) {
                try {
                    const extras: any = (Constants.expoConfig && (Constants.expoConfig as any).extra) || {};
                    const configured = (extras.apiUrl || extras.API_URL || extras.apiUrl) || '';
                    const base = String(configured).replace(/\/$/, '');
                    const mapped = txn.adminReceipts.map((p: string) => {
                        if (!p) return p;
                        if (/^https?:\/\//i.test(p)) return p;
                        if (p.startsWith('/')) return `${base}${p}`;
                        return `${base}/${p}`;
                    }).filter(Boolean);
                    if (mapped.length) receiptData.fields.push({ label: 'Receipt File', value: mapped });
                } catch (e) {
                    receiptData.fields.push({ label: 'Receipt File', value: txn.adminReceipts });
                }
            }
            // include provider info when present
            if (txn.provider && txn.provider.reference) receiptData.fields.push({ label: 'Reference', value: txn.provider.reference });
            if (txn.status && txn.status.toLowerCase() === 'rejected') receiptData.fields.push({ label: 'Rejection Reason', value: txn.rejectionReason || 'No reason provided' });
            receiptData.transactionRef = transactionId;
            // attach profile header
            receiptData.header = receiptData.header || {};
            if (profile?.username) receiptData.header.username = profile.username;
            if (profile?.email) receiptData.header.email = profile.email;
            navigatedToReceipt.current = true; return navigation.navigate('Receipt', { receiptData });
        }
        if (txn.type === 'Sent Transfer' || txn.type === 'Received Transfer') {
            const isSent = txn.type === 'Sent Transfer';
            const { formatSignedAmount } = require('../utils/formatAmount');
            receiptData.fields.push({ label: 'Type', value: txn.type }, { label: 'Amount', value: formatSignedAmount(txn.amount, txn.type) }, { label: 'Transaction ID', value: transactionId, copyable: true }, { label: 'Date', value: new Date(txn.createdAt).toLocaleString() || 'N/A' }, { label: 'Status', value: txn.status || 'N/A' }, { label: isSent ? 'Sent To' : 'Received From', value: txn.payId || txn.recipientId?.payId || txn.counterparty?.payId || 'N/A' }, { label: 'Note', value: txn.note || 'No additional notes.' });
            if (txn.status === 'Rejected') receiptData.fields.push({ label: 'Rejection Reason', value: txn.rejectionReason || 'No reason provided' });
            // attach profile header
            receiptData.header = receiptData.header || {};
            if (profile?.username) receiptData.header.username = profile.username;
            if (profile?.email) receiptData.header.email = profile.email;
            navigatedToReceipt.current = true; return navigation.navigate('Receipt', { receiptData });
        }
        if (txn.type === 'Funding') {
            const { formatSignedAmount } = require('../utils/formatAmount');
            receiptData.fields.push({ label: 'Type', value: txn.type }, { label: 'Amount', value: formatSignedAmount(txn.amount, txn.type) }, { label: 'Transaction ID', value: transactionId, copyable: true }, { label: 'Date', value: new Date(txn.createdAt).toLocaleString() || 'N/A' }, { label: 'Status', value: txn.status || 'N/A' }, { label: 'Note', value: txn.note || 'No additional notes.' });
            // attach profile header
            receiptData.header = receiptData.header || {};
            if (profile?.username) receiptData.header.username = profile.username;
            if (profile?.email) receiptData.header.email = profile.email;
            navigatedToReceipt.current = true; return navigation.navigate('Receipt', { receiptData });
        }
        if (txn.type?.trim().toLowerCase() === 'trade confirmation' || txn.type?.trim().toLowerCase() === 'confirmation') {
            const fileUrls = Array.isArray(txn.fileUrls) && txn.fileUrls.length > 0 ? txn.fileUrls : txn.fileUrl ? [txn.fileUrl] : [];
            // Use serializable file URL array instead of React elements so navigation state remains serializable.
            receiptData.fields.push(
                { label: 'Type', value: txn.type },
                ...(txn.amount !== undefined && txn.amount !== null ? [{ label: 'Amount', value: require('../utils/formatAmount').formatSignedAmount(txn.amount, txn.type) }] : []),
                { label: 'Service', value: txn.serviceName || 'N/A' },
                { label: 'Service Tag', value: txn.serviceTag || 'N/A' },
                { label: 'Transaction ID', value: transactionId, copyable: true },
                { label: 'Date', value: new Date(txn.createdAt).toLocaleString() || 'N/A' },
                { label: 'Status', value: txn.status || 'N/A' },
                { label: 'Note', value: txn.note || 'No additional notes.' },
                { label: 'Files', value: fileUrls.length > 0 ? fileUrls : [] }
            );
            if (txn.status === 'Funded') {
                // Prefer the centralized confirmation receipt builder which handles user/admin amounts and fallbacks
                try {
                    const { buildConfirmationReceipt } = require('../utils/receiptBuilders');
                    const built = buildConfirmationReceipt(txn);
                    // attach profile header
                    built.header = built.header || {};
                    const profile = user || null;
                    if (profile?.username) built.header.username = profile.username;
                    if (profile?.email) built.header.email = profile.email;
                    navigatedToReceipt.current = true;
                    return navigation.navigate('Receipt', { receiptData: built });
                } catch (e) {
                    // fallback to inline fields if builder fails - prefer explicit user/admin labels
                    try {
                        const userAmt = txn.userAmountInForeignCurrency ?? null;
                        const userCurr = (txn.userSelectedCurrency || txn.selectedCurrency || '').toUpperCase();
                        const adminAmt = txn.adminForeignAmount ?? txn.amountInForeignCurrency ?? null;
                        const adminCurr = (txn.adminSelectedCurrency || txn.selectedCurrency || '').toUpperCase();
                        if (userAmt) receiptData.fields.push({ label: `Amount input in ${userCurr || 'Foreign Currency'}`, value: `${userAmt.toLocaleString()} ${userCurr}` });
                        if (adminAmt) receiptData.fields.push({ label: `Amount funded in ${adminCurr || 'Foreign Currency'}`, value: `${adminAmt.toLocaleString()} ${adminCurr}` });
                        if (txn.amountInNaira) receiptData.fields.push({ label: 'Amount in Naira', value: `₦${txn.amountInNaira.toLocaleString()}` });
                        if (txn.exchangeRateUsed) receiptData.fields.push({ label: 'Exchange Rate', value: txn.exchangeRateUsed.toLocaleString() });
                    } catch (ee) {
                        // best-effort fallback to legacy single field
                        receiptData.fields.push({ label: `Amount in ${txn.selectedCurrency?.toUpperCase() ?? 'Foreign Currency'}`, value: txn.amountInForeignCurrency ? `${txn.amountInForeignCurrency.toLocaleString()} ${txn.selectedCurrency?.toUpperCase()}` : 'N/A' }, { label: 'Exchange Rate', value: txn.exchangeRateUsed ? txn.exchangeRateUsed.toLocaleString() : 'N/A' }, { label: 'Amount in Naira', value: txn.amountInNaira ? `₦${txn.amountInNaira.toLocaleString()}` : 'N/A' });
                    }
                }
            }
            if (txn.status === 'Rejected') receiptData.fields.push({ label: 'Rejection Reason', value: txn.rejectionReason || 'No reason provided' });
            // attach profile header
            receiptData.header = receiptData.header || {};
            if (profile?.username) receiptData.header.username = profile.username;
            if (profile?.email) receiptData.header.email = profile.email;
            navigatedToReceipt.current = true; return navigation.navigate('Receipt', { receiptData });
        }

    };

    const renderTxn = useCallback(({ item }: { item: any }) => (<TransactionItem txn={item} onPress={handleViewReceipt} isBalanceVisible={isBalanceVisible} countdown={countdowns[item._id]} />), [isBalanceVisible, countdowns, handleViewReceipt]);

    const openFilter = () => {
        setSelectedType(appliedFilters?.type || 'All');
        setStartDate(appliedFilters?.startDate || new Date('2024-01-01'));
        setEndDate(appliedFilters?.endDate || new Date());
        // initialize modal-local temps as well
        setModalSelectedType(appliedFilters?.type || 'All');
        setModalStartDate(appliedFilters?.startDate || new Date('2024-01-01'));
        setModalEndDate(appliedFilters?.endDate || new Date());
        setShowFilter(true);
    };

    // Render a single unified header (removed premium gating - features available to all users)
    const renderHeader = () => (
        <>
            <View style={styles.premiumHeader}>
                <View style={styles.premiumTopRow}>
                    <View>
                        <Text style={styles.premiumTitle}>Transaction History</Text>
                        <Text style={styles.premiumSubtitle}>{premiumSummary.totalCount} transactions • {premiumSummary.totalVolume ? String(premiumSummary.totalVolume) : '—'}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.premiumBalanceLabel}>Balance</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={styles.premiumBalanceValue}>{isBalanceVisible && walletBalance !== null && walletBalance !== undefined ? `₦${Number(walletBalance).toLocaleString()}` : (isBalanceVisible ? '—' : '••••••')}</Text>
                                <TouchableOpacity onPress={() => setIsBalanceVisible((s) => !s)} style={styles.eyeBtn} accessibilityLabel={isBalanceVisible ? 'Hide balance' : 'Show balance'}>
                                    <Ionicons name={isBalanceVisible ? 'eye' : 'eye-off'} size={18} color={theme.colors.muted || '#888'} />
                                </TouchableOpacity>
                            </View>
                        </View>
                </View>

                <View style={styles.searchFilterRow}>
                    <TextInput
                        placeholder="Search by name, amount, or tag"
                        placeholderTextColor={theme.colors.muted}
                        style={[styles.searchInput, { color: theme.colors.text }]}
                        value={searchText}
                        onChangeText={setSearchText}
                    />
                    <TouchableOpacity onPress={openFilter} style={styles.filterBtn}><Ionicons name="filter" size={24} color={theme.colors.white || '#fff'} /></TouchableOpacity>
                </View>

                <View style={styles.presetRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TouchableOpacity style={styles.presetBtn} onPress={() => applyPreset('all')}><Text style={styles.presetBtnText}>All</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.presetBtn} onPress={() => applyPreset('7')}><Text style={styles.presetBtnText}>Last 7d</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.presetBtn} onPress={() => applyPreset('30')}><Text style={styles.presetBtnText}>Last 30d</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.presetBtn} onPress={() => applyPreset('confirmations')}><Text style={styles.presetBtnText}>Confirmations</Text></TouchableOpacity>
                    </View>
                    {/* <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TouchableOpacity style={styles.exportBtn} onPress={exportFilteredAsCSV}>
                            <Text style={[styles.presetBtnText, styles.exportBtnText]}>Export CSV</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.exportBtn, styles.exportPdfBtn]} onPress={exportFilteredAsPDF}>
                            <Text style={[styles.presetBtnText, styles.exportPdfBtnText]}>Export PDF</Text>
                        </TouchableOpacity>
                    </View> */}
                </View>
            </View>
        </>
    );

    const visibleData = filtered.slice(0, visibleCount);

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background || '#f9f9f9' }}>
            <ScreenHeader title="Transaction History" backgroundColor={theme.colors.background || '#f9f9f9'} />
            <View style={styles.container}>
                {/* Always show the search bar and filter immediately */}
                {renderHeader()}

                {/* Show loading skeletons under the header while data is being fetched for the first time */}
                {loading && !dataFetched ? (
                    <View style={{ paddingHorizontal: 20, paddingTop: 6 }}>
                        {[...Array(6)].map((_, idx) => (
                            <View key={idx} style={{ marginBottom: 12 }}>
                                <SkeletonBox height={70} width={'100%'} radius={10} />
                            </View>
                        ))}
                    </View>
                ) : (
                    filtered.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No transactions yet — start your trading journey.</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={visibleData}
                            keyExtractor={(item) => item._id || String(item.time)}
                            renderItem={renderTxn}
                            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                            initialNumToRender={12}
                            maxToRenderPerBatch={12}
                            windowSize={7}
                            onEndReached={loadMore}
                            onEndReachedThreshold={0.5}
                            ListFooterComponent={() => visibleCount < filtered.length ? (<View style={{ padding: 12, alignItems: 'center' }}><Text style={{ color: theme.colors.muted || '#666' }}>Loading more…</Text></View>) : null}
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            contentContainerStyle={{ paddingBottom: 100, paddingTop: 6 }}
                        />
                    )
                )}
            </View>

            {/* Render modal at root so it isn't re-created as part of the ListHeaderComponent (prevents blinking) */}
            {renderFilterModal()}

            {/* Date pickers rendered at root to avoid being blocked by the modal overlay on Android */}
            {ModalDateTimePicker ? (
                <>
                    <ModalDateTimePicker
                        isVisible={showStartPicker}
                        mode="date"
                        date={modalStartDate ?? new Date()}
                        onConfirm={(date: Date) => {
                            setModalStartDate(date);
                            setStartDate(date);
                            setShowStartPicker(false);
                        }}
                        onCancel={() => setShowStartPicker(false)}
                    />
                    <ModalDateTimePicker
                        isVisible={showEndPicker}
                        mode="date"
                        date={modalEndDate ?? new Date()}
                        onConfirm={(date: Date) => {
                            setModalEndDate(date);
                            setEndDate(date);
                            setShowEndPicker(false);
                        }}
                        onCancel={() => setShowEndPicker(false)}
                    />
                </>
            ) : (
                <>
                    {showStartPicker && (
                        <DateTimePicker
                            value={modalStartDate ?? new Date()}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(e: any, date?: Date | undefined) => {
                                try {
                                    if (Platform.OS === 'android') {
                                        if (e?.type === 'set' && date) {
                                            setModalStartDate(date);
                                            setStartDate(date);
                                            setTimeout(() => setShowStartPicker(false), 50);
                                        } else {
                                            setShowStartPicker(false);
                                        }
                                    } else {
                                        if (date) {
                                            setModalStartDate(date);
                                            setStartDate(date);
                                        }
                                    }
                                } catch (err) {
                                    setShowStartPicker(false);
                                }
                            }}
                        />
                    )}

                    {showEndPicker && (
                        <DateTimePicker
                            value={modalEndDate || new Date()}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(e: any, date?: Date | undefined) => {
                                try {
                                    if (Platform.OS === 'android') {
                                        if (e?.type === 'set' && date) {
                                            setModalEndDate(date);
                                            setEndDate(date);
                                            setTimeout(() => setShowEndPicker(false), 50);
                                        } else {
                                            setShowEndPicker(false);
                                        }
                                    } else {
                                        if (date) {
                                            setModalEndDate(date);
                                            setEndDate(date);
                                        }
                                    }
                                } catch (err) {
                                    setShowEndPicker(false);
                                }
                            }}
                        />
                    )}
                </>
            )}

            

            {/* Bottom Navigation (shared) */}
            <NavBar
                active={currentScreen === 'Dashboard' ? 'Home' : currentScreen === 'History' ? 'History' : currentScreen === 'Profile' ? 'Profile' : 'Help'}
                onPress={async (tab) => {
                    try {
                        if (tab === 'Home') {
                            if (currentScreen !== 'Dashboard') navigation.replace('Dashboard');
                        } else if (tab === 'History') {
                            if (currentScreen !== 'History') navigation.replace('History');
                        } else if (tab === 'Profile') {
                            if (currentScreen !== 'Profile') navigation.replace('Profile');
                        } else if (tab === 'Help') {
                            navigation.navigate('Help');
                        }
                    } catch (err) {
                        if (tab === 'Help') {
                            const url = 'https://exdollarium.com';
                            try {
                                const supported = await Linking.canOpenURL(url);
                                if (supported) await Linking.openURL(url);
                                else Alert.alert('Error', 'Cannot open help link.');
                            } catch (e) {
                                Alert.alert('Error', 'Failed to open help link.');
                            }
                        }
                    }
                }}
            />
        </View>
    );
};

const createStyles = (t: any) => StyleSheet.create({
    container: {  backgroundColor: t.colors.background || '#f9f9f9', flex: 1 },
    title: { fontSize: 20, fontWeight: 'bold', color: t.colors.primary },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    searchFilterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        paddingHorizontal: 10,
    },
    premiumHeader: {
        backgroundColor: t.colors.surface || '#fff',
        padding: 12,
        borderRadius: 12,
        marginBottom: 12,
        elevation: 2,
    },
    premiumTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    premiumTitle: { fontSize: 16, fontWeight: '700', color: t.colors.primary },
    premiumSubtitle: { fontSize: 12, color: t.colors.muted },
    premiumBalanceLabel: { fontSize: 12, color: t.colors.muted, textAlign: 'right' },
    premiumBalanceValue: { fontSize: 16, fontWeight: '700', color: t.colors.primary, textAlign: 'right' },
    searchInput: {
        flex: 1,
        backgroundColor: t.colors.surface || '#fff',
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: 10,
        fontSize: 14,
        elevation: 2,
        marginRight: 10,
        color: t.colors.text,
    },
    filterBtn: {
        backgroundColor: t.colors.primary,
        padding: 10,
        borderRadius: 8,
        elevation: 3,
    },
    txCard: {
        padding: 12,
        backgroundColor: t.colors.surface || '#fff',
        borderRadius: 10,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 1,
    },
    sectionHeader: { paddingVertical: 8, paddingHorizontal: 6, backgroundColor: 'transparent' },
    sectionHeaderText: { fontSize: 13, fontWeight: '700', color: t.colors.muted },
    presetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, flexWrap: 'wrap' },
    presetBtn: { backgroundColor: t.colors.surface || '#fff', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, marginRight: 8, borderWidth: 1, borderColor: t.colors.border || '#ddd' },
    presetBtnText: { fontSize: 13, fontWeight: '700', color: t.colors.text },
    presetBtnSelected: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
    presetBtnTextSelected: { color: pickContrastText(t.colors.primary, t.colors.white, t.colors.text) },
    exportBtn: { backgroundColor: t.colors.primary, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, marginLeft: 8, minWidth: 96, alignItems: 'center', justifyContent: 'center' },
    exportPdfBtn: { backgroundColor: t.colors.surface || '#fff', borderWidth: 1, borderColor: t.colors.primary },
    exportBtnText: { color: pickContrastText(t.colors.primary, t.colors.white, t.colors.text), fontWeight: '700' },
    exportPdfBtnText: { color: t.colors.primary, fontWeight: '700' },
    eyeBtn: { marginLeft: 8, padding: 6 },
    bottomNav: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-around',
        backgroundColor: t.colors.surface || '#fff',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderColor: t.colors.border || '#ccc',
        elevation: 5,
    },
    navItem: {
        alignItems: 'center',
    },
    navItemPressed: {
        opacity: 0.6,
        transform: [{ scale: 0.995 }],
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    filterModal: {
        backgroundColor: t.colors.surface || '#fff',
        padding: 20,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '90%',
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    closeBtn: { padding: 6 },
    chipsRow: { marginTop: 6, marginBottom: 6 },
    chip: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: t.colors.backgroundAlt || t.colors.surface,
        marginRight: 8,
        borderWidth: 1,
        borderColor: t.colors.border || '#ddd'
    },
    chipSelected: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
    chipText: { fontWeight: '600', color: t.colors.text },
    dateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
    dateText: { fontSize: 14 },
    placeholder: { color: t.colors.muted },
    btnRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
    resetBtn: { flex: 1, backgroundColor: t.colors.surface, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: t.colors.border || '#ddd', marginRight: 10 },
    resetText: { color: t.colors.text, fontWeight: '600' },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
        color: t.colors.primary,
    },
    modalLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginTop: 15,
        marginBottom: 5,
        color: t.colors.muted || '#666',
    },
    applyBtn: {
        backgroundColor: t.colors.primary,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        flex: 1,
    },
    applyText: {
        color: t.colors.white || '#fff',
        fontWeight: 'bold',
        fontSize: 15,
    },
    typeButton: {
        backgroundColor: t.colors.mutedBackground || '#eee',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    typeButtonSelected: {
        backgroundColor: t.colors.primary,
    },
    datePickerBtn: {
        backgroundColor: t.colors.backgroundAlt || '#f0f0f0',
        padding: 12,
        borderRadius: 8,
        marginTop: 5,
    },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
    emptyText: { color: t.colors.muted || '#666', fontSize: 15 },
});

export default HistoryScreen;
