import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';


async function registerForPushNotificationsAsync() {
  // Push registration has been removed per request — do not generate tokens on the client.
  return null;
}

export async function getFcmToken(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Must use physical device for Push Notifications');
    return null;
  }

  try {
    // Register for push notifications and get the token
    const expoPushToken = await registerForPushNotificationsAsync();
    return expoPushToken || null;

    // If you need the FCM token, you could use expo-firebase-messaging
    // import messaging from 'expo-firebase-messaging';
    // const fcmToken = await messaging().getToken();
    // console.log('FCM Token:', fcmToken);
    // return fcmToken || null;

  } catch (error) {
    console.error('[FCM] Error getting token:', error);
    return null;
  }
}

// To handle incoming messages in the foreground:
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// To handle when a notification is received while the app is in the foreground:
export function useForegroundNotification() {
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('Foreground Notification Received:', notification);
      // Handle the notification data here
    });
    return () => subscription.remove();
  }, []);
}

// To handle when a user taps on a notification (foreground or background/quit):
export function useNotificationResponse() {
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification Response:', response);
      // Handle the notification tap here
      // You might want to navigate the user to a specific screen
    });
    return () => subscription.remove();
  }, []);
}
