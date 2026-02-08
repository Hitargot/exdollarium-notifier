import React, { useEffect, useState, useMemo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    TextInput,
    ScrollView,
    ActivityIndicator,
    FlatList,
} from 'react-native';
import axios from 'axios';
import authStorage from '../utils/authStorage';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, Feather } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import Constants from 'expo-constants';
import showToast from '../utils/toast';
import appTheme from '../styles/theme';
import { useTheme } from '../theme/index';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from './types';
import * as Animatable from 'react-native-animatable';
import SkeletonBox from '../components/SkeletonBox';

type Extra = { apiUrl: string; env: string };
const extra = Constants.expoConfig?.extra as Extra;
export const API_URL = extra.apiUrl;

type NavigationProp = StackNavigationProp<RootStackParamList, 'SendViaBankScreen'>;

const SendViaBankScreen = () => {
    const navigation = useNavigation<NavigationProp>();
    const themeCtx = (() => { try { return useTheme(); } catch (e) { return undefined as any; } })();
    const t = themeCtx || appTheme;
    const styles = useMemo(() => createStyles(t), [t]);

    const [search, setSearch] = useState('');
    const [recentBanks, setRecentBanks] = useState<any[]>([]);
    const [otherBanks, setOtherBanks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => { fetchBanks(); }, []);

    const fetchBanks = async () => {
        setLoading(true);
        try {
            const token = await authStorage.getToken();
            const res = await axios.get(`${API_URL}/api/wallet/banks`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const sorted = (res.data.banks || []).map((bank: any) => ({
                ...bank,
                _id: bank._id ?? bank.id ?? `${bank.bankName}-${bank.accountNumber}`,
                initials: (bank.accountName || '').split(' ').map((n: string) => n?.[0]).join('').toUpperCase().slice(0, 2)
            })).sort((a: any, b: any) => new Date(b.lastUsed || 0).getTime() - new Date(a.lastUsed || 0).getTime());

            setRecentBanks(sorted.slice(0, 5));
            setOtherBanks(sorted.slice(5));
        } catch (err) {
            showToast('Could not load bank accounts.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const goToWithdrawal = (bank: any) => {
        navigation.navigate('WithdrawalFormScreen', {
            selectedBank: { ...bank, bankCode: bank.bankCode || bank.code }
        });
    };

    const filteredOthers = otherBanks.filter(b => 
        b.accountName.toLowerCase().includes(search.toLowerCase()) || 
        b.bankName.toLowerCase().includes(search.toLowerCase())
    );

    // --- RENDER HELPERS ---
    const renderRecentItem = (item: any) => (
        <TouchableOpacity key={item._id} style={styles.recentAvatarWrapper} onPress={() => goToWithdrawal(item)}>
            <View style={styles.recentCircle}>
                <Text style={styles.recentCircleText}>{item.initials}</Text>
            </View>
            <Text style={styles.recentName} numberOfLines={1}>{item.accountName.split(' ')[0]}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.page}>
            <ScreenHeader title="Transfer to Bank" />
            
            <ScrollView 
                style={styles.container} 
                contentContainerStyle={{ paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Header Section */}
                <View style={styles.headerRow}>
                    <View>
                        <Text style={styles.greeting}>Send Money</Text>
                        <Text style={styles.subGreeting}>Choose a recipient or add a new one</Text>
                    </View>
                    <TouchableOpacity onPress={fetchBanks} style={styles.refreshBtn}>
                        {refreshing ? <ActivityIndicator size="small" color={t.colors.primary} /> : <Feather name="refresh-cw" size={18} color={t.colors.primary} />}
                    </TouchableOpacity>
                </View>

                {/* Add New Recipient Card */}
                <TouchableOpacity style={styles.addCard} onPress={() => navigation.navigate('AddBankScreen')}>
                    <View style={styles.addIconCircle}>
                        <Ionicons name="add" size={24} color="#FFF" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.addTitle}>New Recipient</Text>
                        <Text style={styles.addSubtitle}>Send to a new bank account</Text>
                    </View>
                    <Feather name="chevron-right" size={20} color={t.colors.muted} />
                </TouchableOpacity>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <Feather name="search" size={18} color={t.colors.muted} />
                    <TextInput
                        placeholder="Search name or bank..."
                        placeholderTextColor={t.colors.muted}
                        style={styles.searchInput}
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>

                {loading ? (
                    <View style={{ marginTop: 20 }}>
                        <SkeletonBox height={100} width="100%" radius={15} style={{ marginBottom: 15 }} />
                        <SkeletonBox height={70} width="100%" radius={15} style={{ marginBottom: 15 }} />
                    </View>
                ) : (
                    <>
                        {/* Recents Horizontal List */}
                        {!search && recentBanks.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionLabel}>Recents</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentList}>
                                    {recentBanks.map(renderRecentItem)}
                                </ScrollView>
                            </View>
                        )}

                        {/* Others Vertical List */}
                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>All Saved Accounts</Text>
                            {filteredOthers.length > 0 ? (
                                filteredOthers.map((item, index) => (
                                    <Animatable.View key={item._id} animation="fadeInUp" delay={index * 50} duration={400} useNativeDriver>
                                        <TouchableOpacity style={styles.bankCard} onPress={() => goToWithdrawal(item)}>
                                            <View style={styles.bankAvatar}>
                                                <Text style={styles.bankAvatarText}>{item.initials}</Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.bankCardName}>{item.accountName}</Text>
                                                <Text style={styles.bankCardDetail}>{item.bankName} • {item.accountNumber}</Text>
                                            </View>
                                            <Feather name="arrow-up-right" size={18} color={t.colors.muted} />
                                        </TouchableOpacity>
                                    </Animatable.View>
                                ))
                            ) : (
                                <View style={styles.emptyState}>
                                    <Feather name="users" size={40} color={t.colors.border} />
                                    <Text style={styles.emptyText}>No recipients found</Text>
                                </View>
                            )}
                        </View>
                    </>
                )}
            </ScrollView>
        </View>
    );
};

