import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { getTickets } from '../api/client';
import socket from '../utils/socket';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ScreenHeader from '../components/ScreenHeader';
import SkeletonBox from '../components/SkeletonBox';
import { useTheme } from '../theme/index';
import { mapToUiStatus, highlightColor } from '../utils/statusMapper';

const MessagesScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    
    const t = useTheme();
    const styles = useMemo(() => createStyles(t), [t]);

    useEffect(() => { refreshTickets(); }, []);

    useEffect(() => {
        let mounted = true;
        socket.initSocket().then(() => {
            const refreshHandler = async () => { if (mounted) await refreshTickets(); };
            socket.on('ticket:reply', refreshHandler);
            socket.on('ticket:new', refreshHandler);
            socket.on('ticket:status', refreshHandler);
            return () => {
                mounted = false;
                socket.off('ticket:reply', refreshHandler);
                socket.off('ticket:new', refreshHandler);
                socket.off('ticket:status', refreshHandler);
            };
        }).catch(() => {});
        return () => { mounted = false; };
    }, []);

    async function refreshTickets() {
        setLoading(true);
        try {
            const res = await getTickets().catch(() => ({ tickets: [] }));
            setTickets(res.tickets || res || []);
        } catch (e) {
            console.warn('Failed to refresh tickets', e);
        } finally {
            setLoading(false);
        }
    }

    const markTicketSeen = async (ticket: any) => {
        try {
            const raw = await AsyncStorage.getItem('ticket_seen_counts');
            const map = raw ? JSON.parse(raw) : {};
            const id = String(ticket._id || ticket.ticketId || '');
            const adminCount = (ticket.replies || []).filter((r: any) => 
                ['admin', 'support'].includes(String(r?.senderRole || '').toLowerCase())
            ).length;
            map[id] = adminCount;
            await AsyncStorage.setItem('ticket_seen_counts', JSON.stringify(map));
        } catch (e) {}
    };

    const renderTicket = ({ item }: { item: any }) => {
        const replies = Array.isArray(item.replies) ? item.replies : [];
        const last = replies.length ? replies[replies.length - 1] : null;
        const sender = last ? (last.senderRole === 'admin' ? 'Support' : 'You') : 'You';
        const snippet = last ? String(last.message) : String(item.message || '');
        const time = last ? new Date(last.at || last.createdAt).toLocaleDateString() : new Date(item.createdAt).toLocaleDateString();
        
        const uiStatus = mapToUiStatus(item.status);

        return (
            <TouchableOpacity 
                style={styles.card} 
                onPress={async () => { 
                    await markTicketSeen(item); 
                    navigation.navigate('Chat', { ticketId: item.ticketId || item._id, ticketSubject: item.subject }); 
                }}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.idBadge}>
                        <Text style={styles.idText}>#{String(item.ticketId || item._id).slice(-6)}</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: `${highlightColor(item.status)}15` }]}>
                        <Text style={[styles.statusText, { color: highlightColor(item.status) }]}>
                            {uiStatus.label.toUpperCase()}
                        </Text>
                    </View>
                </View>

                <Text style={styles.subject} numberOfLines={1}>{item.subject}</Text>
                
                <View style={styles.snippetContainer}>
                    <Text style={styles.senderLabel}>{sender}: </Text>
                    <Text numberOfLines={1} style={styles.lastSnippet}>{snippet}</Text>
                </View>

                <View style={styles.footer}>
                    <View style={styles.footerItem}>
                        <Feather name="clock" size={12} color={t.colors.muted} />
                        <Text style={styles.footerText}>{time}</Text>
                    </View>
                    {item.attachments?.length > 0 && (
                        <View style={styles.footerItem}>
                            <Feather name="paperclip" size={12} color={t.colors.muted} />
                            <Text style={styles.footerText}>{item.attachments.length} files</Text>
                        </View>
                    )}
                </View>

                {item.unread && <View style={styles.unreadDot} />}
            </TouchableOpacity>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: t.colors.background }}>
            <ScreenHeader title="Support Messages" />
            <FlatList
                contentContainerStyle={styles.listContainer}
                data={tickets}
                keyExtractor={(t) => String(t._id || t.ticketId)}
                renderItem={renderTicket}
                ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                        <Feather name="mail" size={50} color={t.colors.border} />
                        <Text style={styles.emptyText}>No support tickets found</Text>
                    </View>
                )}
                refreshing={loading}
                onRefresh={refreshTickets}
            />
        </View>
    );
};

const createStyles = (t: any) => StyleSheet.create({
    listContainer: { padding: 16, paddingBottom: 100 },
    card: { 
        backgroundColor: t.colors.surface, 
        padding: 16, 
        borderRadius: 16, 
        marginBottom: 12, 
        borderWidth: 1, 
        borderColor: t.colors.border,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
    },
    cardHeader: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 10 
    },
    idBadge: { 
        backgroundColor: t.colors.background, 
        paddingHorizontal: 8, 
        paddingVertical: 4, 
        borderRadius: 6 
    },
    idText: { 
        fontSize: 11, 
        fontWeight: 'bold', 
        color: t.colors.muted,
        fontFamily: 'System'
    },
    statusPill: { 
        paddingHorizontal: 10, 
        paddingVertical: 4, 
        borderRadius: 12 
    },
    statusText: { 
        fontSize: 10, 
        fontWeight: '800' 
    },
    subject: { 
        fontSize: 17, 
        fontWeight: '700', 
        color: t.colors.text,
        marginBottom: 6 
    },
    snippetContainer: { 
        flexDirection: 'row', 
        alignItems: 'center',
        marginBottom: 12 
    },
    senderLabel: { 
        fontSize: 14, 
        fontWeight: '600', 
        color: t.colors.primary 
    },
    lastSnippet: { 
        flex: 1, 
        fontSize: 14, 
        color: t.colors.muted 
    },
    footer: { 
        flexDirection: 'row', 
        borderTopWidth: 1, 
        borderTopColor: t.colors.border,
        paddingTop: 10,
        gap: 15
    },
    footerItem: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 4 
    },
    footerText: { 
        fontSize: 12, 
        color: t.colors.muted 
    },
    unreadDot: { 
        position: 'absolute', 
        right: -4, 
        top: -4, 
        width: 14, 
        height: 14, 
        borderRadius: 7, 
        backgroundColor: t.colors.error,
        borderWidth: 2,
        borderColor: t.colors.surface
    },
    emptyContainer: { 
        marginTop: 100, 
        alignItems: 'center', 
        justifyContent: 'center' 
    },
    emptyText: { 
        color: t.colors.muted, 
        marginTop: 15, 
        fontSize: 16,
        fontWeight: '500'
    },
});

export default MessagesScreen;