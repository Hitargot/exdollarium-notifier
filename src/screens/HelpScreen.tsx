import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Linking,
  Alert,
  Platform,
  Modal,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/index';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import socket from '../utils/socket';
import { getTickets, getProfile } from '../api/client';
import SkeletonBox from '../components/SkeletonBox';
import { API_URL as BACKEND_URL } from './HistoryScreen';
import { Ionicons } from '@expo/vector-icons';

type FAQ = { _id: string; question: string; answer: string };

const HelpScreen = () => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const navigation = useNavigation<any>();
const [expandedId, setExpandedId] = useState<string | null>(null);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loadingFaqs, setLoadingFaqs] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastAdminMessage, setLastAdminMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);
  const [faqWebVisible, setFaqWebVisible] = useState(false);
  const [faqLoading, setFaqLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadFaqs();
    loadProfile();
    refreshTickets();

    const handler = () => { if (mounted) refreshTickets(); };
    let initialized = false;
    (async () => {
      try {
        await socket.initSocket();
        socket.on('ticket:reply', handler);
        socket.on('ticket:new', handler);
        socket.on('ticket:status', handler);
        initialized = true;
      } catch (e) {
        console.warn('Socket init failed for HelpScreen', e);
      }
    })();

    return () => {
      mounted = false;
      if (initialized) {
        socket.off('ticket:reply', handler);
        socket.off('ticket:new', handler);
        socket.off('ticket:status', handler);
      }
    };
  }, []);

  async function loadProfile() {
    setLoadingProfile(true);
    try {
      const res = await getProfile().catch(() => null);
      setProfile(res?.data || res);
    } finally {
      setLoadingProfile(false);
    }
  }

  async function loadFaqs() {
    setLoadingFaqs(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/faqs`);
      setFaqs(res?.data || []);
    } catch (e) {
      setFaqs([]);
    } finally {
      setLoadingFaqs(false);
    }
  }

  async function refreshTickets() {
    const res = await getTickets().catch(() => ({ tickets: [] }));
    const list = res.tickets || res || [];
    setTickets(list);
    try {
      const raw = await AsyncStorage.getItem('ticket_seen_counts');
      const seen = raw ? JSON.parse(raw) : {};
      const unreadAdminReplies: any[] = [];

      for (const tt of (list || [])) {
        const replies = tt.replies || [];
        const seenCount = seen[String(tt._id)] || 0;
        for (let i = seenCount; i < replies.length; i++) {
          const role = String(replies[i].senderRole || '').toLowerCase();
          if (role === 'admin' || role === 'support') {
            unreadAdminReplies.push({ 
                message: replies[i].message, 
                at: replies[i].at || replies[i].createdAt 
            });
          }
        }
      }

      setUnreadCount(unreadAdminReplies.length);
      if (unreadAdminReplies.length) {
        unreadAdminReplies.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
        setLastAdminMessage(unreadAdminReplies[0].message);
      } else {
        setLastAdminMessage(null);
      }
    } catch (e) { console.warn(e); }
  }

  const openXChat = async () => {
    const url = 'https://x.com/exdollarium';
    try { await Linking.openURL(url); } catch { Alert.alert('Error', 'Unable to open X'); }
  };

  const openFaq = () => setFaqWebVisible(true);

  const handleOpenMessages = async () => {
    try {
      const raw = await AsyncStorage.getItem('ticket_seen_counts');
      const seen = raw ? JSON.parse(raw) : {};
      const updated = { ...seen };
      tickets.forEach(tt => { updated[String(tt._id)] = tt.replies?.length || 0; });
      await AsyncStorage.setItem('ticket_seen_counts', JSON.stringify(updated));
      setUnreadCount(0);
      setLastAdminMessage(null);
    } catch (e) { console.warn(e); }
    navigation.navigate('Messages');
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* HEADER: Circle Profile Style */}
        <View style={styles.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity style={styles.profileCircle} onPress={() => navigation.navigate('Profile')}>
              <Text style={styles.profileInitials}>
                {(() => {
                  const name = profile?.name || profile?.fullName || profile?.username || '';
                  if (!name) return 'U';
                  const parts = name.trim().split(/\s+/);
                  return parts.length >= 2 
                    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() 
                    : name.substring(0, 2).toUpperCase();
                })()}
              </Text>
            </TouchableOpacity>
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.welcomeSub}>Support Center</Text>
              {/* Show loading indicator while profile is being fetched; prefer username over full name */}
              {loadingProfile ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Text style={styles.welcome} numberOfLines={1}>
                  {profile?.username || ''}
                </Text>
              )}
            </View>
          </View>

          <TouchableOpacity style={styles.xHeaderBtn} onPress={openXChat}>
            <Image source={require('../../assets/ex_logo.png')} style={styles.xIconSmall} />
          </TouchableOpacity>
        </View>

        {/* SUPPORT CARDS */}
        <View style={styles.actionsRow}>
          <SupportCard
            icon="chatbubble-ellipses-outline"
            title="Messages"
            subtitle={unreadCount > 0 ? (lastAdminMessage?.slice(0, 30) + '...') : 'View responses'}
            badge={unreadCount > 0 ? unreadCount : null}
            onPress={handleOpenMessages}
            color="#6366F1"
          />
          <SupportCard
            icon="ticket-outline"
            title="Tickets"
            subtitle="Track issues"
            onPress={() => navigation.navigate('Tickets')}
            color="#EC4899"
          />
        </View>

        {/* FAQ SECTION */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Popular Questions</Text>
          <TouchableOpacity onPress={openFaq}><Text style={styles.seeAll}>Full FAQ</Text></TouchableOpacity>
        </View>

        {loadingFaqs ? (
          <View>{[1, 2, 3].map(i => (
            <View key={i} style={{ marginBottom: 12 }}>
              <SkeletonBox height={60} width="100%" radius={12} />
            </View>
          ))}</View>
        ) : (
          faqs.slice(0, 6).map(item => (
            <FaqItem 
              key={item._id} 
              item={item} 
              isExpanded={expandedId === item._id}
              onToggle={() => setExpandedId(expandedId === item._id ? null : item._id)}
            />
          ))
        )}

        <TouchableOpacity style={styles.liveChatBtn} onPress={openXChat} activeOpacity={0.8}>
          <View style={styles.xIconContainer}>
             <Ionicons name="logo-twitter" size={20} color="#000" />
          </View>
          <Text style={styles.liveChatText}>Chat with us on X</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* WEBVIEW MODAL */}
      <Modal visible={faqWebVisible} animationType="slide" onRequestClose={() => setFaqWebVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setFaqWebVisible(false)}><Ionicons name="close" size={28} color={theme.colors.text} /></TouchableOpacity>
            <Text style={styles.modalTitle}>Help Center</Text>
            <View style={{ width: 28 }} />
          </View>
          {(() => {
            try {
              const WebView = require('react-native-webview').WebView;
              return <WebView source={{ uri: 'https://exdollarium.com/#faq' }} onLoadStart={() => setFaqLoading(true)} onLoadEnd={() => setFaqLoading(false)} />;
            } catch (e) { return <View style={styles.center}><Text>WebView unavailable</Text></View>; }
          })()}
          {faqLoading && <ActivityIndicator style={styles.absoluteLoader} color={theme.colors.primary} />}
        </SafeAreaView>
      </Modal>
    </View>
  );
};

/* ---------- Components ---------- */

const SupportCard = ({ icon, title, subtitle, badge, onPress, color }: any) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.cardIconBox, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSub} numberOfLines={1}>{subtitle}</Text>
      </View>
      {badge && <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>}
    </TouchableOpacity>
  );
};

/* ---------- New Dropdown Component ---------- */

const FaqItem = ({ item, isExpanded, onToggle }: { item: FAQ, isExpanded: boolean, onToggle: () => void }) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    <TouchableOpacity 
      style={[styles.faqCard, isExpanded && styles.faqCardExpanded]} 
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={styles.faqHeader}>
        <Text style={[styles.faqQ, isExpanded && { color: theme.colors.primary }]}>{item.question}</Text>
        <Ionicons 
          name={isExpanded ? "chevron-up" : "chevron-down"} 
          size={20} 
          color={isExpanded ? theme.colors.primary : theme.colors.muted} 
        />
      </View>
      
      {isExpanded && (
        <View style={styles.faqBody}>
          <View style={styles.faqDivider} />
          <Text style={styles.faqA}>{item.answer}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

/* ---------- Styles ---------- */

const createStyles = (t: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.colors.background, paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 0 : 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, marginTop: 10 },
  profileCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: t.colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  profileInitials: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  welcomeSub: { fontSize: 12, color: t.colors.muted, fontWeight: '500' },
  welcome: { fontSize: 18, fontWeight: '800', color: t.colors.text, maxWidth: 180 },
  xHeaderBtn: { padding: 4 },
  xIconSmall: { width: 24, height: 24, borderRadius: 6 },
  actionsRow: { flexDirection: 'column', gap: 12, marginBottom: 24 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: t.colors.border },
  cardIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: t.colors.text },
  cardSub: { fontSize: 13, color: t.colors.muted, marginTop: 2 },
  badge: { backgroundColor: t.colors.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: t.colors.text },
  seeAll: { color: t.colors.primary, fontWeight: '700', fontSize: 14 },
  faqCard: { backgroundColor: t.colors.surface, borderRadius: 14,overflow: 'hidden', padding: 10, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: t.colors.primary, elevation: 1 },
  faqQ: { fontWeight: '700', color: t.colors.text, fontSize: 15, marginBottom: 6 },
  faqA: { color: t.colors.muted, fontSize: 14, lineHeight: 20 },
  liveChatBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', borderRadius: 16, padding: 16, marginTop: 10 },
  xIconContainer: { backgroundColor: '#FFF', borderRadius: 6, padding: 4, marginRight: 12 },
  liveChatText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: t.colors.border },
  modalTitle: { fontSize: 17, fontWeight: '700', color: t.colors.text },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  faqCardExpanded: {
    borderColor: t.colors.primary + '40', // Slight primary tint when open
    elevation: 2,
    shadowColor: t.colors.primary,
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
 
  faqBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  faqDivider: {
    height: 1,
    backgroundColor: t.colors.border,
    marginBottom: 12,
    opacity: 0.5,
  },
  
  absoluteLoader: { position: 'absolute', top: '50%', left: '50%', marginLeft: -10 },
});

export default HelpScreen;