import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import authStorage from './authStorage';
import authLock from './authLock';
import simpleCache from './simpleCache';
import transactionCache from './transactionCache';

/**
 * Clear local device data when the user explicitly logs out or switches account.
 * This performs best-effort removal of tokens, AsyncStorage keys, in-memory
 * caches and files downloaded into the cache directory.
 */
export default async function clearLocalData(): Promise<void> {
  try {
    // Remove credentials from secure/legacy storage
    try { await authStorage.removeToken(); } catch (_) {}

    // Remove any passcode / lock state
    try { await authLock.clearPasscode(); } catch (_) {}

    // Clear app AsyncStorage (best-effort). This removes all keys.
    try { await AsyncStorage.clear(); } catch (_) {}

    // Clear tiny in-memory caches used by the app
    try { simpleCache.clear('transactions'); } catch (_) {}
    try { transactionCache.clearTransactionCache(); } catch (_) {}

    // Remove files from the cache directory (best-effort). Do not fail if FS
    // is not available or operation is denied.
    try {
      const cacheDir = (FileSystem as any).cacheDirectory;
      if (cacheDir) {
        const list = await FileSystem.readDirectoryAsync(cacheDir).catch(() => []);
        for (const f of list || []) {
          try { await FileSystem.deleteAsync(`${cacheDir}${f}`, { idempotent: true }); } catch (_) {}
        }
      }
    } catch (_) {}

  } catch (e) {
    // swallow errors, this should be best-effort and not crash the app
    return;
  }
}
