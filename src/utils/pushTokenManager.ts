import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../api/client';
import * as Device from 'expo-device';

// Allow runtime/dev flag to disable push registration entirely from the client.
const PUSH_REGISTRATION_DISABLED = ((typeof globalThis !== 'undefined') && (globalThis as any).__DISABLE_PUSH_REGISTRATION__ === true) ||
  (typeof process !== 'undefined' && process.env && process.env.DISABLE_PUSH_REGISTRATION === '1');

// Simple UUIDv4 generator (no extra dep)
function generateUUID() {
  // from https://stackoverflow.com/a/2117523
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Save (register) the Expo push token for the authenticated user.
 * If expoToken is omitted, it will call getFcmToken() to obtain one.
 * Returns the token string on success, null on no-token, and throws on network error.
 */
export async function savePushToken(authToken: string | null, fcmToken?: string | null): Promise<string | null> {
  // Prevent duplicate concurrent save attempts from causing multiple network
  // requests (React StrictMode or duplicate mounts can trigger this). We keep
  // a single in-flight promise and return it to callers while it's running.
  if ((savePushToken as any)._inFlight) {
    return (savePushToken as any)._inFlight as Promise<string | null>;
  }
  const inFlightWrapper = (async () => {
  if (!authToken) return null;
  if (PUSH_REGISTRATION_DISABLED) return null;

  console.log('[pushTokenManager] savePushToken called', { hasAuth: !!authToken, authPreview: authToken ? String(authToken).slice(0,12) + '...' : null, callerProvided: !!fcmToken });

  try {
    let tokenToSave: string | null = fcmToken || null;
    if (!tokenToSave) {
      try {
        const { getMessaging, getToken } = await import('@react-native-firebase/messaging');
        const { getApp } = await import('@react-native-firebase/app');
        const app = getApp();
        const messagingInstance = getMessaging(app);
        tokenToSave = await getToken(messagingInstance);
      } catch (e) {
        console.warn('[pushTokenManager] failed to get token from firebase messaging', String(e));
      }
    }

    if (!tokenToSave) {
      try { await AsyncStorage.removeItem('expoPushToken'); } catch (_) {}
      console.log('[pushTokenManager] no token to save');
      return null;
    }

    try { await AsyncStorage.setItem('expoPushToken', tokenToSave); } catch (e) { /* ignore */ }
    console.log('[pushTokenManager] obtained token to save (preview):', String(tokenToSave).slice(0,24) + '...');

    const deviceId = (Device && (Device.modelName || (Device as any).deviceName || (Device as any).osBuildId || 'unknown')) || 'unknown';
    const platform = (Device && ((Device as any).osName || (Device as any).osVersion || 'unknown')) || 'unknown';

    const payload = { fcmToken: tokenToSave, deviceId, platform };
    console.log('[pushTokenManager] POST /api/user/save-fcm-token payload preview', { fcmTokenPreview: String(tokenToSave).slice(0,24) + '...', deviceId, platform });

  // Note: backend exposes this endpoint under /api/auth/save-fcm-token
  // (authRoutes are mounted at /api/auth). Use that path so requests hit
  // the authenticated route that saves tokens for the calling user.
  const resp = await client.post('/api/auth/save-fcm-token', payload);
    console.log('[pushTokenManager] backend save response', { status: resp?.status, dataPreview: JSON.stringify(resp?.data).slice(0,200) });
    return tokenToSave;
  } catch (err) {
    try {
      const a: any = err;
      if (a?.isAxiosError && a.response) {
        console.error('[pushTokenManager] savePushToken error: status=', a.response.status, 'data=', a.response.data);
      } else {
        console.error('[pushTokenManager] savePushToken error', err);
      }
    } catch (logErr) {
      console.error('[pushTokenManager] savePushToken unexpected error', err);
    }
    return null;
  }
  })();
  // store the promise so concurrent callers reuse it
  (savePushToken as any)._inFlight = inFlightWrapper;
  try {
    const res = await inFlightWrapper;
    return res;
  } finally {
    // clear the in-flight marker after completion
    (savePushToken as any)._inFlight = null;
  }
}
export function unregisterPushToken(auth: string | null) {
  throw new Error('Function not implemented.');
}

