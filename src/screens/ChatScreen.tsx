import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform, TouchableOpacity, Image, Linking, TouchableWithoutFeedback, Dimensions, Animated, Keyboard, KeyboardEvent, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import ChatRow from '../components/ChatRow';
import * as DocumentPicker from 'expo-document-picker';
import Constants from 'expo-constants';
import client, { getTicket, replyTicket, updateTicketStatus, getProfile } from '../api/client';
import authStorage from '../utils/authStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from './types';
import socket from '../utils/socket';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import appTheme from '../styles/theme';
import tokens from '../styles/tokens';
import ConfirmModal from '../components/ConfirmModal';
import { useTheme } from '../theme/index';
import { pickContrastText } from '../theme/colorUtils';

// Helper: shorten ticket id by removing dashes and returning first 8 chars
const shortTicketId = (id: string) => {
  if (!id) return '';
  return id.replace(/-/g, '').slice(0, 8);
};

// Attachment helpers
const getAttachmentUri = (a: any) => {
  if (!a) return null;
  if (typeof a === 'string') return a;
  if (a.uri) return a.uri;
  if (a.url) return a.url;
  if (a.location) return a.location;
  return null;
};

const isImageAttachment = (a: any) => {
  if (!a) return false;
  if (a.type && String(a.type).startsWith('image')) return true;
  const uri = getAttachmentUri(a);
  if (!uri) return false;
  return /\.(jpe?g|png|gif|webp|bmp)(\?.*)?$/i.test(uri);
};

// Format timestamp to a short friendly string
const formatTime = (iso: string | number | Date) => {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) { return String(iso); }
};