const createStyles = (t: any) => StyleSheet.create({
    page: { flex: 1, backgroundColor: t.colors.background },
    container: { flex: 1, padding: 20 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 25 },
    greeting: { fontSize: 24, fontWeight: '800', color: t.colors.text },
    subGreeting: { fontSize: 13, color: t.colors.muted, marginTop: 2 },
    refreshBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: t.colors.border },
    addCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.colors.surface, padding: 16, borderRadius: 20, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
    addIconCircle: { width: 45, height: 45, borderRadius: 15, backgroundColor: t.colors.primary, justifyContent: 'center', alignItems: 'center' },
    addTitle: { fontSize: 16, fontWeight: '700', color: t.colors.text },
    addSubtitle: { fontSize: 12, color: t.colors.muted },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.colors.surface, paddingHorizontal: 15, height: 50, borderRadius: 15, borderWidth: 1, borderColor: t.colors.border, marginBottom: 25 },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: t.colors.text },
    section: { marginBottom: 25 },
    sectionLabel: { fontSize: 14, fontWeight: '700', color: t.colors.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 15 },
    recentList: { paddingRight: 20 },
    recentAvatarWrapper: { alignItems: 'center', marginRight: 20, width: 70 },
    recentCircle: { width: 55, height: 55, borderRadius: 27.5, backgroundColor: `${t.colors.primary}15`, justifyContent: 'center', alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: `${t.colors.primary}30` },
    recentCircleText: { fontSize: 16, fontWeight: 'bold', color: t.colors.primary },
    recentName: { fontSize: 12, color: t.colors.text, fontWeight: '500' },
    bankCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.colors.surface, padding: 12, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: t.colors.border },
    bankAvatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: t.colors.background, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    bankAvatarText: { fontSize: 12, fontWeight: 'bold', color: t.colors.muted },
    bankCardName: { fontSize: 15, fontWeight: '700', color: t.colors.text },
    bankCardDetail: { fontSize: 12, color: t.colors.muted, marginTop: 2 },
    emptyState: { alignItems: 'center', marginTop: 40 },
    emptyText: { color: t.colors.muted, marginTop: 10, fontSize: 14 }
});

export default SendViaBankScreen;