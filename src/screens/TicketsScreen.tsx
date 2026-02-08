import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  TextInput, Image, ScrollView, Modal, Keyboard, Platform,
  ActivityIndicator
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';

import socket from '../utils/socket';
import ChatRow from '../components/ChatRow';
import { createTicket } from '../api/client';
import ScreenHeader from '../components/ScreenHeader';
import ConfirmModal from '../components/ConfirmModal';
import appTheme from '../styles/theme';
import { useTheme } from '../theme/index';

const TicketsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  
  // Theme & Styles
  const themeCtx = (() => { try { return useTheme(); } catch (e) { return undefined as any; } })();
  const t = themeCtx || appTheme;
  const styles = useMemo(() => createStyles(t), [t]);

  // State
  const [tickets, setTickets] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [presenceMap, setPresenceMap] = useState<Record<string, boolean>>({});
  const [confirmProps, setConfirmProps] = useState<any>(null);
  
  // Modal/UI State
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const params = route.params || {};
    if (params.tickets) setTickets(params.tickets);
    if (params.subject) setSubject(params.subject);
    if (params.initialMessage) setMessage(params.initialMessage);
    if (params.attachments && Array.isArray(params.attachments) && params.attachments.length > 0) {
      // attachments expected as [{ uri, name, type }]
      setAttachments(params.attachments.map((a: any) => ({ uri: a.uri, name: a.name || 'file', type: a.type || 'application/octet-stream' })));
    }

    // Socket Presence
    socket.initSocket().then(() => {
      socket.on('presence:update', (p: any) => {
        const key = p?.role === 'admin' ? 'admin' : (p?.userId ? String(p.userId) : null);
        if (key) setPresenceMap(prev => ({ ...prev, [key]: !!p.online }));
      });
    });

    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    
    return () => {
      socket.off('presence:update');
      showSub.remove();
      hideSub.remove();
    };
  }, [route.params]);

  const handlePickAttachment = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: 'image/*', multiple: true });
    if (res.canceled) return;
    
    const picked = res.assets.map(a => ({
      uri: a.uri,
      name: a.name,
      type: a.mimeType || 'image/jpeg'
    }));
    setAttachments(prev => [...prev, ...picked]);
  };

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      return setConfirmProps({ visible: true, title: 'Missing Info', message: 'Please provide a subject and message.', confirmText: 'OK', onConfirm: () => setConfirmProps(null) });
    }

    setIsSubmitting(true);
    try {
      const res = await createTicket({ subject: subject.trim(), message: message.trim(), attachments });
      const id = res?.ticketId || res?._id || res?.id;
      
      setSubject(''); setMessage(''); setAttachments([]);
      
      setConfirmProps({
        visible: true,
        title: 'Ticket Created',
        message: 'Your support request has been logged.',
        confirmText: 'View Chat',
        cancelText: 'Later',
        onConfirm: () => {
          setConfirmProps(null);
          navigation.navigate('Chat', { ticketId: id, ticketSubject: subject });
        },
        onCancel: () => setConfirmProps(null)
      });
    } catch (e) {
      setConfirmProps({ visible: true, title: 'Error', message: 'Could not create ticket.', confirmText: 'OK', onConfirm: () => setConfirmProps(null) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.page}>
      <ScreenHeader title="Support Center" />
      
      <FlatList
        data={tickets}
        keyExtractor={(item) => item._id || String(Math.random())}
        ListHeaderComponent={
          <Animatable.View animation="fadeInDown" duration={600} style={styles.formCard}>
            <Text style={styles.sectionTitle}>New Support Request</Text>
            
            <TextInput 
              placeholder="What is this regarding?" 
              placeholderTextColor={t.colors.muted} 
              value={subject} 
              onChangeText={setSubject} 
              style={styles.input} 
            />
            
            <TextInput 
              placeholder="Describe your issue in detail..." 
              placeholderTextColor={t.colors.muted} 
              value={message} 
              onChangeText={setMessage} 
              style={[styles.input, styles.textArea]} 
              multiline 
            />

            <View style={styles.attachmentRow}>
              <TouchableOpacity style={styles.attachBtn} onPress={handlePickAttachment}>
                <Feather name="paperclip" size={20} color={t.colors.primary} />
                <Text style={styles.attachBtnText}>Attach</Text>
              </TouchableOpacity>
              
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {attachments.map((a, idx) => (
                  <View key={idx} style={styles.thumbWrapper}>
                    <Image source={{ uri: a.uri }} style={styles.thumb} />
                    <TouchableOpacity 
                      onPress={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                      style={styles.removeThumb}
                    >
                      <Ionicons name="close" size={12} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity 
                style={[styles.submitBtn, { backgroundColor: t.colors.primary }]} 
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Ticket</Text>}
              </TouchableOpacity>
            </View>
          </Animatable.View>
        }
        renderItem={({ item }) => (
          <ChatRow
            onPress={() => navigation.navigate('Chat', { ticketId: item.ticketId || item._id, ticketSubject: item.subject })}
            title={item.subject}
            snippet={item.message}
            unread={!!item.unread}
            activeRole={presenceMap['admin'] ? 'admin' : 'user'}
          />
        )}
        ListEmptyComponent={
          !keyboardVisible ? (
            <View style={styles.emptyState}>
              <Feather name="message-circle" size={48} color={t.colors.border} />
              <Text style={styles.emptyText}>No active tickets found</Text>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => navigation.navigate('Messages')}>
                <Text style={styles.outlineBtnText}>View Message History</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />

      {/* Image Preview Modal */}
      <Modal visible={previewVisible} transparent>
        <View style={styles.modalOverlay}>
            <TouchableOpacity style={styles.closeModal} onPress={() => setPreviewVisible(false)}>
                <Ionicons name="close" size={30} color="#fff" />
            </TouchableOpacity>
            {previewUri && <Image source={{ uri: previewUri }} style={styles.fullImage} />}
        </View>
      </Modal>

      {confirmProps && <ConfirmModal {...confirmProps} />}
    </View>
  );
};

const createStyles = (t: any) => StyleSheet.create({
  page: { flex: 1, backgroundColor: t.colors.background },
  formCard: { 
    backgroundColor: t.colors.surface, 
    margin: 16, 
    padding: 24, 
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.colors.border,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: t.colors.text, marginBottom: 16 },
  input: { 
    backgroundColor: t.colors.background, 
    borderRadius: 10, 
    padding: 12, 
    marginBottom: 12, 
    color: t.colors.text,
    borderWidth: 1,
    borderColor: t.colors.border
  },
  textArea: { height: 160, textAlignVertical: 'top' },
  attachmentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  attachBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 10, 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: t.colors.primary,
    marginRight: 12 
  },
  attachBtnText: { color: t.colors.primary, fontWeight: '600', marginLeft: 4 },
  thumbWrapper: { marginRight: 10 },
  thumb: { width: 50, height: 50, borderRadius: 8 },
  removeThumb: { 
    position: 'absolute', top: -5, right: -5, 
    backgroundColor: t.colors.error, borderRadius: 10, 
    width: 18, height: 18, justifyContent: 'center', alignItems: 'center' 
  },
  actionRow: { marginTop: 8 },
  submitBtn: { padding: 14, borderRadius: 10, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  emptyState: { alignItems: 'center', marginTop: 40, padding: 20 },
  emptyText: { color: t.colors.muted, marginTop: 12, fontSize: 14 },
  outlineBtn: { marginTop: 16, padding: 10, borderWidth: 1, borderColor: t.colors.border, borderRadius: 8 },
  outlineBtnText: { color: t.colors.muted, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  closeModal: { position: 'absolute', top: 50, right: 20 },
  fullImage: { width: '90%', height: '70%', resizeMode: 'contain' }
});

export default TicketsScreen;