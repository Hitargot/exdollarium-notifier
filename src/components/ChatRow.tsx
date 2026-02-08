import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import showToast from '../utils/toast';
import { useTheme } from '../theme/index';

type Props = {
  onPress?: () => void;
  avatarUrl?: string | null;
  initials?: string;
  title: string;
  snippet?: string;
  time?: string;
  unread?: boolean;
  ticketId?: string;
  activeRole?: 'admin' | 'user' | null;
  active?: boolean;
  titleColor?: string;
  snippetColor?: string;
};

const ChatRow: React.FC<Props> = ({ 
  onPress, avatarUrl, initials, title, snippet, time, 
  unread, activeRole, active, titleColor, snippetColor, ticketId 
}) => {
  const { colors } = useTheme();
  
  const isActive = typeof active === 'boolean' ? active : Boolean(activeRole);
  const APP_LOGO = require('../../assets/ex_logo.png');

  const copyTicketId = async (id?: string) => {
    if (!id) return;
    await Clipboard.setStringAsync(String(id));
    showToast('Ticket ID copied');
  };

  const renderAvatar = () => {
    if (avatarUrl) {
      return <Image source={{ uri: avatarUrl }} style={styles.avatar} />;
    }
    if (initials) {
      return (
        <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary + '15' }]}>
          <Text style={[styles.avatarInitials, { color: colors.primary }]}>{initials.toUpperCase()}</Text>
        </View>
      );
    }
    return <Image source={APP_LOGO} style={styles.avatar} />;
  };

  return (
    <Pressable 
      style={({ pressed }) => [
        styles.row, 
        pressed && { backgroundColor: 'rgba(0,0,0,0.02)' }
      ]} 
      onPress={onPress}
    >
      <View style={styles.leftCol}>
        <View style={styles.avatarWrapper}>
          {renderAvatar()}
          {isActive && <View style={styles.activeDot} />}
        </View>
      </View>

      <View style={styles.midCol}>
        <View style={styles.topHeader}>
          <Text style={[styles.title, titleColor ? { color: titleColor } : { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          {time && <Text style={styles.time}>{time}</Text>}
        </View>

        <Text numberOfLines={1} style={[styles.snippet, snippetColor ? { color: snippetColor } : { color: colors.muted }]}>
          {snippet}
        </Text>

        {ticketId && (
          <TouchableOpacity 
            style={styles.ticketBadge} 
            onPress={() => copyTicketId(ticketId)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="copy-outline" size={10} color={colors.primary} />
            <Text style={[styles.ticketText, { color: colors.primary }]}>{ticketId}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.rightCol}>
        {unread && <View style={[styles.unreadDot, { backgroundColor: colors.error || '#E53935' }]} />}
        <Ionicons name="chevron-forward" size={16} color="#D1D1D6" />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 16, 
    paddingHorizontal: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F2F2F7' 
  },
  leftCol: { marginRight: 12 },
  avatarWrapper: { position: 'relative' },
  avatar: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#F2F2F7' }, // Squircle/Premium radius
  avatarPlaceholder: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontWeight: '700', fontSize: 18 },
  activeDot: { 
    position: 'absolute', 
    width: 14, 
    height: 14, 
    borderRadius: 7, 
    right: -2, 
    bottom: -2, 
    backgroundColor: '#22C55E', 
    borderWidth: 3, 
    borderColor: '#fff' 
  },
  midCol: { flex: 1, justifyContent: 'center' },
  topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  snippet: { fontSize: 14, lineHeight: 20 },
  time: { fontSize: 12, color: '#8E8E93', fontWeight: '500' },
  rightCol: { alignItems: 'flex-end', justifyContent: 'center', marginLeft: 8, gap: 10 },
  unreadDot: { width: 10, height: 10, borderRadius: 5 },
  ticketBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(0,0,0,0.04)', 
    alignSelf: 'flex-start', 
    paddingHorizontal: 8, 
    paddingVertical: 2, 
    borderRadius: 6, 
    marginTop: 8,
    gap: 4
  },
  ticketText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
});

export default ChatRow;