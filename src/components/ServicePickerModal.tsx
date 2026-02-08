import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
    View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator, 
    TextInput, Dimensions, ScrollView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; // Ensure this is installed
import Constants from 'expo-constants';
import SkeletonBox from './SkeletonBox';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme/index';
import theme from '../styles/theme';
import { pickContrastText } from '../theme/colorUtils';

type Extra = { apiUrl: string; env: string };
const extra = Constants.expoConfig?.extra as Extra;
export const API_URL = extra?.apiUrl || 'https://exdollarium-6f0f5aab6a7d.herokuapp.com';

type Service = { _id: string; name: string; label?: string; supportsWithdrawal?: boolean; isNew?: boolean };

const PAGE_SIZE = 30;

export default function ServicePickerModal({
    visible,
    onClose,
    onSelect,
    selectedId,
    selectedService,
    services: servicesProp,
    loading: loadingProp,
    title = 'Select Service',
    autoLoad = true,
}: {
    visible: boolean;
    onClose: () => void;
    onSelect: (s: any) => void;
    selectedId?: string;
    selectedService?: string;
    services?: any[];
    loading?: boolean;
    title?: string;
    autoLoad?: boolean;
}) {
    const [query, setQuery] = useState('');
    const [services, setServices] = useState<Service[]>([]);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [favorites, setFavorites] = useState<string[]>([]);
    const [recent, setRecent] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<'withdrawal' | 'general'>('general');
    const servicesMap = useRef<Record<string, Service>>({});
    const [currentSelectedName, setCurrentSelectedName] = useState<string | null>(null);

    const themeCtx = (() => { try { return useTheme(); } catch (e) { return undefined; } })();
    const runtimeTheme = themeCtx || theme;
    const isDark = runtimeTheme.dark || runtimeTheme.mode === 'dark';
    const styles = useMemo(() => createStyles(runtimeTheme), [runtimeTheme]);

    useEffect(() => {
        if (visible) {
            if (autoLoad) {
                setServices([]);
                setPage(1);
                setHasMore(true);
            }
            fetchFavorites();
            fetchRecent();
            
            if (servicesProp && Array.isArray(servicesProp)) {
                const normalized = servicesProp.map((s: any) => typeof s === 'string' ? { _id: s, name: s } : s);
                normalized.forEach((s: Service) => { if (s && s._id) servicesMap.current[s._id] = s; });
                setServices(normalized);
                setLoading(Boolean(loadingProp));
            } else if (autoLoad) {
                fetchServices(1, query, true);
            }

            const cid = selectedId || selectedService || null;
            if (cid) {
                const found = Object.values(servicesMap.current).find((x: Service) => String(x._id) === String(cid) || String(x.name) === String(cid));
                if (found) setCurrentSelectedName(found.name);
                else if (autoLoad) fetchServiceById(String(cid)).then(() => { if (servicesMap.current[cid]) setCurrentSelectedName(servicesMap.current[cid].name); });
            }
        }
    }, [visible]);

    useEffect(() => {
        if (!autoLoad) return;
        const t = setTimeout(() => {
            fetchServices(1, query, true);
        }, 300);
        return () => clearTimeout(t);
    }, [query]);

    const fetchFavorites = async () => {
        try {
            const raw = await AsyncStorage.getItem('favoriteServices');
            if (raw) setFavorites(JSON.parse(raw));
        } catch (e) {}
    };

    const fetchRecent = async () => {
        try {
            const raw = await AsyncStorage.getItem('recentServices');
            if (raw) setRecent(JSON.parse(raw));
        } catch (e) {}
    };

    const fetchServices = async (pageToFetch = 1, q = '', replace = false) => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/services`, { params: { q, page: pageToFetch, pageSize: PAGE_SIZE } });
            const data: Service[] = res.data || [];
            data.forEach(s => servicesMap.current[s._id] = s);
            setServices(prev => replace ? data : [...prev, ...data]);
            setHasMore(data.length === PAGE_SIZE);
            setPage(pageToFetch + 1);
        } catch (e) {} finally { setLoading(false); }
    };

    const fetchServiceById = async (id: string) => {
        try {
            const res = await axios.get(`${API_URL}/api/services/${id}`);
            if (res.data) servicesMap.current[res.data._id] = res.data;
        } catch (e) {}
    };

    const pickService = async (s: Service) => {
        const cid = selectedId || selectedService || null;
        if (cid === s._id) return onClose();
        
        try {
            const raw = await AsyncStorage.getItem('recentServices');
            let arr = raw ? JSON.parse(raw) : [];
            arr = [s._id, ...arr.filter((id: string) => id !== s._id)].slice(0, 8);
            await AsyncStorage.setItem('recentServices', JSON.stringify(arr));
        } catch (e) {}

        onSelect(typeof selectedService !== 'undefined' ? s._id : s);
        onClose();
    };

    const toggleFavorite = async (id: string) => {
        let arr = favorites.includes(id) ? favorites.filter(a => a !== id) : [id, ...favorites];
        setFavorites(arr);
        await AsyncStorage.setItem('favoriteServices', JSON.stringify(arr));
    };

    const renderItem = (item: Service) => {
        const cid = selectedId || selectedService || null;
        const isSelected = cid ? (String(cid) === String(item._id) || String(cid) === String(item.name)) : false;
        const isFav = favorites.includes(item._id);

        return (
            <TouchableOpacity 
                key={item._id}
                style={[styles.card, isSelected && { borderColor: runtimeTheme.colors.primary, backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }]} 
                onPress={() => pickService(item)}
            >
                <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: isSelected ? runtimeTheme.colors.primary : runtimeTheme.colors.text }]}>{item.name}</Text>
                    {item.label && <Text style={styles.cardLabel}>{item.label}</Text>}
                </View>
                <TouchableOpacity onPress={() => toggleFavorite(item._id)} style={styles.favoriteBtn}>
                    <Ionicons name={isFav ? 'star' : 'star-outline'} size={20} color={isFav ? '#FACC15' : runtimeTheme.colors.muted} />
                </TouchableOpacity>
                {item.isNew && !isSelected && (
                    <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>
                )}
            </TouchableOpacity>
        );
    };

    const q = query.toLowerCase();
    const filtered = services.filter(s => {
        const matchesQuery = s.name.toLowerCase().includes(q) || (s.label || '').toLowerCase().includes(q);
        const isWithdraw = (typeof s.supportsWithdrawal === 'boolean' ? s.supportsWithdrawal : s.name.toLowerCase().includes('withdraw'));
        return matchesQuery && (selectedCategory === 'withdrawal' ? isWithdraw : !isWithdraw);
    });

    const favoriteServices = favorites.map(id => servicesMap.current[id]).filter(Boolean);

    return (
        <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
            {/* SafeAreaView prevents content from hiding under the status bar/notch */}
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{title}</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={28} color={runtimeTheme.colors.text} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.searchRow}>
                        <Ionicons name="search" size={20} color={runtimeTheme.colors.muted} />
                        <TextInput 
                            placeholder="Search services..." 
                            placeholderTextColor={runtimeTheme.colors.muted}
                            style={styles.searchInput}
                            value={query}
                            onChangeText={setQuery}
                        />
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                        {favoriteServices.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Favorites</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                                    {favoriteServices.map(s => (
                                        <TouchableOpacity key={s._id} style={styles.chip} onPress={() => pickService(s)}>
                                            <Text style={styles.chipText}>{s.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        <View style={styles.tabBar}>
                            <TouchableOpacity 
                                onPress={() => setSelectedCategory('general')}
                                style={[styles.tab, selectedCategory === 'general' && styles.tabActive]}
                            >
                                <Text style={[styles.tabText, selectedCategory === 'general' && styles.tabTextActive]}>General</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => setSelectedCategory('withdrawal')}
                                style={[styles.tab, selectedCategory === 'withdrawal' && styles.tabActive]}
                            >
                                <Text style={[styles.tabText, selectedCategory === 'withdrawal' && styles.tabTextActive]}>Withdrawal</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.listGrid}>
                            {loading && filtered.length === 0 ? (
                                [1, 2, 3, 4].map(i => <SkeletonBox key={i} height={80} width="100%" radius={15} style={{ marginBottom: 10 }} />)
                            ) : (
                                filtered.map(s => renderItem(s))
                            )}
                            {!loading && filtered.length === 0 && (
                                <Text style={styles.emptyText}>No services found.</Text>
                            )}
                        </View>
                    </ScrollView>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const createStyles = (t: any) => {
    const isDark = t.dark || t.mode === 'dark';
    const tabBg = isDark ? '#1E293B' : '#F1F5F9';
    const tabActiveBg = isDark ? '#334155' : '#FFFFFF';
    const tabTextColor = isDark ? pickContrastText(tabBg, '#E6EEF9', t.colors.muted) : t.colors.muted;
    const tabActiveTextColor = pickContrastText(tabActiveBg, '#FFFFFF', t.colors.text);
    return StyleSheet.create({
        // Root container for the Modal
        safeArea: { 
            flex: 1, 
            backgroundColor: t.colors.background 
        },
        container: { 
            flex: 1, 
            paddingHorizontal: 20,
            // Removed manual paddingTop since SafeAreaView handles it
        },
        header: { 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'center', 
            marginBottom: 20,
            paddingTop: 10 // Extra breathing room
        },
        title: { fontSize: 22, fontWeight: '800', color: t.colors.text },
        closeBtn: { position: 'absolute', right: 0 },
        searchRow: { 
            flexDirection: 'row', alignItems: 'center', 
            backgroundColor: isDark ? '#1E293B' : '#F1F5F9', 
            borderRadius: 15, paddingHorizontal: 15, height: 50, marginBottom: 20 
        },
        searchInput: { flex: 1, marginLeft: 10, color: '#1E293B', fontSize: 16, fontWeight: '600' },
        section: { marginBottom: 20 },
        sectionTitle: { fontSize: 12, fontWeight: '800', color: t.colors.muted, textTransform: 'uppercase', marginBottom: 10, letterSpacing: 1 },
        chip: { 
            backgroundColor: isDark ? '#334155' : '#FFF', 
            borderWidth: 1, borderColor: isDark ? '#475569' : '#E2E8F0',
            paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 10 
        },
        chipText: { color: '#1E293B', fontWeight: '700', fontSize: 13 },
        tabBar: { 
            flexDirection: 'row', backgroundColor: isDark ? '#1E293B' : '#F1F5F9', 
            padding: 5, borderRadius: 12, marginBottom: 20 
        },
        tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
        tabActive: { backgroundColor: tabActiveBg, elevation: 2 },
    tabText: { fontWeight: '700', color: tabTextColor },
        tabTextActive: { color: '#1E293B' },
        listGrid: { width: '100%' },
        card: { 
            backgroundColor: t.colors.surface, borderRadius: 18, padding: 16, 
            marginBottom: 12, borderWidth: 1, borderColor: isDark ? '#334155' : '#F1F5F9',
            flexDirection: 'row', alignItems: 'center'
        },
        cardTitle: { fontSize: 16, fontWeight: '700' },
        cardLabel: { fontSize: 13, color: t.colors.muted, marginTop: 2 },
        favoriteBtn: { padding: 5 },
        newBadge: { 
            backgroundColor: t.colors.primary, paddingHorizontal: 8, 
            paddingVertical: 3, borderRadius: 6, marginLeft: 10 
        },
        newBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
        emptyText: { textAlign: 'center', color: t.colors.muted, marginTop: 20, fontWeight: '600' }
    });
};