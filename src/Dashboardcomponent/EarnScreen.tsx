import React, { useEffect, useState, useMemo } from "react";
import { View, Text, TouchableOpacity, ScrollView, Share, StyleSheet, Platform } from "react-native";
import { MaterialIcons, Ionicons, FontAwesome5 } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import SkeletonBox from "../components/SkeletonBox";
import authStorage from "../utils/authStorage";
import ScreenHeader from "../components/ScreenHeader";
import { showToast } from "../utils/toast";
import { useTheme } from "../theme/index";
import theme from "../styles/theme";
import axios from "axios";
import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
export const API_URL = extra?.apiUrl || 'http://localhost:3000';

const EarnScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any | null>(null);
  const themeCtx = (() => { try { return useTheme(); } catch (e) { return undefined as any; } })();
  const t = themeCtx || theme;
  const styles = useMemo(() => createStyles(t), [t]);

  useEffect(() => {
    (async () => {
      try {
        const token = await authStorage.getToken();
        const res = await axios.get(`${API_URL}/api/user/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setProfile(res.data);
      } catch (err) { console.error(err); } 
      finally { setLoading(false); }
    })();
  }, []);

  const copyCode = async () => {
    if (profile?.referralCode) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Clipboard.setStringAsync(profile.referralCode);
      showToast("Referral code copied!");
    }
  };

  const shareInvite = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const link = `https://exdollarium.com/signup?ref=${profile?.referralCode}`;
    await Share.share({ message: `Join me on Exdollarium! Use code: ${profile?.referralCode}\n${link}` });
  };

  if (loading) return (
    <View style={styles.page}>
      <ScreenHeader title="Earn" />
      <View style={{ padding: 20 }}>
        <SkeletonBox height={160} width="100%" radius={24} shimmer />
        <View style={{ height: 20 }} />
        <SkeletonBox height={80} width="100%" radius={24} shimmer />
      </View>
    </View>
  );

  return (
    <View style={styles.page}>
      <ScreenHeader title="Refer & Earn" hideBottomBorder />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Earnings Card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Total Bonus Earned</Text>
          <Text style={styles.heroValue}>₦{profile?.referralBonusEarned?.toLocaleString() || '0'}</Text>
          <View style={styles.heroStats}>
            <View>
              <Text style={styles.statLabel}>Friends Referred</Text>
              <Text style={styles.statValue}>{profile?.referredCount || 0}</Text>
            </View>
            <View style={styles.statDivider} />
            <View>
              <Text style={styles.statLabel}>Pending Potential</Text>
              <Text style={[styles.statValue, { color: '#A7F3D0' }]}>₦{(profile?.referredCount * 2000).toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* Code Box */}
        <Text style={styles.sectionLabel}>Your Invite Code</Text>
        <View style={styles.codeContainer}>
          <Text style={styles.codeText}>{profile?.referralCode}</Text>
          <TouchableOpacity onPress={copyCode} style={styles.copyBadge}>
            <Ionicons name="copy" size={16} color={t.colors.white} />
            <Text style={styles.copyText}>COPY</Text>
          </TouchableOpacity>
        </View>

        {/* How it Works */}
        <View style={styles.infoRow}>
          <View style={styles.iconCircle}>
            <Ionicons name="rocket" size={20} color={t.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>₦2,000 Reward</Text>
            <Text style={styles.infoBody}>Get paid when your friend completes a trade of ₦20,000 or more.</Text>
          </View>
        </View>

        {/* Referral List */}
        {profile?.referredUsers?.length > 0 && (
          <View style={styles.listSection}>
            <Text style={styles.sectionLabel}>Your Referrals</Text>
            <View style={styles.listCard}>
              {profile.referredUsers.map((user: any, i: number) => (
                <View key={user._id} style={[styles.userRow, i === 0 && { borderTopWidth: 0 }]}>
                  <View style={styles.avatar}><Text style={styles.avatarText}>{user.username[0].toUpperCase()}</Text></View>
                  <Text style={styles.username}>@{user.username}</Text>
                  <View style={[styles.badge, { backgroundColor: user.totalFunded >= 20000 ? '#DCFCE7' : '#F3F4F6' }]}>
                    <Text style={[styles.badgeText, { color: user.totalFunded >= 20000 ? '#166534' : '#6B7280' }]}>
                      {user.totalFunded >= 20000 ? 'PAID' : 'PENDING'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.inviteBtn} onPress={shareInvite}>
          <Text style={styles.inviteBtnText}>Invite Friends</Text>
          <Ionicons name="share-social" size={20} color={t.colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (t: any) => StyleSheet.create({
  page: { flex: 1, backgroundColor: t.colors.background },
  content: { padding: 20, paddingBottom: 120 },
  heroCard: { backgroundColor: t.colors.primary, borderRadius: 24, padding: 24, elevation: 8, shadowColor: t.colors.primary, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 8 } },
  heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  heroValue: { color: t.colors.white, fontSize: 34, fontWeight: '800', marginVertical: 8 },
  heroStats: { flexDirection: 'row', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },
  statLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' },
  statValue: { color: t.colors.white, fontSize: 16, fontWeight: '700', marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 20 },
  sectionLabel: { fontSize: 14, fontWeight: '800', color: t.colors.text, marginTop: 24, marginBottom: 12, textTransform: 'uppercase', opacity: 0.5 },
  codeContainer: { backgroundColor: t.colors.surface, borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: t.colors.border },
  codeText: { fontSize: 22, fontWeight: '800', color: t.colors.primary, letterSpacing: 2, paddingLeft: 8 },
  copyBadge: { backgroundColor: t.colors.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  copyText: { color: t.colors.white, fontWeight: '800', fontSize: 12 },
  infoRow: { flexDirection: 'row', gap: 16, marginTop: 24, alignItems: 'center', backgroundColor: t.colors.primary + '08', padding: 16, borderRadius: 20 },
  iconCircle: { width: 44, height: 44, borderRadius: 14, backgroundColor: t.colors.white, alignItems: 'center', justifyContent: 'center' },
  infoTitle: { fontWeight: '800', color: t.colors.text, fontSize: 15 },
  infoBody: { color: t.colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  listSection: { marginTop: 20 },
  listCard: { backgroundColor: t.colors.surface, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: t.colors.border },
  userRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderTopWidth: 1, borderTopColor: t.colors.border },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: t.colors.primary + '15', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: t.colors.primary, fontWeight: '800', fontSize: 14 },
  username: { flex: 1, marginLeft: 12, fontWeight: '700', color: t.colors.text },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  footer: { position: 'absolute', bottom: 0, width: '100%', padding: 20, backgroundColor: t.colors.background },
  inviteBtn: { backgroundColor: t.colors.primary, height: 60, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 },
  inviteBtnText: { color: t.colors.white, fontSize: 16, fontWeight: '800' }
});

export default EarnScreen;