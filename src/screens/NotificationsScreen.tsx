import React, { useEffect, useState, useRef, useMemo } from 'react';
import { SafeAreaView, View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import ScreenHeader from '../components/ScreenHeader';
import { getNotifications, markNotificationRead, markAllNotificationsRead, getTransactionReceipt, getConfirmationReceipt } from '../api/client';
import ConfirmModal from '../components/ConfirmModal';
import { showToast } from '../utils/toast';
import { normalizeTransactionRef } from '../utils/receiptHelpers';
import { buildTransactionReceipt, buildConfirmationReceipt } from '../utils/receiptBuilders';
import { sanitizeReceipt } from '../utils/receiptSanitizer';
import simpleCache from '../utils/simpleCache';
const { get: simpleCacheGet, set: simpleCacheSet, getLastLoadedAt: simpleCacheGetLastLoadedAt, setFetching: simpleCacheSetFetching, isFetching: simpleCacheIsFetching } = simpleCache;
import { useTheme } from '../theme/index';

const NotificationsScreen = () => {
  const navigation: any = useNavigation();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  
  const isMountedRef = useRef(true);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState<string | undefined>(undefined);
  const [confirmMessage, setConfirmMessage] = useState<string | undefined>(undefined);
  const [confirmConfirmText, setConfirmConfirmText] = useState<string | undefined>(undefined);
  const [confirmCancelText, setConfirmCancelText] = useState<string | undefined>(undefined);
  const confirmResolver = useRef<((v: boolean) => void) | null>(null);

  const showConfirm = (opts: { title?: string; message?: string; confirmText?: string; cancelText?: string }) => {
    return new Promise<boolean>((resolve) => {
      confirmResolver.current = resolve;
      setConfirmTitle(opts.title);
      setConfirmMessage(opts.message);
      setConfirmConfirmText(opts.confirmText ?? 'Confirm');
      setConfirmCancelText(opts.cancelText ?? 'Cancel');
      setConfirmVisible(true);
    });
  };

  const closeConfirm = (result: boolean) => {
    setConfirmVisible(false);
    confirmResolver.current?.(result);
    confirmResolver.current = null;
  };

  const load = async (opts: { force?: boolean } = {}) => {
    if (simpleCacheIsFetching('notifications')) return;
    
    const cached = simpleCacheGet('notifications');
    if (cached && !opts.force) {
      setNotifications(cached);
      setUnreadCount(cached.filter((n: any) => !n.read).length);
      setLoading(false);
    }

    const TTL = 2 * 60 * 1000;
    const last = simpleCacheGetLastLoadedAt('notifications');
    if (!opts.force && last && (Date.now() - last) < TTL) return;

    simpleCacheSetFetching('notifications', true);
    try {
      const res = await getNotifications();
      const list = res.notifications || res.data || [];
      simpleCacheSet('notifications', list);
      setNotifications(list);
      setUnreadCount(list.filter((n: any) => !n.read).length);
    } catch (e) {
      console.warn('Failed to load notifications', e);
    } finally {
      simpleCacheSetFetching('notifications', false);
      if (isMountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    load();
    return () => { isMountedRef.current = false; };
  }, []);

  const handleMarkAll = async () => {
    try {
      const updated = notifications.map((n) => ({ ...n, read: true }));
      setNotifications(updated);
      simpleCacheSet('notifications', updated);
      setUnreadCount(0);
      await markAllNotificationsRead();
      showToast('All notifications marked read');
    } catch (e) {
      showToast('Failed to mark all notifications');
      load({ force: true });
    }
  };

  const handleMarkOne = async (item: any) => {
    try {
      await markNotificationRead(item._id);
      const updated = notifications.map((n) => (n._id === item._id ? { ...n, read: true } : n));
      setNotifications(updated);
      simpleCacheSet('notifications', updated);
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      showToast('Failed to update notification');
    }
  };

  const handlePress = async (item: any) => {
    const id = item.transactionId || item.transactionRef || item.resourceId || normalizeTransactionRef(item.message || '');
    
    // Mark as read immediately on press for better UX
    if (!item.read) handleMarkOne(item);

    if (item.type?.toLowerCase().includes('presubmission')) {
      navigation.navigate('MyPreSubmissions');
      return;
    }

    // Handle Receipt Navigation
    try {
      const trxResp = id ? await getTransactionReceipt(id).catch(() => null) : null;
      if (trxResp) {
        const receiptData = sanitizeReceipt(buildTransactionReceipt(trxResp));
        navigation.navigate('Receipt', { receiptData });
        return;
      }
    } catch (e) {
      Alert.alert('Notice', 'Details for this notification are no longer available.');
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      onPress={() => handlePress(item)} 
      style={[styles.notificationCard, !item.read && styles.unreadCard]}
    >
      <View style={styles.cardContent}>
        <View style={[styles.statusDot, { backgroundColor: item.read ? 'transparent' : theme.colors.primary }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.messageText, !item.read && styles.unreadText]}>
            {item.message}
          </Text>
          <Text style={styles.dateText}>
            {new Date(item.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.colors.muted} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title={`Notifications${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
        onBack={() => navigation.goBack()}
      />

      {/* Full-width Mark All button (appears above the list) */}
      {unreadCount > 0 && (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <TouchableOpacity
            onPress={async () => {
              const ok = await showConfirm({
                title: 'Mark all read?',
                message: 'This will mark all notifications as seen.',
                confirmText: 'Mark all'
              });
              if (ok) handleMarkAll();
            }}
            style={styles.fullMarkAllBtn}
          >
            <Text style={styles.fullMarkAllBtnText}>Mark all as read</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.center}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="notifications-off-outline" size={48} color={theme.colors.muted} />
            </View>
            <Text style={styles.emptyTitle}>You're all caught up 🎉</Text>
            <Text style={styles.emptySubtitle}>No notifications at the moment</Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(i) => i._id}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 16 }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <ConfirmModal
        visible={confirmVisible}
        title={confirmTitle}
        message={confirmMessage}
        confirmText={confirmConfirmText}
        cancelText={confirmCancelText}
        onConfirm={() => closeConfirm(true)}
        onCancel={() => closeConfirm(false)}
      />
    </SafeAreaView>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  
  headerBtn: { 
    backgroundColor: theme.colors.primary + '20', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 8 
  },
  headerBtnText: { color: theme.colors.primary, fontWeight: '700', fontSize: 13 },

  notificationCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  unreadCard: {
    backgroundColor: theme.colors.primary + '05', // Very subtle primary tint for unread
    borderColor: theme.colors.primary + '20',
  },
  cardContent: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  
  messageText: { 
    color: theme.colors.text, 
    fontSize: 14, 
    lineHeight: 20,
    fontWeight: '400' 
  },
  unreadText: { fontWeight: '700' },
  dateText: { color: theme.colors.muted, fontSize: 11, marginTop: 4 },

  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20
  },
  emptyTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '700' },
  emptySubtitle: { color: theme.colors.muted, fontSize: 14, marginTop: 4, textAlign: 'center' }
,
  fullMarkAllBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  fullMarkAllBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 }
});

export default NotificationsScreen;