import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import authLock from '../utils/authLock';

export default function DevAuthDebugScreen() {
  const [passHash, setPassHash] = useState<string | null>(null);
  const [lastAuth, setLastAuth] = useState<number | null>(null);
  const [lastLogin, setLastLogin] = useState<number | null>(null);

  const refresh = async () => {
    const h = await authLock.getPasscodeHash();
    const a = await authLock.getLastAuth();
    const l = await authLock.getLastLogin();
    setPassHash(h ?? null);
    setLastAuth(a ?? null);
    setLastLogin(l ?? null);
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dev: Auth Lock Debug</Text>

      <Text style={styles.label}>Passcode Hash:</Text>
      <Text selectable style={styles.value}>{passHash ?? '(not set)'}</Text>

      <Text style={styles.label}>Last Auth (passcode unlock):</Text>
      <Text style={styles.value}>{lastAuth ? new Date(lastAuth).toLocaleString() : '(not set)'}</Text>

      <Text style={styles.label}>Last Login (credential):</Text>
      <Text style={styles.value}>{lastLogin ? new Date(lastLogin).toLocaleString() : '(not set)'}</Text>

      <View style={{ height: 12 }} />
      <Button title="Refresh" onPress={refresh} />
      <View style={{ height: 8 }} />
      <Button title="Clear Passcode" onPress={async () => { await authLock.clearPasscode(); Alert.alert('Cleared'); refresh(); }} />
      <View style={{ height: 8 }} />
      <Button title="Clear LastAuth" onPress={async () => { await authLock.clearLastAuth(); Alert.alert('Cleared lastAuth'); refresh(); }} />
      <View style={{ height: 8 }} />
      <Button title="Clear LastLogin" onPress={async () => { await authLock.clearLastLogin(); Alert.alert('Cleared lastLogin'); refresh(); }} />
      <View style={{ height: 8 }} />
      <Button title="Set LastLogin to 8 days ago" onPress={async () => {
        const ts = Date.now() - (8 * 24 * 60 * 60 * 1000);
        await authLock.setLastLogin(ts);
        Alert.alert('Set');
        refresh();
      }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  label: { marginTop: 8, color: '#444', fontWeight: '600' },
  value: { color: '#222', marginBottom: 6 },
});