const ChatScreen: React.FC = () => {
  const extra = (Constants.expoConfig && (Constants.expoConfig as any).extra) || {};
  const apiBase = extra.apiUrl || '';

  const resolveAttachmentUrl = (a: any) => {
    if (!a) return null;
    const raw = (typeof a === 'string') ? a : (a.uri || a.url || a.location || a);
    if (!raw) return null;
    // If it's already an absolute URL or a local file/content/data URI, return as-is
    if (/^https?:\/\//i.test(raw) || /^file:\/\//i.test(raw) || /^content:\/\//i.test(raw) || /^data:/i.test(raw)) {
      // downgrade https localhost for dev and prefer expo apiUrl host when needed
      let u = String(raw);
      if (/localhost|127\.0\.0\.1/.test(u) && /^https:\/\//i.test(u)) u = u.replace(/^https:\/\//i, 'http://');
      try {
        const extras = (Constants.expoConfig && (Constants.expoConfig as any).extra) || {};
        const apiBaseLocal = extras.apiUrl || extras.API_URL || '';
        if (apiBaseLocal && /localhost|127\.0\.0\.1/.test(u) && /localhost|127\.0\.0\.1/.test(String(apiBaseLocal))) {
          // if apiBase defines a LAN host, replace localhost in the url with that host
          try {
            const parsed = new URL(String(apiBaseLocal));
            const hostWithPort = parsed.host; // includes port
            u = u.replace(/localhost(:\d+)?|127\.0\.0\.1(:\d+)?/i, hostWithPort);
          } catch (e) { /* ignore */ }
        }
      } catch (e) {}
      return u;
    }
    if (String(raw).startsWith('/')) return `${apiBase.replace(/\/$/, '')}${raw}`;
    return `${apiBase.replace(/\/$/, '')}/${raw}`;
  };
  const route = useRoute<RouteProp<RootStackParamList, 'Chat'>>();
  const navigation = useNavigation<any>();
  const ticketId = route.params?.ticketId;
  const ticketSubject = route.params?.ticketSubject;
  // If `simple` param is passed to this screen, render only the chat list + input
  // (no header, no attach sheet, no previews) useful for embedding the chat.
  const simpleView = !!(route.params as any)?.simple;
  const initialMsgs = (route.params && (route.params as any).initialMessages) || [];
  const [messages, setMessages] = useState<Array<{ id: string; text: string; from: 'user' | 'bot' | 'admin' | string; meta?: any }>>(initialMsgs);
  const [profile, setProfile] = useState<any>(null);
  const [ticketStatus, setTicketStatus] = useState<string | null>(null);
  const [ticketStatusChangedBy, setTicketStatusChangedBy] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [adminOnline, setAdminOnline] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [showAttachSheet, setShowAttachSheet] = useState(false);
  const [confirmProps, setConfirmProps] = useState<any>(null);
    const [inspectMsg, setInspectMsg] = useState<any>(null);
  // Try to resolve expo-image-picker at runtime similar to TicketsScreen
  let ExpoImagePicker: any = null;
  try {
    // eslint-disable-next-line global-require
    ExpoImagePicker = require('expo-image-picker');
  } catch (err) {
    ExpoImagePicker = null;
  }
  const flatRef = useRef<FlatList>(null as any);
  // track whether user is currently at the bottom (viewing newest message)
  const isAtBottomRef = useRef(true);
  const inputRef = useRef<TextInput>(null as any);
  // refs for individual message views so we can measure their position for safety scrolls
  const messageRefs = useRef<Record<string, any>>({});
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [inputHeight, setInputHeight] = useState<number>(44);
  // measured height of the input container (attach+input+send) so we can pad the list correctly
  const [measuredInputHeight, setMeasuredInputHeight] = useState<number>(44);
  // Configurable small gap between keyboard and input row when keyboard is visible
  const DEFAULT_KEYBOARD_GAP_IOS = 10;
  const DEFAULT_KEYBOARD_GAP_ANDROID = 6;
  // Minimum visible separator height to show between keyboard and input even when keyboard is closed
  // Set to 0 to disable the persistent separator/handle
  const MIN_VISIBLE_GAP = 0;
  const [keyboardGap, setKeyboardGap] = useState<number>(0);

  // safe area insets (used to offset keyboard/input properly)
  const insets = useSafeAreaInsets();

  // Prefer the runtime Theme context so dark/light modes are respected.
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // dynamic colors applied inline to avoid referencing theme in static StyleSheet.
  const dyn = {
    headerBg: theme.colors.primary,
    headerTitle: theme.colors.white,
    headerSnippet: 'rgba(255,255,255,0.9)',
    idChipText: theme.colors.primary,
    resolveBtnBg: theme.colors.surface,
    closedTitle: theme.colors.success,
    userBubbleBg: tokens.colors.brand.primaryLight,
    botBubbleBg: theme.colors.surface,
    bubbleTailLeft: theme.colors.surface,
    bubbleTailRight: tokens.colors.brand.primaryLight,
    sendBtnBg: theme.colors.primary,
    sheetActionBg: theme.colors.primary,
    sheetActionText: theme.colors.white,
    attachBtnBg: tokens.colors.brand.primaryLight,
    attachBtnText: theme.colors.primary,
    initialsBg: theme.colors.primary,
    adminDotBg: theme.colors.success,
    attachThumbBg: theme.colors.mutedLight || '#eee',
    avatarPlaceholderBg: tokens.colors.neutral[300],
  };

  // compute list padding to keep messages visible above the input bar.
  // Reserve space for the input and the keyboard when open so the chat is
  // pushed up and nothing is overlapped. When the keyboard 'pushes' the
  // content we reduce that extra keyboard padding slightly to avoid a large
  // visual gap this keeps the UI tighter on small screens.
  // When keyboard opens we want to reserve enough space so the last message
  // is not overlapped. Previously we reduced the keyboard padding which could
  // cause overlap on some devices. Set reduction to 0 so the chat is pushed
  // fully above the keyboard. If you prefer a smaller gap, reduce this value.
  const REDUCE_ON_PUSH = 0; // pixels to reduce from keyboard padding when open (tuned)
  const MAX_BOTTOM_PADDING = 10; // cap to avoid excessive blank area on small screens
  const MIN_PADDING_ON_PUSH = 8; // minimum padding to keep when keyboard pushes
  const baseInputPad = (measuredInputHeight || Math.max(44, inputHeight)) + insets.bottom + 8;
  // If the attach sheet is open, avoid including keyboard padding so the
  // sheet isn't pushed up and the messages/preview remain closer together.
  // Reserve the full keyboard height (plus a small computed gap) when the
  // keyboard is open so content isn't overlapped. Do not reduce here we
  // want predictable behavior across devices and avoid overlap.
  const keyboardPad = (!showAttachSheet && keyboardOpen) ? Math.max(MIN_PADDING_ON_PUSH, (keyboardHeight + keyboardGap) /* - REDUCE_ON_PUSH intentionally disabled */) : 0;

  // On Android we prefer to rely on the native window resize behaviour
  // (android:windowSoftInputMode="adjustResize"). In that case the system
  // will push the whole view up and we should avoid adding the extra
  // keyboardPad here (which would double-pad). For other platforms (iOS)
  // keep the JS-calculated keyboardPad so the floating input can animate.
  const isAndroid = Platform.OS === 'android';
  const rawPad = baseInputPad + (isAndroid ? 0 : keyboardPad);
  const listBottomPadding = Math.min(rawPad, MAX_BOTTOM_PADDING);

  // Animated value for keyboard gap (use Animated to avoid LayoutAnimation warnings on new architecture)
  const keyboardGapAnim = useRef(new Animated.Value(MIN_VISIBLE_GAP)).current;
  // animated translate for input row so it can be moved up/down reliably
  const inputTranslateAnim = useRef(new Animated.Value(0)).current;
  // animated translate for the whole container so chats + input can be pushed
  // above the keyboard reliably on both platforms.
  const containerTranslateAnim = useRef(new Animated.Value(0)).current;
  // (separator removed) no separator opacity needed
  // (removed absolute input bottom animation) keyboardBottomAnim

  useEffect(() => {
    let mounted = true;
    const loadTicket = async () => {
      if (!ticketId) return;
      try {
        const res = await getTicket(ticketId);
        const t = res.ticket || res;
        // load user's profile/avatar for message bubbles
        try {
          const p = await getProfile().catch(() => null);
          setProfile(p && (p.user || p.data || p) || null);
        } catch (pe) { /* ignore */ }
        if (!mounted) return;
  setTicketStatus(t.status || null);
  setTicketStatusChangedBy(t.statusChangedBy || null);
        const mapped: any[] = [];
    if (t.message) mapped.push({ id: `t-u-${t._id}`, text: t.message, from: 'user', meta: { attachments: t.attachments || [] } });
  (t.replies || []).forEach((rep: any, idx: number) => mapped.push({ id: `t-r-${idx}-${Date.now()}`, text: rep.message, from: rep.senderRole === 'admin' ? 'admin' : 'user', meta: { by: rep.by, at: rep.at || rep.createdAt, attachments: rep.attachments || [] } }));
        setMessages(mapped.reverse());
        // join ticket room for presence detection (so server can skip FCM pushes)
        try {
          await socket.initSocket();
          const room = `ticket_${String(t._id || ticketId)}`;
          socket.emit('joinRoom', room);
        } catch (e) { /* ignore join errors */ }
        // Persist seen admin/support reply count so Help inbox knows which admin replies
        // the user has already seen for this ticket.
        try {
          const key = 'ticket_seen_counts';
          const raw = await AsyncStorage.getItem(key);
          const seen = raw ? JSON.parse(raw) : {};
          const id = String(t._id || t.ticketId || ticketId);
          const repliesArr = Array.isArray(t.replies) ? t.replies : [];
          const adminCount = repliesArr.filter((r: any) => {
            const role = String(r?.senderRole || '').toLowerCase();
            return role === 'admin' || role === 'support';
          }).length;
          seen[id] = adminCount;
          await AsyncStorage.setItem(key, JSON.stringify(seen));
        } catch (e) { /* ignore */ }
      } catch (e) {
        console.warn('Failed to load ticket', e);
      }
    };
    loadTicket();
    // init socket and subscribe to ticket events
    let ticketReplyHandler: any = null;
    let ticketStatusHandler: any = null;
    (async () => {
      await socket.initSocket();
      // subscribe to admin presence updates so we can show active dot on admin avatars
      // Additionally, when an admin becomes online we treat that as a likely "viewed"
      // action for the currently-open ticket and mark the last N user messages as read
      // so the UI shows the double-tick receipt. This is a pragmatic client-side
      // read-receipt approximation when the server does not emit an explicit
      // per-message read event. We only mark messages when admin transitions
      // from offline -> online to avoid repeatedly toggling state.
      let prevAdminOnline = false;
      const LAST_READ_COUNT = 3; // configure how many recent user messages to mark as read
      socket.on('presence:update', (p: any) => {
        try {
          if (!p) return;
          if (p.role === 'admin') {
            const nowOnline = !!p.online;
            // update admin dot
            setAdminOnline(nowOnline);
            // only mark messages as read on a transition from false -> true
            if (nowOnline && !prevAdminOnline) {
              setMessages(prev => {
                try {
                  let marked = 0;
                  // prev is newest-first (list inverted). Mark the first LAST_READ_COUNT user messages.
                  return prev.map(m => {
                    if (marked >= LAST_READ_COUNT) return m;
                    if (m && (m.from === 'user' || String(m.from).toLowerCase() === 'user') && !(m.meta && m.meta.status === 'read')) {
                      marked += 1;
                      return { ...m, meta: { ...(m.meta || {}), status: 'read' } };
                    }
                    return m;
                  });
                } catch (e) { return prev; }
              });
            }
            prevAdminOnline = nowOnline;
          }
        } catch (e) { /* ignore */ }
      });
      ticketReplyHandler = (t: any) => {
        try {
          // normalize ids: ticket._id or ticket.ticketId
          const matches = (t && (t._id === ticketId || t.ticketId === ticketId || String(t._id) === String(ticketId)));
          if (!matches) return;
          // refresh messages from server payload
          const thread = t.replies || [];
          const mapped: any[] = [];
          if (t.message) mapped.push({ id: `t-u-${t._id}`, text: t.message, from: 'user', meta: { attachments: t.attachments || [] } });
          thread.forEach((rep: any, idx: number) => mapped.push({ id: `t-r-${idx}-${Date.now()}`, text: rep.message, from: rep.senderRole === 'admin' ? 'admin' : 'user', meta: { by: rep.by, at: rep.at, attachments: rep.attachments || [] } }));
          setMessages(mapped.reverse());
          setTicketStatus(t.status || null);
          setTicketStatusChangedBy(t.statusChangedBy || null);
          // update seen counts because user is viewing this thread
          try {
            const key = 'ticket_seen_counts';
            AsyncStorage.getItem(key).then(raw => {
              const seen = raw ? JSON.parse(raw) : {};
              const id = String(t._id || t.ticketId || ticketId);
              const repliesArr = Array.isArray(t.replies) ? t.replies : [];
              const adminCount = repliesArr.filter((r: any) => {
                const role = String(r?.senderRole || '').toLowerCase();
                return role === 'admin' || role === 'support';
              }).length;
              seen[id] = adminCount;
              AsyncStorage.setItem(key, JSON.stringify(seen)).catch(()=>{});
            }).catch(()=>{});
          } catch (e) { }
        } catch (e) { console.warn('ticket:reply handler failed', e); }
      };
      ticketStatusHandler = (t: any) => {
        try {
          const matches = (t && (t._id === ticketId || t.ticketId === ticketId || String(t._id) === String(ticketId)));
          if (!matches) return;
          setTicketStatus(t.status || null);
        } catch (e) { console.warn('ticket:status handler failed', e); }
      };
      socket.on('ticket:reply', ticketReplyHandler);
      socket.on('ticket:status', ticketStatusHandler);
      // Server-side read receipts: when admin reads messages the server
      // should emit `ticket:read` or `message:read` with a payload describing
      // which messages were read. Example payloads supported:
      // { ticketId, messageIds: ['t-r-0-...','u-...'] }
      // { ticketId, readCount: 2 }  // mark last 2 user messages as read
      let ticketReadHandler: any = null;
      ticketReadHandler = (p: any) => {
        try {
          if (!p) return;
          const matches = (p && (p._id === ticketId || p.ticketId === ticketId || String(p._id) === String(ticketId)));
          if (!matches) return;
          // If server provided explicit message ids, mark those
          if (Array.isArray(p.messageIds) && p.messageIds.length) {
            const ids = new Set(p.messageIds.map(String));
            setMessages(prev => prev.map(m => (ids.has(String(m.id)) ? { ...m, meta: { ...(m.meta || {}), status: 'read' } } : m)));
            return;
          }
          // If server provided a readCount, mark the newest `readCount` user messages
          if (typeof p.readCount === 'number' && p.readCount > 0) {
            const count = Math.max(0, Math.min(50, Math.floor(p.readCount)));
            setMessages(prev => {
              let marked = 0;
              return prev.map(m => {
                if (marked >= count) return m;
                if (m && String(m.from).toLowerCase() === 'user' && !(m.meta && m.meta.status === 'read')) {
                  marked += 1;
                  return { ...m, meta: { ...(m.meta || {}), status: 'read' } };
                }
                return m;
              });
            });
            return;
          }
        } catch (e) { /* ignore */ }
      };
      socket.on('ticket:read', ticketReadHandler);
      socket.on('message:read', ticketReadHandler);
    })();
    // keyboard listeners to avoid leaving residual bottom padding when keyboard hides
    const onKeyboardShow = (e: KeyboardEvent) => {
      try {
        const h = e && (e.endCoordinates?.height || 0);
        setKeyboardHeight(h || 0);
        setKeyboardOpen(true);
        // measure input position and log overlap with keyboard for debugging
        try {
          // delay measurement slightly to let layout settle
          setTimeout(() => {
            try {
              const screenH = Dimensions.get('window').height;
              const keyboardTop = screenH - (h || 0);
              const inp: any = inputRef.current;
              if (inp && typeof inp.measureInWindow === 'function') {
                inp.measureInWindow((ix: number, iy: number, iw: number, ih: number) => {
                  const inputBottom = iy + ih;
                  const overlap = Math.max(0, inputBottom - keyboardTop);
                  if (overlap > 0) {
                    try { flatRef.current?.scrollToOffset({ offset: Math.max(0, overlap + 80), animated: true }); } catch (er) { /* ignore */ }
                  }
                });
              }
            } catch (me) { /* ignore */ }
          }, 60);
        } catch (mErr) { /* ignore */ }
      } catch (err) { setKeyboardHeight(0); setKeyboardOpen(true); }
    };
    const onKeyboardHide = (e?: KeyboardEvent) => {
      try { /* ignore keyboard hide event logging */ } catch (ex) { /* ignore */ }
      // clear height immediately so UI no longer reserves the keyboard space
      try { setKeyboardHeight(0); setKeyboardOpen(false); } catch (er) { /* ignore */ }
  try { keyboardGapAnim.setValue(MIN_VISIBLE_GAP); setKeyboardGap(MIN_VISIBLE_GAP); } catch (er) { /* ignore */ }
  try { setInputHeight(44); } catch (er) { /* ignore */ }
      // then scroll after a short delay to allow layout to settle
      setTimeout(() => {
        try { flatRef.current?.scrollToOffset({ offset: 0 }); } catch (er) { /* ignore */ }
      }, 80);
    };

    const showSub = Keyboard.addListener('keyboardDidShow', onKeyboardShow);
    const hideSub = Keyboard.addListener('keyboardDidHide', onKeyboardHide);
    // on iOS prefer will-show/will-hide for smoother animation
    let iosShow: any = null;
    let iosHide: any = null;
    if (Platform.OS === 'ios') {
      iosShow = Keyboard.addListener('keyboardWillShow', onKeyboardShow);
      iosHide = Keyboard.addListener('keyboardWillHide', onKeyboardHide);
    }
    return () => {
      mounted = false;
      // leave ticket room when navigating away
      try {
        const room = `ticket_${String(ticketId)}`;
        socket.emit('leaveRoom', room);
      } catch (e) { /* ignore */ }
      try { showSub.remove(); hideSub.remove(); if (iosShow) iosShow.remove(); if (iosHide) iosHide.remove(); } catch (e) { /* ignore */ }
    };
  }, [ticketId]);
  // cleanup socket listeners on unmount
  useEffect(() => {
    return () => {
      try { socket.off('ticket:reply'); socket.off('ticket:status'); socket.off('ticket:read'); socket.off('message:read'); } catch (e) {}
    };
  }, []);

  const send = async () => {
  const q = String(text || '').trim();
  // allow sending when there's either text or attachments
  if (!q && (!attachments || attachments.length === 0)) return;
  setText('');
  const userId = `u-${Date.now()}`;
  // optimistic message: include a timestamp and a 'sending' status so time/tick show immediately
  setMessages((m) => [{ id: userId, text: q || '', from: 'user', meta: { attachments: attachments || [], at: new Date().toISOString(), status: 'sending' } }, ...m]);
    setLoading(true);
    try {
      // If this chat was opened for a ticket, post reply to ticket endpoint
      if (ticketId) {
        try {
          // Debug: log attachments shape before sending
          try {
            console.log('[ChatScreen] sending replyTicket', { ticketId, message: q, attachments: attachments.map(a => ({ uri: a?.uri, name: a?.name, type: a?.type })) });
          } catch (e) { console.log('[ChatScreen] attachments log failed', e); }

          // include attachments if present
          let r: any = null;
          try {
            r = await replyTicket(ticketId, { message: q, attachments });
            console.log('[ChatScreen] replyTicket response', r && (r.ticket || r));
          } catch (err) {
            const _err: any = err;
            console.warn('[ChatScreen] replyTicket failed', _err && (_err.response || _err));
            // if axios error, try to print response body for diagnostics
            try {
              const resp = _err && _err.response && _err.response.data ? _err.response.data : null;
              console.log('[ChatScreen] replyTicket error response data', resp);
            } catch (ee) { console.warn('[ChatScreen] error reading error response', ee); }
            throw err;
          }
          const t = r.ticket || r;
          // update ticket status
          setTicketStatus(t.status || null);
          // map ticket -> messages: original message + replies (oldest first)
          const mapped: any[] = [];
          if (t.message) mapped.push({ id: `t-u-${t._id}`, text: t.message, from: 'user', meta: { attachments: t.attachments || [] } });
          (t.replies || []).forEach((rep: any, idx: number) => mapped.push({ id: `t-r-${idx}-${Date.now()}`, text: rep.message, from: rep.senderRole === 'admin' ? 'admin' : 'user', meta: { by: rep.by, at: rep.at || rep.createdAt, attachments: rep.attachments || [] } }));
          // show newest first as the list is inverted
          setMessages(mapped.reverse());
          // clear attachments after successful reply
          setAttachments([]);
        } catch (re) {
          console.warn('Ticket reply failed', re);
          setConfirmProps({ visible: true, title: 'Send failed', message: 'Could not send reply. Check network or server logs.', confirmText: 'OK', cancelText: '', onConfirm: () => setConfirmProps(null), onCancel: () => setConfirmProps(null) });
        } finally {
          setLoading(false);
          setTimeout(() => flatRef.current?.scrollToOffset({ offset: 0 }), 150);
        }
        return;
      }
      // If user asked about a specific transaction/withdrawal but didn't provide an id,
      // ask them to paste the transaction id so we can fetch live details.
      const lower = q.toLowerCase();
    const mentionsTransaction = /\b(transaction|withdrawal|tx|withdraw)\b/.test(lower);
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(q);
  const isShortTx = /^tx[-_A-Za-z0-9]+$/.test(q) || /^T\d{6,}$/.test(q);
  const mentionsConfirmation = /\b(confirmation|confirm|receipt)\b/.test(lower);
  const mentionsPreSubmission = /\b(pre-?submission|pre submission|presubmission)\b/.test(lower);
  const mentionsService = /\b(service|services)\b/.test(lower);
  // Debug: log token presence and a short sample (redacted) so Metro/Expo logs show what the client is sending
  const tokenFromSecure = await authStorage.getToken().catch(() => null);
  const tokenFromAsync = (await AsyncStorage.getItem('userToken').catch(() => null)) || (await AsyncStorage.getItem('jwtToken').catch(() => null));
  const tokenPresent = !!(tokenFromSecure || tokenFromAsync);
  const tokenSample = (tokenFromSecure || tokenFromAsync) ? String((tokenFromSecure || tokenFromAsync)).slice(0, 8) + '...' : null;
  console.log('[ChatScreen] send()', { query: q, mentionsTransaction, isObjectId, isShortTx, tokenPresent, tokenSample });
      if (mentionsTransaction && !isObjectId && !isShortTx) {
        setMessages((m) => [{ id: `b-${Date.now()}`, text: 'I can fetch live transaction details if you paste the transaction id (e.g. the 24-char id or transactionId).', from: 'bot' }, ...m]);
        setLoading(false);
        return;
      }
      // If the user entered a likely transaction id (24-hex ObjectId) or a short tx-like string,
      // call the live fetch endpoint which returns the actual transaction from DB (requires auth).
      // (isObjectId/isShortTx already computed above)
      if (isObjectId || isShortTx || mentionsConfirmation || mentionsPreSubmission || (mentionsService && q.length > 3)) {
        try {
          // Decide which model to request
          let model = 'Transaction';
          let idField = 'txid';
          if (mentionsConfirmation) model = 'Confirmation';
          else if (mentionsPreSubmission) model = 'PreSubmission';
          else if (mentionsService) model = 'Service';

          console.log('[ChatScreen] calling /api/assist/fetch', { model, id: q });
          const f = await client.post('/api/assist/fetch', { model, id: q, txid: q });
          console.log('[ChatScreen] fetch response', f && f.data ? { status: f.status, data: f.data } : f);
            if (f && f.data && f.data.ok && f.data.document) {
            const t = f.data.document;
            // build a more detailed summary including bank account and provider info when present
            const parts: string[] = [];
            parts.push(`${f.data.model || 'Record'} ${t._id || t.transactionId || t.confirmationId || ''}`);
            if (t.type) parts.push(`Type: ${t.type}`);
            if (t.amount || t.ngnAmount) parts.push(`Amount: ${t.amount || t.ngnAmount} ${t.currency || ''}`);
            if (t.status) parts.push(`Status: ${t.status}`);
            parts.push(`Date: ${t.date || t.createdAt || t.confirmedAt || 'N/A'}`);
            // bank account (populated bankId)
            if (t.bankId && typeof t.bankId === 'object') {
              const b = t.bankId as any;
              parts.push(`Bank: ${b.bankName || 'N/A'}`);
              parts.push(`Account name: ${b.accountName || 'N/A'}`);
              parts.push(`Account number: ${b.accountNumber || b.accountNumberNormalized || 'N/A'}`);
            } else if (t.bankMeta) {
              parts.push(`Bank meta: ${t.bankMeta}`);
            }
            // provider info
            if (t.provider && t.provider.name) {
              parts.push(`Provider: ${t.provider.name} ${t.provider.reference ? `ref:${t.provider.reference}` : ''}`);
            }

            const summary = parts.join('\n');
            // attach summary message (no raw/detail action)
            setMessages((m) => [{ id: `b-${Date.now()}`, text: summary, from: 'bot' }, ...m]);
          } else if (f && f.data && f.data.error) {
            setMessages((m) => [{ id: `b-${Date.now()}`, text: `Error: ${f.data.error}`, from: 'bot' }, ...m]);
          } else {
            setMessages((m) => [{ id: `b-${Date.now()}`, text: 'Transaction not found.', from: 'bot' }, ...m]);
          }
        } catch (fe) {
          console.warn('Fetch transaction failed', fe);
          setMessages((m) => [{ id: `b-${Date.now()}`, text: 'Failed to fetch transaction. Ensure you are logged in and have permission.', from: 'bot' }, ...m]);
        }
      } else {
        const res = await client.post('/api/assist/query', { query: q });
        const reply = (res && res.data && (res.data.answer || res.data.response || res.data.text)) || 'I don\'t know. Try rephrasing or contact support.';
        setMessages((m) => [{ id: `b-${Date.now()}`, text: String(reply), from: 'bot' }, ...m]);
      }
    } catch (e) {
      console.warn('Assist query failed', e);
      setMessages((m) => [{ id: `b-${Date.now()}`, text: 'Failed to reach assistant. Try again later.', from: 'bot' }, ...m]);
    } finally {
      setLoading(false);
      setTimeout(() => flatRef.current?.scrollToOffset({ offset: 0 }), 150);
    }
  };

  const pickAttachment = async () => {
    // when opening the attach sheet ensure the keyboard is dismissed so the
    // sheet appears without the keyboard overlapping it. Also reset any input
    // translate state used for keyboard animations.
    try {
      Keyboard.dismiss();
    } catch (e) { /* ignore */ }
    try { setKeyboardOpen(false); setKeyboardHeight(0); } catch (e) { /* ignore */ }
    try { keyboardGapAnim.setValue(MIN_VISIBLE_GAP); setKeyboardGap(MIN_VISIBLE_GAP); } catch (e) { /* ignore */ }
    try { inputTranslateAnim.setValue(0); } catch (e) { /* ignore */ }
    // Wait briefly to allow the keyboard to fully dismiss so the sheet is
    // shown without being pushed up by the keyboard.
    setTimeout(() => setShowAttachSheet(true), 200);
  };

  const closeAttachSheet = () => setShowAttachSheet(false);

  const pickPhoto = async () => {
    try {
      if (!ExpoImagePicker) {
        const res = await DocumentPicker.getDocumentAsync({ type: 'image/*', multiple: true });
        const anyRes: any = res as any;
        if (anyRes.cancelled) return;
        if (anyRes.assets && Array.isArray(anyRes.assets)) {
          const picked = anyRes.assets.map((a: any) => ({ uri: a.uri, name: a.fileName || a.name || (a.uri && a.uri.split('/').pop()), type: a.type || a.mimeType || 'image/jpeg' }));
          setAttachments((prev) => [...prev, ...picked]);
        } else if (anyRes.uri) {
          const single = { uri: anyRes.uri, name: anyRes.name || (anyRes.uri && anyRes.uri.split('/').pop()), type: anyRes.mimeType || anyRes.type || 'image/jpeg' };
          setAttachments((prev) => [...prev, single]);
        }
        closeAttachSheet();
        return;
      }
      const perm = await ExpoImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) { setConfirmProps({ visible: true, title: 'Permission required', message: 'Please allow access to your photos', confirmText: 'OK', cancelText: '', onConfirm: () => setConfirmProps(null), onCancel: () => setConfirmProps(null) }); return; }
      const pickRes = await ExpoImagePicker.launchImageLibraryAsync({ mediaTypes: ExpoImagePicker.MediaTypeOptions.All, allowsMultipleSelection: true, quality: 0.8 });
      const anyRes: any = pickRes as any;
      if (anyRes.cancelled) return;
      const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
      const allowedMime = /^(image|video)\//i;
      const toAdd: any[] = [];
      const rejected: string[] = [];
      if (anyRes.assets && Array.isArray(anyRes.assets)) {
        for (const a of anyRes.assets) {
          const uri = a.uri;
          const name = a.fileName || (uri && uri.split('/').pop()) || 'attachment';
          const type = a.type || a.mimeType || (uri && uri.match(/\.mp4$/i) ? 'video/mp4' : 'image/jpeg');
          const size = a.fileSize || a.size || 0; // may be undefined on some platforms
          if (size && size > MAX_FILE_SIZE) {
            rejected.push(`${name} (too large)`);
            continue;
          }
          const ext = (name && name.split('.').length > 1) ? name.split('.').pop().toLowerCase() : '';
          const isPdf = ext === 'pdf' || type === 'application/pdf';
          if (!(allowedMime.test(type) || isPdf)) {
            rejected.push(`${name} (unsupported type)`);
            continue;
          }
          toAdd.push({ uri, name, type });
        }
      } else if (anyRes.uri) {
        const uri = anyRes.uri;
        const name = anyRes.fileName || anyRes.name || (uri && uri.split('/').pop()) || 'attachment';
        const type = anyRes.type || anyRes.mimeType || 'image/jpeg';
        const size = anyRes.fileSize || anyRes.size || 0;
        if (size && size > MAX_FILE_SIZE) rejected.push(`${name} (too large)`);
        else {
          const ext = (name && name.split('.').length > 1) ? name.split('.').pop().toLowerCase() : '';
          const isPdf = ext === 'pdf' || type === 'application/pdf';
          if (allowedMime.test(type) || isPdf) toAdd.push({ uri, name, type }); else rejected.push(`${name} (unsupported type)`);
        }
      }
      if (rejected.length) {
        try { setConfirmProps({ visible: true, title: 'Attachment skipped', message: `Some files were skipped:\n${rejected.join('\n')}.\nAllowed: images, videos, PDF. Max per-file: 50MB.`, confirmText: 'OK', cancelText: '', onConfirm: () => setConfirmProps(null), onCancel: () => setConfirmProps(null) }); } catch (e) { Alert.alert('Attachment skipped', `Some files were skipped:\n${rejected.join('\n')}`); }
      }
      if (toAdd.length) setAttachments((prev) => [...prev, ...toAdd]);
  } catch (e) { console.warn('Image pick failed', e); setConfirmProps({ visible: true, title: 'Attachment error', message: 'Could not pick image/video.', confirmText: 'OK', cancelText: '', onConfirm: () => setConfirmProps(null), onCancel: () => setConfirmProps(null) }); }
    closeAttachSheet();
  };

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true });
      const anyRes: any = res as any;
      if (anyRes.cancelled) return;
      if (anyRes.output && Array.isArray(anyRes.output) && anyRes.output.length) {
        setAttachments((prev) => [...prev, ...anyRes.output]);
        closeAttachSheet();
        return;
      }
      if (anyRes.assets && Array.isArray(anyRes.assets)) {
        const picked = anyRes.assets.map((a: any) => ({ uri: a.uri, name: a.name || a.fileName || (a.uri && a.uri.split('/').pop()), type: a.mimeType || a.type || 'application/octet-stream' }));
        setAttachments((prev) => [...prev, ...picked]);
      } else if (anyRes.uri) {
        const single = { uri: anyRes.uri, name: anyRes.name || (anyRes.uri && anyRes.uri.split('/').pop()), type: anyRes.mimeType || anyRes.type || 'application/octet-stream' };
        setAttachments((prev) => [...prev, single]);
      }
  } catch (e) { console.warn('Attachment pick failed', e); setConfirmProps({ visible: true, title: 'Attachment error', message: 'Could not pick attachment.', confirmText: 'OK', cancelText: '', onConfirm: () => setConfirmProps(null), onCancel: () => setConfirmProps(null) }); }
    closeAttachSheet();
  };

  // When ticket is resolved, show a system thank-you message (once) and disable input
  useEffect(() => {
    if (ticketStatus === 'resolved') {
      // insert a system/admin message at the top if not present. If an admin closed
      // the ticket attribute the message to 'admin' so the UI shows it appropriately.
      setMessages(prev => {
        const exists = prev.find(m => m.id === 'ticket-closed-system');
        if (exists) return prev;
        const author = ticketStatusChangedBy === 'admin' ? 'admin' : 'bot';
        return [{ id: 'ticket-closed-system', text: 'This ticket has been resolved. Thank you!', from: author, meta: { system: true, at: new Date().toISOString(), by: ticketStatusChangedBy || null } }, ...prev];
      });
    } else {
      // remove system closed message when reopened
      setMessages(prev => prev.filter(m => m.id !== 'ticket-closed-system'));
    }
  }, [ticketStatus]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', e => {
  const h = e?.endCoordinates?.height || 0;
  setKeyboardHeight(h);
  setKeyboardOpen(true);
      // derive a small gap from keyboard height (2% of keyboard height) clamped between defaults
      const derived = Math.round(h * 0.02);
      const minGap = Platform.OS === 'ios' ? DEFAULT_KEYBOARD_GAP_IOS : DEFAULT_KEYBOARD_GAP_ANDROID;
      const gap = Math.min(Math.max(derived || minGap, minGap), 18);
      // animate the Animated.Value for the gap (useNativeDriver:false for layout)
      try {
        // animate visible small gap
        Animated.timing(keyboardGapAnim, { toValue: gap, duration: 200, useNativeDriver: false }).start();
      } catch (e) { /* ignore */ }
      setKeyboardGap(gap);
      // compute translate target and clamp it; move input up by keyboard height so it visually anchors above the keyboard
      try {
        const pad = (insets?.bottom || 0) + 8;
        const translate = (h > pad) ? -(h - pad) : 0;
        const clamped = Math.max(translate, -Math.max(0, h));
        console.log('[ChatScreen] keyboardDidShow', { keyboardHeight: h, pad, translate, clamped, measuredInputHeight });
        // Move the absolute input overlay above the keyboard on both platforms.
        // Use animation on iOS for smoothness; on Android setValue immediately
        // to avoid stuck animation issues on some devices.
        const offset = -Math.max(0, h - (insets?.bottom || 0) - Math.max(0, gap));
        try {
          if (Platform.OS === 'android') {
            inputTranslateAnim.setValue(offset);
          } else {
            Animated.timing(inputTranslateAnim, { toValue: offset, duration: 200, useNativeDriver: false }).start(() => {
              try { inputTranslateAnim.setValue(offset); } catch (e) { /* ignore */ }
            });
          }
        } catch (e) { /* ignore */ }
        // Also move the whole container up so messages and input are above the keyboard.
        const containerOffset = -Math.max(0, h - (insets?.bottom || 0));
        try {
          if (Platform.OS === 'android') {
            containerTranslateAnim.setValue(containerOffset);
          } else {
            Animated.timing(containerTranslateAnim, { toValue: containerOffset, duration: 200, useNativeDriver: false }).start();
          }
        } catch (e) { /* ignore */ }
  // Auto-scroll to newest message so the chat is pushed above the keyboard.
  // Use a small delay to allow layout to settle before scrolling.
  try { setTimeout(() => flatRef.current?.scrollToOffset({ offset: 0, animated: true }), 80); } catch (e) { /* ignore */ }
      } catch (e) { console.warn('[ChatScreen] keyboard show animate failed', e); }
      // Log the computed gap and keyboard height for debugging
  // keyboard did show (debug logs removed)
    });

    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
        setKeyboardOpen(false);
        setKeyboardHeight(0);
        try { Animated.timing(keyboardGapAnim, { toValue: MIN_VISIBLE_GAP, duration: 180, useNativeDriver: false }).start(); } catch (e) { /* ignore */ }
        try { keyboardGapAnim.setValue(MIN_VISIBLE_GAP); } catch (e) { /* ignore */ }
      try { setInputHeight(44); } catch (e) { /* ignore */ }
      try { console.log('[ChatScreen] keyboardDidHide reset', { insets, measuredInputHeight, keyboardGap: MIN_VISIBLE_GAP }); } catch (e) { /* ignore */ }
      // Reset the overlay translate to zero so the input returns to its resting place
      // at the bottom of the screen.
    try {
      if (Platform.OS === 'android') {
        try { inputTranslateAnim.setValue(0); } catch (e) { /* ignore */ }
      } else {
        Animated.timing(inputTranslateAnim, { toValue: 0, duration: 180, useNativeDriver: false }).start(() => { try { inputTranslateAnim.setValue(0); } catch (e) {} });
      }
    } catch (e) { /* ignore */ }
    try {
      if (Platform.OS === 'android') {
        try { containerTranslateAnim.setValue(0); } catch (e) { /* ignore */ }
      } else {
        Animated.timing(containerTranslateAnim, { toValue: 0, duration: 180, useNativeDriver: false }).start(() => { try { containerTranslateAnim.setValue(0); } catch (e) {} });
      }
    } catch (e) { /* ignore */ }
        setKeyboardGap(MIN_VISIBLE_GAP);
    // keyboard did hide (debug logs removed)
      });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Ensure input returns to bottom when the TextInput loses focus as a safety net
  const handleInputBlur = () => {
    try {
      // small delay to allow layout to settle, then scroll to bottom (offset 0 for inverted list)
      setTimeout(() => {
        try { flatRef.current?.scrollToOffset({ offset: 0 }); } catch (e) { /* ignore */ }
      }, 140);
    } catch (e) { /* ignore */ }
  };

  // Measure the newest message and the input position, then scroll the list
  // if the newest message is overlapped by the input/keyboard. `delay` lets
  // callers wait for layout to settle before measuring.
  const safetyScrollIfNeeded = (delay = 80) => {
    try {
      setTimeout(() => {
        try {
          if (!flatRef.current) return;
          const newest = (messages && messages.length) ? messages[0] : null; // inverted list: index 0 is newest
          if (!newest) return;
          const msgRef = messageRefs.current && messageRefs.current[newest.id];
          const inp = inputRef.current;
          if (!msgRef || !inp || typeof msgRef.measureInWindow !== 'function' || typeof inp.measureInWindow !== 'function') return;
          // measure message
          msgRef.measureInWindow((mx: number, my: number, mw: number, mh: number) => {
            try {
              inp.measureInWindow((ix: number, iy: number, iw: number, ih: number) => {
                try {
                  const msgBottom = my + mh;
                  const inputTop = iy;
                  const safetyPad = 8; // small breathing room
                  const overlap = Math.max(0, msgBottom - inputTop + safetyPad);
                  if (overlap > 0) {
                    // add some extra so bubble isn't flush against the input
                    const extra = Math.max(24, overlap + 20);
                    try { flatRef.current?.scrollToOffset({ offset: Math.max(0, extra), animated: true }); } catch (e) { /* ignore */ }
                  }
                } catch (e) { /* ignore */ }
              });
            } catch (e) { /* ignore */ }
          });
        } catch (e) { /* ignore */ }
      }, delay);
    } catch (e) { /* ignore */ }
  };

  // When messages change while keyboard is open and user is at bottom, run safety scroll
  useEffect(() => {
    try {
      if (keyboardOpen && isAtBottomRef.current) {
        safetyScrollIfNeeded(120);
      }
    } catch (e) { /* ignore */ }
  }, [messages, keyboardOpen]);


  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      // On Android we prefer to rely on native windowSoftInputMode="adjustResize"
      // (set in AndroidManifest.xml) and avoid KeyboardAvoidingView behavior which
      // can produce extra gaps. Only enable behavior on iOS for smooth padding.
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.bottom : 0}
    >

  <Animated.View style={[styles.container, { transform: [{ translateY: containerTranslateAnim }] }]}>
        {/* Header replaced by ChatRow + actions. Hidden in simpleView mode. */}
        {!simpleView ? (
          <View style={[styles.headerBar, { backgroundColor: dyn.headerBg }]}> 
            <ChatRow
              title={ticketSubject || 'Assistant'}
              avatarUrl={profile && profile.avatarUrl}
              initials={(profile && ((profile.firstName || profile.username) ? String((profile.firstName || profile.username)).slice(0,2).toUpperCase() : '')) || ''}
              snippet={ticketId ? (ticketStatus ? `Status: ${ticketStatus}` : 'Open ticket') : 'Conversation with assistant'}
              ticketId={ticketId ? String(ticketId) : undefined}
              activeRole={'admin'}
              active={adminOnline}
              titleColor={dyn.headerTitle}
              snippetColor={dyn.headerSnippet}
            />
            {ticketId ? (
              <View style={styles.headerRight}>
                <TouchableOpacity onPress={async () => { try { if (ticketId) { await Clipboard.setStringAsync(String(ticketId)); setConfirmProps({ visible: true, title: 'Ticket ID copied', message: String(ticketId), confirmText: 'OK', cancelText: '', onConfirm: () => setConfirmProps(null), onCancel: () => setConfirmProps(null) }); } } catch (e) { console.warn('Copy ticket id failed', e); } }} style={styles.idChip}><Text style={[styles.idChipText, { color: dyn.idChipText }]}>{shortTicketId(String(ticketId))}</Text></TouchableOpacity>
                {
                  // Determine if current user may reopen: if admin resolved it, non-admins cannot reopen
                  (() => {
                    const isAdmin = profile && profile.role === 'admin';
                    const resolvedByAdmin = ticketStatus === 'resolved' && ticketStatusChangedBy === 'admin';
                    const disabledReopen = resolvedByAdmin && !isAdmin;
                    return (
                      <TouchableOpacity onPress={async () => {
                        try {
                          if (ticketStatus === 'resolved' && disabledReopen) {
                            setConfirmProps({ visible: true, title: 'Cannot reopen', message: 'This ticket was resolved by an admin and cannot be reopened by you.', confirmText: 'OK', cancelText: '', onConfirm: () => setConfirmProps(null), onCancel: () => setConfirmProps(null) });
                            return;
                          }
                          const newStatus = ticketStatus === 'resolved' ? 'open' : 'resolved';
                          const r = await updateTicketStatus(ticketId!, newStatus);
                          const newTicket = r.ticket || r;
                          setTicketStatus(newTicket.status || newStatus);
                          setTicketStatusChangedBy(newTicket.statusChangedBy || null);
                        } catch (e) { console.warn('Failed to update status', e); }
                      }} style={[styles.resolveBtn, { backgroundColor: dyn.resolveBtnBg }, disabledReopen ? { opacity: 0.5 } : null]} disabled={disabledReopen}>
                        <Text style={styles.resolveBtnText}>{ticketStatus === 'resolved' ? 'Reopen' : 'Resolve'}</Text>
                      </TouchableOpacity>
                    );
                  })()
                }
              </View>
            ) : null}
          </View>
        ) : null}
        {ticketStatus === 'resolved' && !simpleView ? (
          <View style={styles.closedBox}>
            <Text style={[styles.closedTitle, { color: dyn.closedTitle }]}>Closed</Text>
            <Text style={styles.closedText}>This conversation has been marked resolved. Thank you for contacting support.</Text>
          </View>
        ) : null}
        <FlatList
          // @ts-ignore - callback ref assigned to useRef; acceptable here for runtime access
          ref={(r: any) => { (flatRef as any).current = r; }}
          inverted
          data={messages}
          keyExtractor={(item) => item.id}
          // Keep the keyboard visible while scrolling so user can continue typing.
          // `keyboardShouldPersistTaps='always'` ensures taps don't dismiss the keyboard,
          // and `keyboardDismissMode='none'` prevents the list drag from hiding the keyboard.
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          // Track user's scroll position so we only auto-scroll when they are
          // already at the bottom (viewing newest messages). For inverted list
          // offset 0 is the bottom-most position.
          onScroll={(e) => {
            try {
              const off = e?.nativeEvent?.contentOffset?.y || 0;
              isAtBottomRef.current = off <= 20; // small threshold
            } catch (err) { /* ignore */ }
          }}
          scrollEventThrottle={16}
          // FlatList is inverted, so pad the top of the content (which appears at bottom visually)
          contentContainerStyle={ { paddingTop: listBottomPadding } }
          renderItem={({ item, index }) => {
            const isAdmin = item.from === 'admin' || item.from === 'bot';
            // prefer message-level avatar, then profile avatar, then fallback asset
            const messageAvatar = item.meta && item.meta.avatarUrl ? { uri: item.meta.avatarUrl } : null;
            const profileAvatar = profile && profile.avatarUrl ? { uri: profile.avatarUrl } : null;
            // Admin/system should show the app logo when no message-level avatar exists.
            const adminFallback = require('../../assets/ex_logo.png');
            const avatarSource = isAdmin ? (messageAvatar || adminFallback) : (messageAvatar || profileAvatar || null);
            // derive initials for user placeholder (fallback)
            const deriveInitials = (nameOrProfile: any) => {
              try {
                // priority: message meta name, profile first/last, profile.name
                if (nameOrProfile && typeof nameOrProfile === 'string') {
                  const parts = nameOrProfile.trim().split(/\s+/);
                  const a = parts[0]?.[0]?.toUpperCase() || '';
                  const b = (parts[1] || parts[0])?.[0]?.toUpperCase() || '';
                  return (a + b).slice(0, 2);
                }
                if (profile) {
                  const a = profile.firstName ? String(profile.firstName)[0]?.toUpperCase() : '';
                  const b = profile.lastName ? String(profile.lastName)[0]?.toUpperCase() : '';
                  if (a || b) return (a + b).slice(0, 2);
                  if (profile.name) {
                    const parts = String(profile.name).trim().split(/\s+/);
                    const aa = parts[0]?.[0]?.toUpperCase() || '';
                    const bb = (parts[1] || parts[0])?.[0]?.toUpperCase() || '';
                    return (aa + bb).slice(0, 2);
                  }
                }
              } catch (e) { /* ignore */ }
              return '';
            };
            const initials = deriveInitials(item.meta && item.meta.name ? item.meta.name : null);

            // grouping: hide avatar if the next item (chronologically adjacent) is from same sender
            // messages array is the FlatList data; because list is inverted, the 'previous' chronological message is at index+1
            const nextItem = (index + 1) < messages.length ? messages[index + 1] : null;
            const hideAvatar = nextItem && nextItem.from === item.from;

            // decide bubble background and readable text color per-message
            const bubbleBg = isAdmin ? dyn.botBubbleBg : dyn.userBubbleBg;
            let bubbleTextColor = isAdmin ? theme.colors.text : pickContrastText(String(bubbleBg), theme.colors.white, theme.colors.text);
            // safety: if contrast util returned a color equal to the bubble background (rare), fall back to theme text
            try {
              if (String(bubbleTextColor).toLowerCase().trim() === String(bubbleBg).toLowerCase().trim()) {
                bubbleTextColor = theme.colors.text;
              }
            } catch (e) { /* ignore */ }

            // Specific override: if the bubble background is the brand 'primaryLight' (#d0e6fd),
            // prefer a darker brand text color for better contrast instead of white.
            try {
              const bg = String(bubbleBg || '').toLowerCase().trim();
              const brandLight = String(tokens.colors.brand.primaryLight || '').toLowerCase().trim();
              if (!isAdmin && bg && brandLight && bg === brandLight) {
                bubbleTextColor = tokens.colors.brand.primaryDark || theme.colors.primary || theme.colors.text;
              }
            } catch (e) { /* ignore */ }

            return (
              <View ref={(r) => { try { messageRefs.current[item.id] = r; } catch (e) {} }} style={[styles.row, isAdmin ? {} : { justifyContent: 'flex-end' }]}> 
                {/* left avatar for admin/bot (hide when grouped) */}
                {isAdmin ? (
                  hideAvatar ? <View style={{ width: 44 }} /> : (
                    avatarSource ? (
                      <View style={{ width: 44, alignItems: 'center', justifyContent: 'center' }}>
                        <Image source={avatarSource} style={styles.avatar} />
                        {adminOnline ? <View style={[styles.adminDot, { backgroundColor: dyn.adminDotBg }]} /> : null}
                      </View>
                    ) : (
                      initials ? <View style={[styles.initialsCircle, { backgroundColor: dyn.initialsBg }]}><Text style={styles.initialsText}>{initials}</Text></View> : <View style={[styles.avatarPlaceholder, { backgroundColor: dyn.avatarPlaceholderBg }]} />
                    )
                  )
                ) : <View style={{ width: 44 }} />}

                <View style={styles.msgContainer}>
                  {/* bubble tail (incoming/outgoing) */}
                  {isAdmin ? <View style={[styles.bubbleTail, styles.bubbleTailLeft, { borderRightColor: dyn.bubbleTailLeft }]} /> : <View style={[styles.bubbleTail, styles.bubbleTailRight, { borderLeftColor: dyn.bubbleTailRight }]} />}
                  <View style={[
                    styles.msg,
                    isAdmin ? [styles.bot, { backgroundColor: dyn.botBubbleBg }] : [styles.user, { backgroundColor: dyn.userBubbleBg }],
                    isAdmin ? styles.botBubble : styles.userBubble
                  ]}>
                    <TouchableOpacity activeOpacity={0.85} onLongPress={() => setInspectMsg(item)} onPress={() => { /* reserved for tap actions (e.g., select) */ }}>
                      <Text style={[styles.msgText, { color: bubbleTextColor }]}>{item.text}</Text>
                    </TouchableOpacity>
                    {item.meta && item.meta.attachments && item.meta.attachments.length > 0 ? (
                      <View style={{ marginTop: 8 }}>
                        <Text style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>{isAdmin ? 'Admin attachment' : 'Attachment' }{item.meta.attachments.length > 1 ? 's' : ''}</Text>
                        {item.meta.attachments.map((a: any, ai: number) => (
                          <TouchableOpacity key={ai} onPress={() => {
                            // Prefer opening attachments in the in-app ImagePreview so
                            // the preview component can decide how to handle images,
                            // PDFs, and videos (WebView/Video/fallback). If navigation
                            // fails, fallback to opening externally with Linking.openURL.
                            try {
                              const raw = getAttachmentUri(a) || a;
                              const uri = resolveAttachmentUrl(raw);
                              if (uri) {
                                console.log('[ChatScreen] open attachment preview (navigate)', uri);
                                navigation.navigate('ImagePreview' as any, { url: uri });
                                return;
                              }
                            } catch (e) {
                              // fallthrough to external open below
                            }
                            try {
                              const raw = getAttachmentUri(a) || a;
                              const uri = resolveAttachmentUrl(raw);
                              if (uri) Linking.openURL(uri).catch(()=>{});
                            } catch (e) {}
                          }}>
                            {
                              (() => {
                                const raw = getAttachmentUri(a) || a;
                                const resolved = resolveAttachmentUrl(raw);
                                // treat as image if attachment metadata says image OR resolved url file extension looks like an image
                                if (isImageAttachment(a) || (resolved && /\.(jpe?g|png|gif|webp|bmp)(\?.*)?$/i.test(String(resolved)))) {
                                  const uri = resolved ? encodeURI(String(resolved)) : (raw ? encodeURI(String(raw)) : '');
                                  return (
                                    <TouchableOpacity key={ai + '-img'} onPress={() => {
                                      try {
                                        console.log('[ChatScreen] open attachment preview (navigate)', uri);
                                        if (uri) navigation.navigate('ImagePreview' as any, { url: uri });
                                      } catch (e) {
                                        try { if (uri) Linking.openURL(uri).catch(()=>{}); } catch (ee) {}
                                      }
                                    }}>
                                      <Image source={{ uri }} style={[styles.attachThumb, { backgroundColor: dyn.attachThumbBg }]} resizeMode="cover" onError={(ev) => console.warn('[ChatScreen] attachment image load failed', uri, ev && ev.nativeEvent ? ev.nativeEvent : ev)} />
                                    </TouchableOpacity>
                                  );
                                }
                                // For non-image attachments show a tappable filename that opens the in-app preview too
                                const label = String(resolved || raw).split('/').pop() || String(a);
                                return (
                                  <Text style={{ color: '#1565c0', textDecorationLine: 'underline', marginTop: 6 }}>{label}</Text>
                                );
                              })()
                            }
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}

                    {/* timestamp + status ticks shown under the text inside the bubble */}
                    {item.meta && item.meta.at ? (
                      <View style={[styles.timeRow, isAdmin ? { justifyContent: 'flex-start' } : { justifyContent: 'flex-end' }]}>
                        <Text style={[styles.msgTime, { color: theme.colors.muted }]}>{formatTime(item.meta.at)}</Text>
                        {!isAdmin ? <Text style={[styles.msgStatus, { color: theme.colors.muted }]}>{item.meta && item.meta.status === 'read' ? '✓✓' : (item.meta && item.meta.status === 'sending' ? '…' : '')}</Text> : null}
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* user avatar on right for user's messages (hide when grouped) */}
                {!isAdmin ? (
                  hideAvatar ? <View style={{ width: 44 }} /> : (
                    avatarSource ? <Image source={avatarSource} style={styles.avatar} /> : (
                      initials ? <View style={[styles.initialsCircle, { backgroundColor: dyn.initialsBg }]}><Text style={styles.initialsText}>{initials}</Text></View> : <View style={[styles.avatarPlaceholder, { backgroundColor: dyn.avatarPlaceholderBg }]} />
                    )
                  )
                ) : <View style={{ width: 44 }} />}
              </View>
            );
          }}
        />
        {/* Attachment picker sheet (overlay) */}
        {showAttachSheet && !simpleView ? (
          <View style={styles.sheetOverlay} pointerEvents="box-none">
            <TouchableWithoutFeedback onPress={closeAttachSheet}>
              <View style={styles.sheetBackdrop} />
            </TouchableWithoutFeedback>
            <View style={styles.sheetContainer}>
              <Text style={[styles.sheetTitle, { color: theme.colors.primary }]}>Attach</Text>
              <TouchableOpacity style={[styles.sheetAction, { backgroundColor: dyn.sheetActionBg }]} onPress={pickPhoto}><Text style={[styles.sheetActionText, { color: dyn.sheetActionText }]}>Photo or Video</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.sheetAction, { backgroundColor: dyn.sheetActionBg }]} onPress={pickFile}><Text style={[styles.sheetActionText, { color: dyn.sheetActionText }]}>File</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.sheetAction, { backgroundColor: '#fff' }]} onPress={closeAttachSheet}><Text style={[styles.sheetActionText, { color: dyn.sheetActionBg }]}>Cancel</Text></TouchableOpacity>
            </View>
          </View>
  ) : null}

        {/* Attachments preview */}
        {(!simpleView && attachments.length > 0) ? (
          // ensure the preview row isn't overlapped by the floating input
          <View style={[styles.attachPreviewRow, { marginBottom: Math.max(6, (measuredInputHeight || Math.max(44, inputHeight)) + insets.bottom - 140) }]}>
                    {attachments.map((a: any, i: number) => (
              <View key={String(i)} style={styles.attachItem}>
                {
                  (() => {
                    const raw = getAttachmentUri(a) || a;
                    const resolved = resolveAttachmentUrl(raw);
                    if (isImageAttachment(a) || (resolved && /\.(jpe?g|png|gif|webp|bmp)(\?.*)?$/i.test(String(resolved)))) {
                      const uri = resolved ? encodeURI(String(resolved)) : (raw ? encodeURI(String(raw)) : '');
                      return (
                        <TouchableOpacity key={'preview-' + i} onPress={() => { try { navigation.navigate('ImagePreview' as any, { url: uri }); } catch (e) { try { if (uri) Linking.openURL(uri).catch(()=>{}); } catch (ee) {} } }}>
                          <Image source={{ uri }} style={[styles.attachThumb, { backgroundColor: dyn.attachThumbBg }]} resizeMode="cover" onError={(ev) => console.warn('[ChatScreen] preview image load failed', uri, ev && ev.nativeEvent ? ev.nativeEvent : ev)} />
                        </TouchableOpacity>
                      );
                    }
                    // Non-image attachments: make filename tappable to open preview too
                    const label = a.name || resolved || raw || String(a);
                    return (
                      <TouchableOpacity key={'preview-name-' + i} onPress={() => {
                        try {
                          const uri = resolveAttachmentUrl(raw);
                          if (uri) navigation.navigate('ImagePreview' as any, { url: uri });
                          else if (uri) Linking.openURL(uri).catch(()=>{});
                        } catch (e) { try { const uri = resolveAttachmentUrl(raw); if (uri) Linking.openURL(uri).catch(()=>{}); } catch (_e) {} }
                      }}>
                        <Text numberOfLines={1} style={styles.attachName}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })()
                }
                <TouchableOpacity onPress={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}><Text style={{ color: '#d32f2f', marginTop: 6 }}>Remove</Text></TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}

  {/* separator bar between messages and input (subtle, stays visible when keyboard is closed) */}
  {/* separator removed */}

  {
    // On Android render the input in normal layout so native adjustResize will
    // push the content up. On iOS keep the absolute animated overlay for a
    // floating input look and smooth animation.
  }
  {Platform.OS === 'android' ? (
    // On Android keep the input in normal layout so native adjustResize will
    // push content up. Use a wrapper with horizontal margins similar to the
    // absolute positioning used on iOS.
    <View style={styles.inputRowStatic}>
      <View onLayout={(e) => { try { setMeasuredInputHeight(e.nativeEvent.layout.height || measuredInputHeight); } catch (err) {} }} style={{ paddingBottom: insets.bottom + 8, flexDirection: 'row', alignItems: 'center', width: '100%' }}>
        <TouchableOpacity style={[styles.attachBtn, { backgroundColor: dyn.attachBtnBg }]} onPress={pickAttachment}><Text style={{ color: dyn.attachBtnText, fontWeight: '700' }}>📎</Text></TouchableOpacity>
        <TextInput
          ref={inputRef}
          onFocus={() => { console.log('[ChatScreen] input focused, inputHeight=', inputHeight); setTimeout(() => { try { flatRef.current?.scrollToOffset({ offset: 0 }); } catch (e) {} }, 120); }}
          onBlur={handleInputBlur}
          value={text}
          onChangeText={setText}
          placeholder={ticketStatus === 'resolved' ? 'This ticket is closed' : 'Ask the assistant'}
          placeholderTextColor={theme.colors.muted}
          style={[styles.input, { height: 60, textAlignVertical: 'center', includeFontPadding: true, lineHeight: 22, color: theme.colors.text }]}
          editable={!loading && ticketStatus !== 'resolved'}
          multiline
          allowFontScaling={false}
          returnKeyType="send"
          onSubmitEditing={() => { if (!loading && ticketStatus !== 'resolved') send(); }}
          // on Android we don't use onContentSizeChange for dynamic sizing
        />
  <Pressable onPress={send} style={[styles.send, { backgroundColor: dyn.sendBtnBg }, ticketStatus === 'resolved' ? { opacity: 0.5 } : null]} disabled={loading || ticketStatus === 'resolved' || (String(text || '').trim() === '' && attachments.length === 0)}><Text style={{ color: theme.colors.white, fontWeight: '700', fontSize: 16 }}>{loading ? '...' : '→'}</Text></Pressable>
      </View>
    </View>
  ) : (
    <Animated.View style={[styles.inputRow, { position: 'absolute', left: 12, right: 12, bottom: 0, transform: [{ translateY: inputTranslateAnim }] }]}> 
      <View onLayout={(e) => { try { setMeasuredInputHeight(e.nativeEvent.layout.height || measuredInputHeight); } catch (err) {} }} style={{ paddingBottom: insets.bottom + 8, flexDirection: 'row', alignItems: 'center', width: '100%' }}>
        <TouchableOpacity style={[styles.attachBtn, { backgroundColor: dyn.attachBtnBg }]} onPress={pickAttachment}><Text style={{ color: dyn.attachBtnText, fontWeight: '700' }}>📎</Text></TouchableOpacity>
        <TextInput
          ref={inputRef}
          onFocus={() => { console.log('[ChatScreen] input focused, inputHeight=', inputHeight); setTimeout(() => { try { flatRef.current?.scrollToOffset({ offset: 0 }); } catch (e) {} }, 120); }}
          onBlur={handleInputBlur}
          value={text}
          onChangeText={setText}
          placeholder={ticketStatus === 'resolved' ? 'This ticket is closed' : 'Ask the assistant'}
          placeholderTextColor={theme.colors.muted}
          style={[styles.input, { height: Math.max(44, Math.min(140, inputHeight)), textAlignVertical: 'center', color: theme.colors.text }]}
          editable={!loading && ticketStatus !== 'resolved'}
          multiline
          allowFontScaling={false}
          returnKeyType="send"
          onSubmitEditing={() => { if (!loading && ticketStatus !== 'resolved') send(); }}
          // keep onContentSizeChange for iOS dynamic sizing only
          onContentSizeChange={(e) => {
            try {
              const h = e.nativeEvent?.contentSize?.height || 44;
              // add a small padding so text isn't cramped
              setInputHeight(Math.max(44, Math.ceil(h + 8)));
            } catch (err) { /* ignore */ }
          }}
        />
  <Pressable onPress={send} style={[styles.send, { backgroundColor: dyn.sendBtnBg }, ticketStatus === 'resolved' ? { opacity: 0.5 } : null]} disabled={loading || ticketStatus === 'resolved' || (String(text || '').trim() === '' && attachments.length === 0)}><Text style={{ color: theme.colors.white, fontWeight: '700', fontSize: 16 }}>{loading ? '...' : '→'}</Text></Pressable>
      </View>
    </Animated.View>
  )}
        {confirmProps ? (
          <ConfirmModal
            visible={!!confirmProps.visible}
            title={confirmProps.title}
            message={confirmProps.message}
            confirmText={confirmProps.confirmText || 'OK'}
            cancelText={confirmProps.cancelText || ''}
            onConfirm={() => { try { confirmProps.onConfirm && confirmProps.onConfirm(); } catch (e) {} finally { setConfirmProps(null); } }}
            onCancel={() => { try { confirmProps.onCancel && confirmProps.onCancel(); } catch (e) {} finally { setConfirmProps(null); } }}
            showActions={confirmProps.showActions !== undefined ? confirmProps.showActions : true}
          >
            {confirmProps.children}
          </ConfirmModal>
        ) : null}
        {inspectMsg ? (
          <ConfirmModal
            visible={true}
            title={`Inspect message`}
            confirmText="Copy JSON"
            cancelText="Close"
            onConfirm={() => {
              try {
                Clipboard.setStringAsync(JSON.stringify(inspectMsg, null, 2));
              } catch (e) { /* ignore */ }
              setInspectMsg(null);
            }}
            onCancel={() => setInspectMsg(null)}
          >
            <View style={{ maxHeight: 320 }}>
              <Text style={{ fontSize: 12, color: '#222' }}>{JSON.stringify(inspectMsg, null, 2)}</Text>
            </View>
          </ConfirmModal>
        ) : null}
      </Animated.View>
    </KeyboardAvoidingView>
  );
};

const createStyles = (t: any) => StyleSheet.create({
  // overall background like WhatsApp (soft gray)
  container: { flex: 1, padding: 12, backgroundColor: t.colors.background },
  header: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  // tighten header spacing and keep it visually separate
  headerRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingVertical: 6 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  profileIcon: { width: 44, height: 44, borderRadius: 22 },
  subHeader: { color: t.colors.muted, fontSize: 13 },
  headerRight: { alignItems: 'flex-end', marginLeft: 12 },
  idChip: { backgroundColor: t.colors.surface, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginBottom: 6 },
  idChipText: { fontSize: 12, color: t.colors.primary, fontWeight: '700' },
  resolveBtn: { backgroundColor: t.colors.surface, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6 },
  resolveBtnText: { fontSize: 12 },
  closedBox: { marginTop: 8, padding: 10, backgroundColor: t.colors.surface, borderRadius: 8 },
  closedTitle: { color: t.colors.success, fontWeight: '700' },
  closedText: { color: t.colors.muted, marginTop: 4 },
  // message bubble
  msg: { padding: 10, borderRadius: 18, marginBottom: 8, maxWidth: '80%', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 2, elevation: 1 },
  msgText: { fontSize: 15, lineHeight: 20, color: t.colors.text },
  // outgoing (user) bubble resembles WhatsApp green tint
  userBubble: { borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomLeftRadius: 18, borderBottomRightRadius: 6 },
  // incoming (bot/admin) bubble white with subtle border
  botBubble: { borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomLeftRadius: 6, borderBottomRightRadius: 18 },
  user: { alignSelf: 'flex-end' },
  bot: { alignSelf: 'flex-start', borderWidth: 0.5, borderColor: t.colors.border },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 8, marginLeft: 8 },
  msgContainer: { flex: 1, /* allow bubble to expand between avatars */ position: 'relative' },
  // timestamp small and dim, placed just beneath bubble
  msgTime: { fontSize: 11, color: t.colors.muted, marginTop: 4, alignSelf: 'flex-end' },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  msgStatus: { fontSize: 12, color: t.colors.muted, marginLeft: 6 },
  // bubble tail (triangle) base
  bubbleTail: { width: 0, height: 0, position: 'absolute' },
  bubbleTailLeft: { left: -6, top: 10, borderTopWidth: 8, borderBottomWidth: 8, borderRightWidth: 10, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: t.colors.white },
  bubbleTailRight: { right: -6, top: 10, borderTopWidth: 8, borderBottomWidth: 8, borderLeftWidth: 10, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: t.colors.success },
  headerBar: { backgroundColor: t.colors.primary, padding: 8, borderRadius: 8, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // input area: white floating bar with round send button
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent', paddingTop: 8, paddingBottom: 6 },
  input: { flex: 1, borderWidth: 0, borderRadius: 22, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: t.colors.surface, minHeight: 44, fontSize: 16, lineHeight: 20, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 2, elevation: 1 },
  send: { backgroundColor: t.colors.primary, padding: 12, borderRadius: 22, marginLeft: 8, alignItems: 'center', justifyContent: 'center' },
  promptBox: { backgroundColor: t.colors.surface, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: t.colors.border, marginBottom: 8 },
  promptText: { marginBottom: 8 },
  promptActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  promptBtn: { backgroundColor: t.colors.primary, padding: 8, borderRadius: 6, paddingHorizontal: 12, marginLeft: 8 },
  promptBtnSecondary: { backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  botAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 8 },
  userAvatar: { width: 36, height: 36, borderRadius: 18, marginLeft: 8, backgroundColor: t.colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.mutedLight, marginRight: 8, marginLeft: 8 },
  adminDot: { position: 'absolute', width: 12, height: 12, borderRadius: 8, right: 4, bottom: 4, backgroundColor: t.colors.success, borderWidth: 2, borderColor: t.colors.white, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2 },
  initialsCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 8, marginLeft: 8 },
  initialsText: { color: t.colors.white, fontWeight: '700' },
  attachPreviewRow: { flexDirection: 'row', paddingVertical: 8, gap: 8 },
  inputRowStatic: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent', paddingTop: 8, paddingBottom: 6, marginHorizontal: 12 },
  attachItem: { width: 88, alignItems: 'center', marginRight: 8 },
  attachThumb: { width: 72, height: 72, borderRadius: 8 },
  attachName: { fontSize: 12, maxWidth: 72, textAlign: 'center' },
  attachBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: t.colors.surface, marginRight: 8, alignItems: 'center', justifyContent: 'center' },
  sheetOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 50 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheetContainer: { backgroundColor: t.colors.surface, padding: 16, borderTopLeftRadius: 12, borderTopRightRadius: 12, borderColor: t.colors.border, borderTopWidth: 1 },
  sheetTitle: { fontWeight: '700', fontSize: 16, marginBottom: 12 },
  sheetAction: { paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8, backgroundColor: t.colors.primary, marginBottom: 8, alignItems: 'center' },
  sheetActionText: { color: t.colors.white, fontWeight: '700' },
});

export default ChatScreen;
