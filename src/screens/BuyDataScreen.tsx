import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import Constants from 'expo-constants';
import authStorage from '../utils/authStorage';

const extra = Constants.expoConfig?.extra as { apiUrl?: string } || {};
const API_URL = (extra.apiUrl || '').replace(/\/+$/, '');

const BuyDataScreen: React.FC = () => {
  const [bundles, setBundles] = useState<any[]>([]);
  const [phone, setPhone] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const token = await authStorage.getToken();
        const res = await fetch(`${API_URL}/api/data/bundles`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const j = await res.json();
          if (j.ok) setBundles(j.bundles || []);
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  const purchase = async (bundleId: string) => {
    try {
      if (!phone) return Alert.alert('Enter phone number');
      const token = await authStorage.getToken();
      const res = await fetch(`${API_URL}/api/data/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ bundleId, phone }),
      });
      const j = await res.json();
      if (j.ok) Alert.alert('Purchase started', JSON.stringify(j.purchase || j));
      else Alert.alert('Purchase error', j.error || 'unknown');
    } catch (e) {
      Alert.alert('Network error');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Buy Data</Text>
      <TextInput placeholder="Phone (e.g. +234801...)" value={phone} onChangeText={setPhone} style={styles.input} keyboardType="phone-pad" />
      <FlatList data={bundles} keyExtractor={(i) => i._id} renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>{item.network} • {item.country} • {item.price} {item.currency}</Text>
          </View>
          <TouchableOpacity style={styles.cta} onPress={() => purchase(item._id)}>
            <Text style={{ color: '#fff' }}>Buy</Text>
          </TouchableOpacity>
        </View>
      )} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 8, borderRadius: 6, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  name: { fontWeight: '700' },
  meta: { color: '#666', fontSize: 12 },
  cta: { backgroundColor: '#1DBF73', padding: 8, borderRadius: 6 },
});

export default BuyDataScreen;
