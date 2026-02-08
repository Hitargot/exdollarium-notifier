import AsyncStorage from '@react-native-async-storage/async-storage';

const LEGACY_KEY = 'userToken';
const SECURE_KEY = 'userTokenSecure';

async function trySecureStore() {
  try {
    // dynamic import so the app still works if expo-secure-store isn't installed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const SecureStore = await import('expo-secure-store');
    if (SecureStore && typeof SecureStore.getItemAsync === 'function') return SecureStore;
  } catch (e) {
    return null;
  }
  return null;
}

export async function getToken(): Promise<string | null> {
  const SecureStore = await trySecureStore();
  if (SecureStore) {
    try {
      const v = await SecureStore.getItemAsync(SECURE_KEY);
      if (v) return v;
    } catch (e) {
      // fall through to legacy AsyncStorage
    }
  }
  try {
    return await AsyncStorage.getItem(LEGACY_KEY);
  } catch (e) {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  const SecureStore = await trySecureStore();
  if (SecureStore) {
    try {
      await SecureStore.setItemAsync(SECURE_KEY, token);
      // also remove legacy key to avoid duplication
      try { await AsyncStorage.removeItem(LEGACY_KEY); } catch (_) {}
      return;
    } catch (e) {
      // fall back to legacy
    }
  }
  await AsyncStorage.setItem(LEGACY_KEY, token);
}

export async function removeToken(): Promise<void> {
  const SecureStore = await trySecureStore();
  if (SecureStore) {
    try { await SecureStore.deleteItemAsync(SECURE_KEY); } catch (_) {}
  }
  try { await AsyncStorage.removeItem(LEGACY_KEY); } catch (_) {}
}

export async function migrateFromAsyncStorage(): Promise<void> {
  const SecureStore = await trySecureStore();
  if (!SecureStore) return;
  try {
    const legacy = await AsyncStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const existing = await SecureStore.getItemAsync(SECURE_KEY);
      if (!existing) {
        await SecureStore.setItemAsync(SECURE_KEY, legacy);
      }
      await AsyncStorage.removeItem(LEGACY_KEY);
    }
  } catch (e) {
    // noop
  }
}

export default {
  getToken,
  setToken,
  removeToken,
  migrateFromAsyncStorage,
};
