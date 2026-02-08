import axios from 'axios';
import client from './client';
import { Alert } from 'react-native';
import { getMessaging, getToken } from '@react-native-firebase/messaging';
import { getApp } from '@react-native-firebase/app';  // Firebase initialization
import Constants from 'expo-constants';

// Define the shape of the extra
type Extra = {
  apiUrl: string;
  env: string;
};

// Safely access it
const extra = Constants.expoConfig?.extra as Extra;
export const API_URL = extra.apiUrl;


export async function loginUser(identifier: string, password: string) {
  let fcmToken: string | null = null;

  try {
    const app = getApp();
    const messagingInstance = getMessaging(app);
    fcmToken = await getToken(messagingInstance);
    // Retrieved FCM token (debug info)
    // Debug: log token in dev builds only to avoid leaking tokens in production
    try {
      const isDev = (typeof __DEV__ !== 'undefined') ? (__DEV__ as boolean) : false;
      if (isDev) console.log('[auth] retrieved FCM token (login path)', fcmToken);
    } catch (e) { /* ignore logging errors */ }
  } catch (error: any) {
    // Failed to retrieve FCM token — non-fatal and intentionally not logged as an error
    // to avoid noisy console output in production environments.
  }

  let token = '';
  let referralCode = ''; // ✅ Declare it here
  // let user = null; // Not needed anymore if you're only using referralCode

  try {
    const loginRes = await client.post(`/api/auth/login`, {
      identifier,
      password,
      fcmToken,
    });

    try {
      const isDev = (typeof __DEV__ !== 'undefined') ? (__DEV__ as boolean) : false;
      if (isDev) console.log('[auth] login successful (dev only):', loginRes.data);
    } catch (e) { /* ignore logging errors */ }

    token = loginRes.data?.token;
    referralCode = loginRes.data?.referralCode;

    if (!token || !referralCode) {
      throw { message: 'Invalid response: token or referralCode missing', info: loginRes.data };
    }

  } catch (error: any) {
    const errorInfo = error?.response?.data || { message: error.message };
    // Map common network error to a friendlier message for the toast
    const rawMessage = (errorInfo && errorInfo.message) ? errorInfo.message : 'Login failed';
    const message = rawMessage === 'Network Error'
      ? 'Network Error: unable to reach server. Check your internet connection or server address.'
      : rawMessage;
    throw new Error(message);
  }

  // Return the fcmToken we retrieved so callers can explicitly persist it
  // after the auth token is stored (this avoids race conditions with the
  // HTTP interceptor that reads the persisted auth token to attach the
  // Authorization header for subsequent requests).
  if (!fcmToken) console.warn('No FCM token provided.');

  // ✅ Now referralCode is defined in scope
  return { token, user: { referralCode }, fcmToken };
}
