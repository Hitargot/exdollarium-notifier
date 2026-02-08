// index.ts (or your main entry point)

import { AppRegistry } from 'react-native';
import App from './App';
import theme from './src/styles/theme';
// Use the modular background handler export to avoid namespaced/deprecated API
// Defer loading the messaging background handler to runtime and support both
// the legacy namespaced API and the newer modular export. Some installed
// versions of @react-native-firebase/messaging may not export
// `setBackgroundMessageHandler` directly, so we use a defensive dynamic
// import and feature-detect the available API.
import * as Notifications from 'expo-notifications';
import { initializeApp, getApps, getApp } from '@react-native-firebase/app'; // Import getApp

// 🔥 Your Firebase config (same as in App.tsx)
const firebaseConfig = {
  apiKey: "AIzaSyAzsQ7kIfIGIeihqg5teN8mIz8hNlAk7mg",
  authDomain: "exdollarium-3d474.firebaseapp.com",
  databaseURL: "https://exdollarium-3d474-default-rtdb.firebaseio.com",
  projectId: "exdollarium-3d474",
  storageBucket: "exdollarium-3d474.appspot.com",
  messagingSenderId: "748549990165",
  appId: "1:748549990165:web:605ca9255078ea58f2eb1c",
  measurementId: "G-T9QL24JR8M"
};

// Initialize Firebase if not already done
if (getApps().length === 0) {
  initializeApp(firebaseConfig);
  console.log('[index.ts] Firebase initialized for background handler');
}

// Configure background message handler using a dynamic, feature-detected
// approach so this file works across multiple rn-firebase versions.
(async function setupBackgroundHandler() {
  try {
    const messagingModule: any = await import('@react-native-firebase/messaging');

    // If the module exposes a top-level setBackgroundMessageHandler (modular API)
    if (typeof messagingModule.setBackgroundMessageHandler === 'function') {
      messagingModule.setBackgroundMessageHandler(async (remoteMessage: any) => {
        console.log('Message handled in the background!', remoteMessage);
        Notifications.scheduleNotificationAsync({
          content: ({
            title: remoteMessage.notification?.title || 'Background Message',
            body: remoteMessage.notification?.body || 'Check the app.',
            data: remoteMessage.data,
            android: { channelId: 'silent', smallIcon: 'notification_icon', color: (theme && theme.colors && theme.colors.primary) || '#162660' },
          } as any),
          trigger: null,
        });
      });
      return;
    }

    // Otherwise, the module may be the legacy default export (a factory function)
    // which returns a messaging instance. Call it and check for setBackgroundMessageHandler.
    const maybeFactory = messagingModule.default || messagingModule;
    let messagingInstance: any = null;
    if (typeof maybeFactory === 'function') {
      try {
        messagingInstance = maybeFactory();
      } catch (e) {
        // Some environments require calling without parentheses; try property access below
        messagingInstance = maybeFactory;
      }
    } else {
      messagingInstance = maybeFactory;
    }

    if (messagingInstance && typeof messagingInstance.setBackgroundMessageHandler === 'function') {
      messagingInstance.setBackgroundMessageHandler(async (remoteMessage: any) => {
        console.log('Message handled in the background!', remoteMessage);
        Notifications.scheduleNotificationAsync({
          content: ({
            title: remoteMessage.notification?.title || 'Background Message',
            body: remoteMessage.notification?.body || 'Check the app.',
            data: remoteMessage.data,
            android: { channelId: 'silent', smallIcon: 'notification_icon', color: (theme && theme.colors && theme.colors.primary) || '#162660' },
          } as any),
          trigger: null,
        });
      });
      return;
    }

    console.warn('[index.ts] Unable to register FCM background handler: API not found on messaging module');
  } catch (err) {
    console.warn('[index.ts] Failed to load @react-native-firebase/messaging for background handler', String(err));
  }
})();

// Replace 'your_app_name_here' or use appName if you have it
AppRegistry.registerComponent('main', () => App);