import React, { useEffect, useState, useMemo } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, TextInput, 
  ScrollView, Switch, Platform, Share 
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useNavigation, NavigationProp } from '@react-navigation/native';

import ScreenHeader from '../components/ScreenHeader';
import ConfirmModal from '../components/ConfirmModal';
import SkeletonBox from '../components/SkeletonBox';
import { showToast } from '../utils/toast';
import { showInAppConfirm } from '../contexts/ConfirmContext';
import { useTheme } from '../theme/index';
import { usePreferences } from '../contexts/PreferencesContext';
import theme from '../styles/theme';
import authStorage from '../utils/authStorage';
import * as authLock from '../utils/authLock';
import { savePushToken, unregisterPushToken } from '../utils/pushTokenManager';
import { RootStackParamList } from '../screens/types';

type Extra = { apiUrl: string; env: string };
const extra = Constants.expoConfig?.extra as Extra;
export const API_URL_V2 = extra?.apiUrl || '';

const ProfileScreenV2 = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Modal & Loading States
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPayIdModal, setShowPayIdModal] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [savingPayId, setSavingPayId] = useState(false);
  const [showSparkline, setShowSparkline] = useState(true);

  // Contexts
  const prefCtx = usePreferences();
  const themeCtx = useTheme();
  const runtimeTheme = themeCtx;
  const styles = useMemo(() => createStyles(runtimeTheme), [runtimeTheme]);

  // Input States
  const [firstNameInput, setFirstNameInput] = useState('');
  const [lastNameInput, setLastNameInput] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [payIdInput, setPayIdInput] = useState('');

  const fetchProfile = async () => {
    try {
      setLoading(true);
      // 1. Check Cache
      const raw = await AsyncStorage.getItem('@profile_cache_v2');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.ts && (Date.now() - parsed.ts) < (5 * 60 * 1000)) {
          setUser(parsed.data);
          setLoading(false);
          return;
        }
      }

      // 2. Network Fetch
      const token = await authStorage.getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      const res = await fetch(`${API_URL_V2}/api/user/profile`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load profile');
      
      setUser(data);
      await AsyncStorage.setItem('@profile_cache_v2', JSON.stringify({ ts: Date.now(), data }));
    } catch (err: any) {
      showToast(err?.message || 'Could not load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); }, []);

  useEffect(() => {
    if (prefCtx?.ready) {
      setShowSparkline(prefCtx.preferences.showBalanceSparkline);
    }
  }, [prefCtx]);

  const handleUpdateName = async () => {
    if (!firstNameInput.trim() || !lastNameInput.trim()) {
      showToast('Please enter both first and last name.');
      return;
    }
    setSavingName(true);
    try {
      const token = await authStorage.getToken();
      const res = await fetch(`${API_URL_V2}/api/user/update-profile`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, 
        body: JSON.stringify({ firstName: firstNameInput.trim(), lastName: lastNameInput.trim() }) 
      });
      if (!res.ok) throw new Error('Update failed');
      
      const next = { ...user, firstName: firstNameInput.trim(), lastName: lastNameInput.trim() };
      setUser(next);
      await AsyncStorage.setItem('@profile_cache_v2', JSON.stringify({ ts: Date.now(), data: next }));
      setShowEditModal(false);
      showToast('₦Profile updated');
    } catch (err: any) {
      showToast(err.message);
    } finally {
      setSavingName(false);
    }
  };

  const handleUpdatePayId = async () => {
    if (!payIdInput.trim()) {
      showToast('Pay ID cannot be empty');
      return;
    }
    setSavingPayId(true);
    try {
      const token = await authStorage.getToken();
      const res = await fetch(`${API_URL_V2}/api/user/set-payid`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, 
        body: JSON.stringify({ payId: payIdInput.trim() }) 
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update Pay ID');
      
      const next = { ...user, payId: payIdInput.trim() };
      setUser(next);
      await AsyncStorage.setItem('@profile_cache_v2', JSON.stringify({ ts: Date.now(), data: next }));
      setShowPayIdModal(false);
      showToast('₦Pay ID updated');
    } catch (err: any) {
      showToast(err.message);
    } finally {
      setSavingPayId(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      showToast('Please fill in both password fields');
      return;
    }
    setChangingPassword(true);
    try {
      const token = await authStorage.getToken();
      const res = await fetch(`${API_URL_V2}/api/user/update-password`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, 
        body: JSON.stringify({ currentPassword, newPassword }) 
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update password');
      
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      showToast('₦Password changed successfully');
    } catch (err: any) {
      showToast(err.message);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleCopyPayId = async () => {
    if (user?.payId) {
      await Clipboard.setStringAsync(user.payId);
      if (Platform.OS !== 'web') Haptics.selectionAsync();
      showToast('Pay ID copied');
    }
  };
const ActionButton = ({ label, icon, onPress, styles, theme }: any) => (
  <TouchableOpacity style={styles.primaryAction} onPress={onPress}>
    <Ionicons 
      name={icon} 
      size={18} 
      color={theme.colors.primary} // Fix: Use theme primary color
    />
    <Text style={styles.primaryActionText}>{label}</Text>
  </TouchableOpacity>
);
  const handleLogout = async () => {
    const ok = await showInAppConfirm({ 
      title: 'Logout', 
      message: 'Are you sure you want to logout?',
      confirmText: 'Logout',
    });
    if (ok) {
      try {
        const token = await authStorage.getToken();
        await unregisterPushToken(token);
      } catch (e) {
        console.warn('Failed to unregister from push notifications', e);
      }
      await authStorage.removeToken();
      await authLock.clear();
      // After logout, navigate to a login/auth screen.
      // This assumes you have a screen named 'Login' in your root stack.
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }
  };

  const handleShareReferral = async () => {
    try {
      const message = `Join me on this amazing app! Use my referral code: ${user?.referralCode}`;
      await Share.share({ message });
    } catch (err: any) {
      showToast('Failed to share referral code');
    }
  };

  const formatNaira = (amount: number) => {
    if (!amount) return '₦0';
    if (amount >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(1)}M`;
    return `₦${amount.toLocaleString()}`;
  };
const initials = useMemo(() => {
  if (user?.firstName && user?.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  }
  return (user?.username?.[0] || user?.email?.[0] || '?').toUpperCase();
}, [user]);

  return (
    <>
      <ScreenHeader title="My Profile" backgroundColor={runtimeTheme.colors.surface} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ProfileSkeleton styles={styles} />
        ) : (
          <>
            {/* Header Identity Card */}
            <View style={styles.headerCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fullName}>
                  {user?.firstName ? `${user.firstName} ${user.lastName}` : user?.username}
                </Text>
                <Text style={styles.username}>@{user?.username || 'user'}</Text>
                <Text style={styles.email} numberOfLines={1}>{user?.email}</Text>
              </View>
              <View style={styles.initialsCircle}>
  <Text style={styles.initialsText}>
    {initials} {/* Use the memoized variable here! */}
  </Text>
</View>
            </View>

            {/* Quick Stats Grid */}
            <View style={styles.statsRowCard}>
              <StatItem label="Traded" value={formatNaira(user?.totalFunded)} styles={styles} />
              <StatItem label="Withdrawn" value={formatNaira(user?.totalWithdrawn)} styles={styles} />
              <StatItem label="Transferred" value={formatNaira(user?.totalSentTransfers)} styles={styles} />
            </View>

            {/* Pay ID Section */}
            <View style={styles.payIdCard}>
              <View style={styles.payIdContent}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Pay ID (Wallet Username)</Text>
                  {user?.payId ? (
                    <TouchableOpacity onPress={handleCopyPayId} style={styles.payIdRow}>
                      <Text style={styles.payIdText}>{user.payId}</Text>
                      <Ionicons name="copy-outline" size={16} color={runtimeTheme.colors.primary} />
                    </TouchableOpacity>
                  ) : <Text style={styles.value}>Not assigned</Text>}
                </View>
                <TouchableOpacity 
                    style={styles.editBtn} 
                    onPress={() => { setPayIdInput(user?.payId || ''); setShowPayIdModal(true); }}
                >
                  <MaterialIcons name="edit" size={16} color={runtimeTheme.colors.primary} />
                  <Text style={styles.editBtnText}>{user?.payId ? 'Update' : 'Set'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Preferences & Settings */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Preferences</Text>
              
              <View style={styles.preferenceRow}>
                <Text style={styles.prefText}>Dashboard Sparkline</Text>
                <Switch 
                  value={showSparkline} 
                  onValueChange={(v) => prefCtx?.setShowBalanceSparkline(v)} 
                  thumbColor={Platform.OS === 'android' ? runtimeTheme.colors.primary : undefined}
                  trackColor={{ true: runtimeTheme.colors.primary + '80', false: '#ccc' }}
                />
              </View>

              <View style={styles.preferenceRow}>
                <Text style={styles.prefText}>App Theme</Text>
                <View style={styles.themeToggle}>
                  {['light', 'dark'].map((mode) => (
                    <TouchableOpacity 
                      key={mode}
                      style={[styles.themeBtn, themeCtx?.preference === mode && styles.themeBtnActive]}
                      onPress={() => themeCtx?.setPreference(mode as any)}
                    >
                      <Text style={[styles.themeBtnText, themeCtx?.preference === mode && { color: runtimeTheme.colors.white }]}>
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Security Actions */}
            <View style={styles.actionsGrid}>
  <ActionButton 
    label="Edit Profile" 
    icon="pencil-outline" 
    onPress={() => { 
      setFirstNameInput(user?.firstName || ''); 
      setLastNameInput(user?.lastName || ''); 
      setShowEditModal(true); 
    }}
    styles={styles}
    theme={runtimeTheme} // Pass theme here
  />
  <ActionButton 
    label="Security" 
    icon="lock-closed-outline" 
    onPress={() => setShowPasswordModal(true)}
    styles={styles}
    theme={runtimeTheme} // Pass theme here
  />
</View>

<TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
  <Ionicons 
    name="log-out-outline" 
    size={20} 
    color={runtimeTheme?.colors?.error || '#FF3B30'} 
  />
  <Text style={styles.logoutBtnText}>Logout</Text>
</TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* 1. Edit Profile Name Modal (Included for completeness) */}
      <ConfirmModal
        visible={showEditModal}
        title="Edit Profile Name"
        confirmText="Save Changes"
        onConfirm={handleUpdateName}
        confirmLoading={savingName}
        onCancel={() => setShowEditModal(false)}
      >
        <TextInput 
          style={styles.input} 
          placeholder="First Name" 
          value={firstNameInput} 
          onChangeText={setFirstNameInput} 
          placeholderTextColor={runtimeTheme.colors.muted} 
        />
        <TextInput 
          style={[styles.input, { marginTop: 10 }]} 
          placeholder="Last Name" 
          value={lastNameInput} 
          onChangeText={setLastNameInput} 
          placeholderTextColor={runtimeTheme.colors.muted} 
        />
      </ConfirmModal>

      {/* 2. Change Password Modal */}
      <ConfirmModal
        visible={showPasswordModal}
        title="Change Password"
        confirmText="Update"
        onConfirm={handleChangePassword}
        confirmLoading={changingPassword}
        onCancel={() => {
          setShowPasswordModal(false);
          setCurrentPassword('');
          setNewPassword('');
        }}
      >
        <Text style={[styles.label, { marginBottom: 8 }]}>Secure your account with a new password.</Text>
        <TextInput 
          style={styles.input} 
          placeholder="Current Password" 
          secureTextEntry 
          value={currentPassword} 
          onChangeText={setCurrentPassword} 
          placeholderTextColor={runtimeTheme.colors.muted} 
        />
        <TextInput 
          style={[styles.input, { marginTop: 10 }]} 
          placeholder="New Password" 
          secureTextEntry 
          value={newPassword} 
          onChangeText={setNewPassword} 
          placeholderTextColor={runtimeTheme.colors.muted} 
        />
      </ConfirmModal>

      {/* 3. Update Pay ID Modal */}
      <ConfirmModal
        visible={showPayIdModal}
        title={user?.payId ? "Update Pay ID" : "Set Your Pay ID"}
        confirmText="Save Pay ID"
        onConfirm={handleUpdatePayId}
        confirmLoading={savingPayId}
        onCancel={() => setShowPayIdModal(false)}
      >
        <View>
          <Text style={[styles.label, { marginBottom: 10 }]}>
            Enter a unique handle (e.g., @king_dex) for receiving internal transfers.
          </Text>
          <View style={styles.payIdInputContainer}>
             <TextInput 
              style={[styles.input, { color: runtimeTheme.colors.primary, fontWeight: '700' }]} 
              placeholder="@username" 
              value={payIdInput} 
              onChangeText={(text) => setPayIdInput(text.toLowerCase().replace(/\s/g, ''))} 
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor={runtimeTheme.colors.muted} 
            />
          </View>
        </View>
      </ConfirmModal>
    </>
  );
};

// Sub-components for cleaner render
const StatItem = ({ label, value, styles }: any) => (
  <View style={styles.statCard}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
  </View>
);



const ProfileSkeleton = ({ styles }: any) => (
  <View>
    <View style={styles.skelHeaderRow}>
      <View><SkeletonBox height={24} width={180} /><SkeletonBox height={16} width={100} style={{ marginTop: 8 }} /></View>
      <SkeletonBox height={64} width={64} radius={32} />
    </View>
    <View style={{ marginTop: 30 }}><SkeletonBox height={80} width="100%" radius={12} /></View>
    <View style={{ marginTop: 20 }}><SkeletonBox height={120} width="100%" radius={12} /></View>
  </View>
);

const createStyles = (t: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.colors.background },
  content: { padding: 20, paddingBottom: 60 },
  headerCard: { 
    backgroundColor: t.colors.surface, padding: 20, borderRadius: 16, 
    flexDirection: 'row', alignItems: 'center', marginBottom: 20,
    borderWidth: 1, borderColor: t.colors.border 
  },
  fullName: { color: t.colors.text, fontWeight: '900', fontSize: 22, letterSpacing: -0.5 },
  username: { color: t.colors.primary, fontWeight: '700', fontSize: 14, marginTop: 2 },
  email: { color: t.colors.muted, fontSize: 13, marginTop: 4 },
  initialsCircle: { 
    width: 60, height: 60, borderRadius: 30, 
    backgroundColor: t.colors.primary, justifyContent: 'center', alignItems: 'center', marginLeft: 15 
  },
  initialsText: { color: '#FFF', fontWeight: '900', fontSize: 22 },
  statsRowCard: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: { 
    backgroundColor: t.colors.surface, flex: 1, padding: 12, 
    borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: t.colors.border 
  },
  statLabel: { color: t.colors.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  statValue: { color: t.colors.text, fontWeight: '800', fontSize: 14, marginTop: 4 },
  payIdCard: { 
    backgroundColor: t.colors.surface, padding: 16, borderRadius: 16, 
    marginBottom: 25, borderWidth: 1, borderColor: t.colors.border 
  },
  payIdInputContainer: {
    marginTop: 5,
    borderRadius: 12,
    overflow: 'hidden',
  },
  payIdContent: { flexDirection: 'row', alignItems: 'center' },
  payIdRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  payIdText: { color: t.colors.primary, fontWeight: '800', fontSize: 18, marginRight: 8 },
  label: { fontSize: 12, fontWeight: '700', color: t.colors.muted },
  value: { fontSize: 16, fontWeight: '700', color: t.colors.text, marginTop: 4 },
  editBtn: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 10, backgroundColor: t.colors.primary + '15' },
  editBtnText: { color: t.colors.primary, fontWeight: '800', fontSize: 12, marginLeft: 4 },
  section: { marginBottom: 25 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: t.colors.muted, marginBottom: 15, textTransform: 'uppercase' },
  preferenceRow: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    backgroundColor: t.colors.surface, padding: 12, borderRadius: 12, marginBottom: 10 
  },
  prefText: { color: t.colors.text, fontWeight: '600' },
  themeToggle: { flexDirection: 'row', backgroundColor: t.colors.background, padding: 4, borderRadius: 10 },
  themeBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8 },
  themeBtnActive: { backgroundColor: t.colors.primary },
  themeBtnText: { fontSize: 12, fontWeight: '700', color: t.colors.muted },
  actionsGrid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  primaryAction: { 
    flex: 1, backgroundColor: t.colors.surface, padding: 15, borderRadius: 16, 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: t.colors.primary 
  },
  primaryActionText: { color: t.colors.primary, fontWeight: '800' },
  logoutBtn: { 
  flexDirection: 'row', 
  alignItems: 'center', 
  justifyContent: 'center', 
  gap: 8, 
  marginTop: 20, // Give it some breathing room from the content above
  paddingVertical: 10,
},
logoutBtnText: {
  color: t?.colors?.error || '#FF3B30', 
  fontSize: 16,
  fontWeight: '600',
},
  input: { 
    backgroundColor: t.colors.background, borderWidth: 1, borderColor: t.colors.border, 
    borderRadius: 12, padding: 15, color: t.colors.text, fontWeight: '600' 
  },
  skelHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }
});

export default ProfileScreenV2;