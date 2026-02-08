import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

let SecureStore: any = null;
try {
  // optional secure store - available in Expo managed apps
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SecureStore = require('expo-secure-store');
} catch (e) {
  SecureStore = null;
}

const PASSCODE_KEY = 'app_passcode_hash';
const LAST_AUTH_KEY = 'last_auth_timestamp';
const LAST_LOGIN_KEY = 'last_login_timestamp';

async function saveToSecure(key: string, value: string) {
  if (SecureStore && SecureStore.setItemAsync) {
    await SecureStore.setItemAsync(key, value);
  } else {
    await AsyncStorage.setItem(key, value);
  }
}

async function getFromSecure(key: string) {
  if (SecureStore && SecureStore.getItemAsync) {
    return await SecureStore.getItemAsync(key);
  } else {
    return await AsyncStorage.getItem(key);
  }
}

export async function setPasscode(pin: string) {
  const normalized = String(pin || '').trim();
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, normalized);
  await saveToSecure(PASSCODE_KEY, hash);
  return hash;
}

export async function getPasscodeHash() {
  try {
    return await getFromSecure(PASSCODE_KEY);
  } catch (e) {
    return null;
  }
}

export async function verifyPasscode(pin: string) {
  const stored = await getPasscodeHash();
  if (!stored) return false;
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, String(pin || '').trim());
  return stored === hash;
}

export async function clearPasscode() {
  if (SecureStore && SecureStore.deleteItemAsync) {
    await SecureStore.deleteItemAsync(PASSCODE_KEY);
  } else {
    await AsyncStorage.removeItem(PASSCODE_KEY);
  }
}

export async function setLastAuth(ts?: number) {
  const t = ts ?? Date.now();
  // store last-auth timestamp in SecureStore when available, otherwise AsyncStorage
  await saveToSecure(LAST_AUTH_KEY, String(t));
}

export async function getLastAuth(): Promise<number | null> {
  try {
    const v = await getFromSecure(LAST_AUTH_KEY);
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch (e) {
    return null;
  }
}

export async function clearLastAuth() {
  if (SecureStore && SecureStore.deleteItemAsync) {
    await SecureStore.deleteItemAsync(LAST_AUTH_KEY);
  } else {
    await AsyncStorage.removeItem(LAST_AUTH_KEY);
  }
}

// Track the time the user last completed a full login (username/password).
// We use this to gate whether the app should allow quick passcode unlocks
// — the login session itself expires after a configurable window (7 days).
export async function setLastLogin(ts?: number) {
  const t = ts ?? Date.now();
  await saveToSecure(LAST_LOGIN_KEY, String(t));
}

export async function getLastLogin(): Promise<number | null> {
  try {
    const v = await getFromSecure(LAST_LOGIN_KEY);
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch (e) {
    return null;
  }
}

export async function clearLastLogin() {
  if (SecureStore && SecureStore.deleteItemAsync) {
    await SecureStore.deleteItemAsync(LAST_LOGIN_KEY);
  } else {
    await AsyncStorage.removeItem(LAST_LOGIN_KEY);
  }
}

export default {
  setPasscode,
  getPasscodeHash,
  verifyPasscode,
  clearPasscode,
  setLastAuth,
  getLastAuth,
  clearLastAuth,
  setLastLogin,
  getLastLogin,
  clearLastLogin,
};

