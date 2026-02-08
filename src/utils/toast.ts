import { Platform, ToastAndroid, Alert } from 'react-native';
import { showInAppToast } from '../contexts/ToastContext';

/**
 * Cross-platform toast helper.
 * - Android: uses ToastAndroid.show
 * - iOS / others: falls back to Alert.alert with a short message
 */
export function showToast(message: string) {
  try {
    // Debug: indicate the toast helper was invoked (DEV only)
    if (__DEV__) {
      try { console.debug('[toast] showToast called:', { message, platform: Platform.OS }); } catch (e) { }
    }
    if (Platform.OS === 'android' && ToastAndroid && ToastAndroid.show) {
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return;
    }

    // Prefer the in-app toast provider when available (iOS and other platforms)
    let handled = false;
    try {
      handled = showInAppToast(message);
      if (__DEV__) { try { console.debug('[toast] showInAppToast handled:', handled); } catch (e) { } }
    } catch (e) {
      if (__DEV__) { try { console.warn('[toast] showInAppToast threw error', e); } catch (__) { } }
      handled = false;
    }
    if (handled) return;

    // Fallback to Alert so message is visible even if provider isn't mounted
    Alert.alert('', message);
  } catch (e) {
    // Last-resort fallback
    try {
      Alert.alert('', message);
    } catch (__) {
      // no-op
    }
  }
}

export default showToast;
