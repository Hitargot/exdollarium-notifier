// index.ts (or your main entry point)

import { AppRegistry } from 'react-native';
import App from './App';
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

// Configure FCM background message handler.
// @react-native-firebase/messaging is a native module — it must be required
// synchronously. Dynamic import() does not work with it and causes
// "Cannot read property 'call' of undefined".
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const messagingModule: any = require('@react-native-firebase/messaging');
  // v23 modular API: default export is the messaging() factory
  const messaging: any =
    typeof messagingModule.default === 'function'
      ? messagingModule.default()
      : typeof messagingModule === 'function'
      ? messagingModule()
      : messagingModule.default || messagingModule;

  if (messaging && typeof messaging.setBackgroundMessageHandler === 'function') {
    messaging.setBackgroundMessageHandler(async (remoteMessage: any) => {
      console.log('[index.ts] Background FCM message', remoteMessage);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: remoteMessage.notification?.title || 'New message',
          body: remoteMessage.notification?.body || 'You have a new notification.',
          data: remoteMessage.data,
        } as any,
        trigger: null,
      });
    });
    console.log('[index.ts] FCM background handler registered');
  } else {
    console.warn('[index.ts] messaging.setBackgroundMessageHandler not available');
  }
} catch (err) {
  console.warn('[index.ts] Failed to register FCM background handler:', String(err));
}

// Replace 'your_app_name_here' or use appName if you have it
AppRegistry.registerComponent('main', () => App);