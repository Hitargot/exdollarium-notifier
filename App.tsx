import React, { useEffect, useRef } from 'react';
import ErrorBoundary from './src/components/ErrorBoundary';
import OfflineBanner from './src/components/OfflineBanner';
import * as Notifications from 'expo-notifications';  // Expo Notifications
import Constants from 'expo-constants';
// NOTE: react-native-firebase modules are loaded dynamically inside setup()
// to avoid startup crashes when native modules are not available (Expo Go /
// dev clients missing the native module). Do not import them at top-level.
/* Dynamically require react-navigation at runtime to avoid TypeScript module resolution
   errors in environments where the package/types are not installed. */
let NavigationContainer: any;
let createNavigationContainerRef: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  // @ts-ignore
  const nav = require('@react-navigation/native');
  NavigationContainer = nav.NavigationContainer || nav.default?.NavigationContainer || nav.default || nav;
  createNavigationContainerRef = nav.createNavigationContainerRef || (() => ({ current: null }));
} catch (e) {
  // Fallback stub for environments without react-navigation (keeps app runnable)
  NavigationContainer = ({ children }: any) => (children || null);
  createNavigationContainerRef = () => ({ current: null });
}
import { getTransactionReceipt, getConfirmationReceipt } from './src/api/client';
import { markNotificationRead } from './src/api/client';
import { sanitizeReceipt } from './src/utils/receiptSanitizer';
import { normalizeTransactionRef, isMinimalTransaction } from './src/utils/receiptHelpers';
import { buildTransactionReceipt, buildConfirmationReceipt } from './src/utils/receiptBuilders';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LogBox, View, StyleSheet, AppState, Platform, Animated, Easing, Image, Appearance } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import theme from './src/styles/theme';
import { RootStackParamList } from './src/screens/types';
// theme temporarily disabled — will re-enable later
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/theme/index';
import InnerApp from './InnerApp';
import authStorage from './src/utils/authStorage';
import { PreferencesProvider } from './src/contexts/PreferencesContext';
import 'react-native-get-random-values';


LogBox.ignoreLogs([
  'Support for defaultProps will be removed',
  // Some libraries (country picker / flag renderers) log a more specific variant including the component name.
  // Add the more specific fragment to ensure the message is suppressed during development.
  'Flag: Support for defaultProps will be removed',
]);

// Early startup marker to confirm JS bundle execution on device
try {
  // eslint-disable-next-line no-console
  console.log('[App] JS bundle loaded — starting initialization');
} catch (e) { }

// Prevent the native splash from auto-hiding until JS signals readiness.
// Call on module load so it runs before the component mounts.
try {
  // ignore failures (e.g., non-expo runtimes)
  SplashScreen.preventAutoHideAsync().catch(() => {});
} catch (e) { /* ignore */ }

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  // make the animated logo larger so the entrance feels impactful
  logo: { width: 220, height: 220, resizeMode: 'contain' },
});

// Simple animated logo used during the initial route resolution phase
function AnimatedLogo() {
  // Animated large logo with transparent background. The logo scales from
  // front-to-back (simulated by a zoom-out) and holds for a short delay so
  // the user sees a pleasant branded animation before the app content.
  const initialScale = 1.9; // start very large (in front)
  const scale = React.useRef(new Animated.Value(initialScale)).current;

  React.useEffect(() => {
    // Entrance: small delay then zoom out to normal size.
    Animated.sequence([
      Animated.delay(300),
      Animated.timing(scale, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [scale]);

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
      <Animated.Image source={require('./assets/photo_2026-01-20_04-34-08-removebg-preview.png')} style={[styles.logo, { transform: [{ scale }] }]} />
    </View>
  );
}

const Stack = createNativeStackNavigator<RootStackParamList>(); // ✅ typed navigator
// create navigation ref for navigating outside components (e.g., notification handlers)
export const navigationRef = createNavigationContainerRef();

// Helper to navigate via the shared navigationRef, or queue the desired
// navigation target if the navigator hasn't mounted yet. The queued value
// will be consumed by the mounted navigator (InnerApp) once ready.
function navigateOrQueue(name: string, params?: any) {
  try {
    if (navigationRef && navigationRef.current && typeof navigationRef.current.navigate === 'function') {
      navigationRef.current.navigate(name as any, params as any);
    } else {
      try { (globalThis as any).__APP_PENDING_NOTIFICATION_NAV__ = { name, params }; } catch (e) {}
    }
  } catch (e) {
    // swallow
  }
}

// 🔥 Your Firebase config (if not already initialized)
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

// Fallback for Android importance constant — some runtimes may not expose this
const ANDROID_IMPORTANCE_MAX = (Notifications as any)?.AndroidImportance?.MAX ?? 4;


Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,   // show popup banner in foreground
    shouldShowList: true,     // add to notification center/shade
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});


export default function App() {
  const [initialRoute, setInitialRoute] = React.useState<keyof RootStackParamList | undefined>(undefined);
  // Control visibility of the initial full-screen splash. Kept at top-level so
  // hooks order remains stable across renders (avoid calling hooks inside
  // conditional blocks which breaks the Rules of Hooks).
  const [splashVisible, setSplashVisible] = React.useState(true);
  // Ensure we only decide the initial route once even if effects run twice
  // (dev-mode StrictMode / HMR can sometimes replay effects). This prevents
  // duplicate navigation decisions causing double-mounts.
  const initialRouteDecidedRef = React.useRef(false);

  // Overlay opacity used to smoothly cross-fade the branded splash away while
  // the navigator and theme are already mounted underneath. This prevents a
  // visible double-mount / blink when the passcode gate mounts during startup.
  const overlayOpacity = React.useRef(new Animated.Value(1)).current;
  const [overlayVisible, setOverlayVisible] = React.useState<boolean>(true);
  

  // Expose a simple global readiness flag so screens can delay showing
  // their real UI until the app overlay has been fully dismissed. This
  // helps prevent visual flashes even if a screen is remounted in dev-mode.
  try { (globalThis as any).__APP_READY__ = (globalThis as any).__APP_READY__ || false; } catch (e) { /* ignore */ }

  React.useEffect(() => {
    if (splashVisible) {
      // make sure overlay is shown immediately when splashVisible toggles on
      overlayOpacity.setValue(1);
      setOverlayVisible(true);
      return;
    }

    // Fade the overlay out when the splash is dismissed so the app underneath
    // can be revealed with a gentle cross-fade instead of a sharp cut.
    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setOverlayVisible(false);
      // Now the JS overlay has finished fading — hide the native splash.
      try {
        SplashScreen.hideAsync().catch(() => {});
      } catch (e) { /* ignore */ }
    });
    // Mark the app as ready once overlay fade completes (allow small delay for safety)
    const markReady = setTimeout(() => {
      try { (globalThis as any).__APP_READY__ = true; console.log('[App] __APP_READY__ = true'); } catch (e) {}
    }, 300);
    return () => clearTimeout(markReady);
  }, [splashVisible, overlayOpacity]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (initialRouteDecidedRef.current) return;
      // Wait until initialRoute is decided
      while (initialRoute === undefined) {
        // sleep briefly — this loop only runs during init
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 50));
        if (!mounted) return;
      }

      // If we're not routing to PasscodeUnlock, dismiss the splash immediately
      if (initialRoute !== 'PasscodeUnlock') {
        if (mounted) setSplashVisible(false);
        return;
      }

      // Otherwise wait for the passcode screen to signal readiness, or timeout
      try {
        const { awaitSplashDismiss } = await import('./src/utils/splashController');
        // Wait for the passcode screen to explicitly signal readiness. Use a
        // longer fallback timeout (10s) to avoid prematurely hiding the splash
        // on slow devices or when startup work is still completing. Log which
        // promise wins the race so we can debug ordering issues.
        const dismissPromise = awaitSplashDismiss().then(() => 'dismissed');
        const timeoutPromise = new Promise<string>((r) => setTimeout(() => r('timeout'), 10000));
        // eslint-disable-next-line no-await-in-loop
        const winner = await Promise.race([dismissPromise, timeoutPromise]);
        try { console.log('[App] awaitSplashDismiss race winner ->', winner); } catch (e) { }
      } catch (e) {
        // ignore
      }

      // Add a brief extra delay so the splash remains visible a little longer
      // after the passcode screen signals readiness. This smooths the transition
      // and makes the passcode reveal feel less abrupt.
      try {
  const extraDelayMs = 600; // tweakable — increased delay so the animated logo has time to finish
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, extraDelayMs));
      } catch (e) { /* ignore */ }

      if (mounted) {
        try { console.log('[App] hiding splash (mounted=', mounted, ')'); } catch (e) { }
        setSplashVisible(false);
      }
    })();
    return () => { mounted = false; };
  }, [initialRoute]);

  // Respect an app-level config to disable push registration from clients.
  try {
    const extra = (Constants.expoConfig && (Constants.expoConfig as any).extra) || {};
    const disable = extra.disablePushRegistration || (process.env && process.env.DISABLE_PUSH_REGISTRATION === '1');
    if (disable) {
      (globalThis as any).__DISABLE_PUSH_REGISTRATION__ = true;
      console.log('[App] Push registration disabled via config');
    }
  } catch (e) { /* ignore */ }
  useEffect(() => {
    let mounted = true;

   async function setup() {
  console.log('[App] Initializing notifications...');

  try {
    /* ---------------------------------- */
    /* Android notification channel (ONE) */
    /* ---------------------------------- */

    const ANDROID_IMPORTANCE_MAX =
      (Notifications as any)?.AndroidImportance?.MAX ?? 5;

    if (Platform.OS === 'android') {
      try {
        // Ensure both a legacy 'default' and a new high-importance channel exist.
        // Some devices persist old channel settings; creating a fresh channel
        // avoids silent delivery when the old channel had sound disabled.
        await Notifications.setNotificationChannelAsync('default', {
          name: 'App Notifications',
          importance: ANDROID_IMPORTANCE_MAX,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
          bypassDnd: false,
        } as any);

        await Notifications.setNotificationChannelAsync('default_high', {
          name: 'App Notifications (High Priority)',
          importance: ANDROID_IMPORTANCE_MAX,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
          bypassDnd: false,
        } as any);

        console.log('[App] Android notification channels ready');
      } catch (err) {
        console.warn('[App] Failed to create Android channels', err);
      }
    }

    /* ----------------------------- */
    /* Request notification permission */
    /* ----------------------------- */

    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[App] Notification permission not granted');
      }
    } catch (err) {
      console.warn('[App] Permission request failed', err);
    }

    /* ----------------------------------- */
    /* Lazy-load Firebase Messaging safely */
    /* ----------------------------------- */

    let messagingModule: any = null;
    let messagingInstance: any = null;

    try {
      const firebaseApp = await import('@react-native-firebase/app');
      const firebaseMessaging = await import('@react-native-firebase/messaging');

      try {
        firebaseApp.getApp();
      } catch {
        firebaseApp.initializeApp(firebaseConfig);
      }

      messagingModule = firebaseMessaging;

      messagingInstance =
        firebaseMessaging.getMessaging?.() ??
        (typeof firebaseMessaging.default === 'function'
          ? firebaseMessaging.default()
          : null);

      console.log('[App] Firebase messaging loaded');
    } catch (err: any) {
      console.warn(
        '[App] Firebase not available, skipping native handlers',
        err?.message ?? err
      );
    }

    /* ---------------------------- */
    /* Deduplication (server-based) */
    /* ---------------------------- */

    const recentMessageIds = new Set<string>();

    const markRecent = (id: string) => {
      recentMessageIds.add(id);
      setTimeout(() => recentMessageIds.delete(id), 60_000);
    };

    /* -------------------------------- */
    /* Foreground handler (ONE SOURCE) */
    /* -------------------------------- */

    if (
      messagingModule &&
      messagingInstance &&
      typeof messagingModule.onMessage === 'function'
    ) {
      messagingModule.onMessage(messagingInstance, async (remoteMessage: any) => {
        try {
          console.log(
            '[App][FCM] foreground message',
            JSON.stringify(remoteMessage)
          );

          const data = remoteMessage?.data ?? {};
          const messageId =
            remoteMessage?.messageId ??
            data?.messageId ??
            data?.message_id;

          if (messageId && recentMessageIds.has(messageId)) {
            console.log('[App] Duplicate message ignored:', messageId);
            return;
          }

          const title =
            remoteMessage?.notification?.title ?? 'Notification';
          const body =
            remoteMessage?.notification?.body ?? '';

          if (AppState.currentState === 'active') {
            const notificationId =
              await Notifications.scheduleNotificationAsync({
                content: {
                  title,
                  body,
                  data,
                  android: {
                    channelId: 'default',
                    importance: ANDROID_IMPORTANCE_MAX,
                  },
                } as any,
                trigger: null,
              });

            console.log(
              '[App] Foreground notification displayed:',
              notificationId
            );
          }

          if (messageId) markRecent(messageId);
        } catch (err) {
          console.warn('[App] onMessage handler error', err);
        }
      });

      console.log('[App] Firebase foreground handler registered');
    }

    /* -------------------------------- */
    /* Expo listeners (LOGGING + TAPS) */
    /* -------------------------------- */

    Notifications.addNotificationReceivedListener(notification => {
      try {
        console.log(
          '[App] Notification received',
          JSON.stringify(notification)
        );
      } catch {
        console.log('[App] Notification received (raw)', notification);
      }
    });

    Notifications.addNotificationResponseReceivedListener(async (response) => {
      try {
        console.log('[App] Notification tapped', JSON.stringify(response));
      } catch {
        console.log('[App] Notification tapped (raw)', response);
      }

      try {
        // Try to navigate to a receipt when the notification contains a transaction or resource id
        const data: any = response?.notification?.request?.content?.data || {};

        // Helpers to find an id in common payload fields
        const rawId = data.transactionId || data.transactionRef || data.resourceId || data.id || data._id || null;
        const parsedFromMessage = normalizeTransactionRef(
          (data.message || data.title || data.body || '') as string
        );
        const id = rawId || parsedFromMessage || null;

        // If this notification explicitly refers to a confirmation resource, try confirmation receipt
        if (data.resourceType === 'confirmation' || (data.type && String(data.type).toLowerCase().includes('confirmation'))) {
          const confId = id;
          if (confId) {
            const confResp = await getConfirmationReceipt(confId).catch(() => null);
              if (confResp) {
              const receiptData = buildConfirmationReceipt(confResp);
              const sanitized = sanitizeReceipt(receiptData);
              try { navigateOrQueue('Receipt', { receiptData: sanitized }); } catch (e) { }
              // mark notification read on server when possible
              const notifyId = data.notificationId || data._id || data.id || null;
              if (notifyId) {
                try { await markNotificationRead(String(notifyId)); } catch (_) { }
              }
              return;
            }
          }
        }

        // Try transaction receipt
        if (id) {
          const trxResp = await getTransactionReceipt(id).catch(() => null);
          if (trxResp) {
            const receiptData = buildTransactionReceipt(trxResp);
            if (!receiptData.transactionRef) receiptData.transactionRef = normalizeTransactionRef(trxResp.transactionId || trxResp._id || trxResp.id || id);
            if (!receiptData.date) receiptData.date = trxResp.date || trxResp.createdAt || undefined;
            const sanitized = sanitizeReceipt(receiptData);
            try { navigateOrQueue('Receipt', { receiptData: sanitized }); } catch (e) { }
            const notifyId = data.notificationId || data._id || data.id || null;
            if (notifyId) {
              try { await markNotificationRead(String(notifyId)); } catch (_) { }
            }
            return;
          }
        }

        // If we didn't find a receipt to open, just log and return — the app's Notifications screen is available
      } catch (err) {
        console.warn('[App] Notification response handler error', err);
      }
    });

    console.log('[App] Notification system fully initialized');
  } catch (error) {
    console.error('[App] Notification setup failed:', error);
  }
}
  setup();
    // decide initial route for passcode gate
    (async () => {
      try {
        // Ensure runtime theme is ready before deciding the initial route to
        // avoid mounting screens (like PasscodeUnlock) before theme tokens
        // are available which causes visual flashes.
        try { const themeMod: any = await import('./src/theme'); await themeMod.awaitThemeReady(); } catch (e) { /* ignore */ }
        // If the user hasn't seen the intro (fresh install), show it first.
        try {
          const seen = await AsyncStorage.getItem('hasSeenIntro');
          if (!seen) {
            try { console.log('[App] first-run detected -> Intro'); } catch (e) {}
            setInitialRoute('Intro');
            initialRouteDecidedRef.current = true;
            if (mounted) setSplashVisible(false);
            return;
          }
        } catch (e) { /* ignore */ }

        const authLock = await import('./src/utils/authLock');
        const lastLogin = await authLock.getLastLogin();
        const passHash = await authLock.getPasscodeHash();
        // If there's no stored user token (e.g., app reinstalled), force login
        // Migrate legacy AsyncStorage token into secure storage if possible, then read token
        try { await authStorage.migrateFromAsyncStorage(); } catch (e) { /* ignore */ }
        const userToken = await authStorage.getToken();

        // Login expiry window: 7 days. After this period the user must re-login with credentials.
        const loginExpiryMs = 7 * 24 * 60 * 60 * 1000; // 7 days

        // If there's no token, force login and clear any last-auth marker (but DO NOT clear the passcode hash)
        if (!userToken) {
          try { await authLock.clearLastAuth(); } catch (e) { /* ignore */ }
          try { console.log('[App] initial-route decision: no user token -> Login'); } catch (e) { }
          setInitialRoute('Login');
          return;
        }

        // If there's no recorded full login time, or the login is too old, force full login
        if (!lastLogin || (Date.now() - lastLogin) > loginExpiryMs) {
          try { console.log('[App] initial-route decision: lastLogin missing/expired -> Login'); } catch (e) { }
          setInitialRoute('Login');
          return;
        }

        // At this point the user's credential login is still within the allowed window.
        // If the user has previously set a passcode, present the passcode unlock screen.
        // Note: the passcode itself is NOT expired by time — it is persisted until cleared.
        if (passHash) {
          try { console.log('[App] initial-route decision: passcode present -> PasscodeUnlock'); } catch (e) { }
          setInitialRoute('PasscodeUnlock');
          initialRouteDecidedRef.current = true;
        } else {
          // No passcode set: go straight to the dashboard
          try { console.log('[App] initial-route decision: no passcode -> Dashboard'); } catch (e) { }
          setInitialRoute('Dashboard');
          initialRouteDecidedRef.current = true;
        }
        if (mounted) {
          try { console.log('[App] hiding splash (mounted=', mounted, ') — deferring hide to avoid nav race'); } catch (e) { }
          // Defer hiding the splash for a tick so navigation state and JS
          // listeners settle first. This avoids a re-render collision where the
          // navigator mounts/unmounts at the same time the splash is removed.
          setTimeout(() => { if (mounted) setSplashVisible(false); }, 50);
        }
        if (!initialRoute || splashVisible) {
          return null; // render nothing until stable
        }

      } catch (e) {
        setInitialRoute('Login');
      }
    })();
    return () => { mounted = false; };
  }, []);
  // Ensure all notifications are high importance and visible in the status area (Android).
  // Re-apply a high-priority notification handler and ensure Android channels are set to MAX.
  React.useEffect(() => {
    // Make Expo show badges/listings and banners by default
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true, // show badge in status area where supported
        }),
      });
    } catch (e) {
      console.warn('[App] Failed to set notification handler', e);
    }

    if (Platform.OS !== 'android') return;

    let mounted = true;
    (async () => {
      try {
        const importance = (Notifications as any)?.AndroidImportance?.MAX ?? 5;
        const baseOpts: any = {
          importance,
          sound: 'default',
          bypassDnd: true,
          // lockscreenVisibility/public makes content visible on lockscreen/status area
          lockscreenVisibility: (Notifications as any)?.AndroidLockscreenVisibility?.PUBLIC ?? 1,
        };

        // Ensure common channels exist and are configured as high priority
        try {
          await Notifications.setNotificationChannelAsync('login', { name: 'Login & Alerts', ...baseOpts });
        } catch (e) {
          console.warn('[App] setNotificationChannelAsync(login) failed', e);
        }
        try {
          await Notifications.setNotificationChannelAsync('silent', { name: 'Silent (elevated)', ...baseOpts });
        } catch (e) {
          console.warn('[App] setNotificationChannelAsync(silent) failed', e);
        }
        try {
          await Notifications.setNotificationChannelAsync('default', { name: 'Default', ...baseOpts });
        } catch (e) {
          // some apps may not use 'default', ignore errors
        }

        console.log('[App] Android channels set to high importance and configured to show on lockscreen/status');
      } catch (e) {
        console.warn('[App] Failed to ensure Android high-priority channels', e);
      }
    })();

    return () => { mounted = false; };
  }, []);
  // Log initialRoute changes for diagnostics
  React.useEffect(() => {
    try { console.log('[App] initialRoute state changed ->', initialRoute); } catch (e) { }
  }, [initialRoute]);

  // Clear history filters on fresh app start so a closed app doesn't persist previous filters.
  React.useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.multiRemove(['filter:type', 'filter:startDate', 'filter:endDate']);
        console.log('[App] Cleared persisted history filters on startup');
      } catch (e) {
        // ignore errors
      }
    })();
  }, []);

  // Log splashVisible transitions
  React.useEffect(() => {
    try { console.log('[App] splashVisible ->', splashVisible); } catch (e) { }
  }, [splashVisible]);

  // (no top-level themeReady boolean here — the ThemeProvider must be
  // mounted for the theme context to exist; gating render based on themeCtx
  // is handled inside InnerApp via opacity so the mounted tree stays stable.)

  // Re-register push token on app start/resume when authenticated.
  useEffect(() => {
    let mounted = true;
    let appStateListener: any = null;

    async function registerIfAuthenticated() {
      try {
        // Ensure any migrated token is loaded
        await authStorage.migrateFromAsyncStorage().catch(() => { });
        const userToken = await authStorage.getToken();
        if (!userToken) return;

        // Dynamically import push manager to avoid bundling during server-only runs
        const pushManager = await import('./src/utils/pushTokenManager');
        await pushManager.savePushToken(userToken).catch((e: any) => {
          console.warn('[App] savePushToken failed', (e as any)?.message ?? e);
        });
      } catch (e) {
        console.warn('[App] re-register push token error', (e as any)?.message ?? e);
      }
    }

    // Register on mount
    registerIfAuthenticated();

    // Also register when app returns to foreground (in case tokens rotated or permissions changed)
    appStateListener = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        registerIfAuthenticated();
      }
    });

    return () => {
      mounted = false;
      try { appStateListener?.remove?.(); } catch (e) { /* ignore */ }
    };
  }, []);

  // We want ThemeProvider to be mounted early so screens that depend on
  // runtime theme don't flash when the navigator mounts. Render ThemeProvider
  // at the top-level and show the splash inside it while `initialRoute` is
  // being decided.

  // Inner app that consumes the runtime theme and passes it to PaperProvider
  

  // Root providers: ThemeProvider must wrap InnerApp so useTheme() works inside it.
  // Render the splash inside ThemeProvider while the initial route is being
  // decided so the theme is available immediately and screens won't flash.
  // Use the app primary color as the JS-side splash background so it
  // matches the native launch theme (which uses @color/colorPrimary).
  // Previously we forced black for dark mode which could create a brief
  // black gap between the native splash and the JS overlay. Use the
  // runtime theme primary color when available and fall back to the
  // legacy brand color.
  const initialBg = ((theme && theme.colors && theme.colors.primary) || '#162660');

  // Do not gate the root render here; the ThemeProvider must be mounted for
  // the runtime theme to become available. InnerApp already uses opacity to
  // avoid unmounting the tree while theme initializes.

  return (
    <ErrorBoundary>
    <ThemeProvider>
      {initialRoute === undefined ? (
        // While the initial route is still being decided, show the static
        // branded splash. Once the route is known we mount the app and then
        // keep an overlay above it while `splashVisible` is true so the
        // navigator can be prepared without a visible flash.
        <SafeAreaProvider>
          <SafeAreaView style={[styles.loadingContainer, { backgroundColor: initialBg }]}>
            <AnimatedLogo />
          </SafeAreaView>
        </SafeAreaProvider>
      ) : (
        <PreferencesProvider>
          {/* Mount the full app immediately so theme and navigation are ready. */}
          <InnerApp {...({ initialRouteProp: initialRoute!, navigationRef } as any)} />

          {/* Animated overlay that masks the app until the splash is dismissed. */}
          {/* Only show the JS overlay when the app is routing to the PasscodeUnlock
              screen. This prevents displaying two splashes for normal app starts
              (native launch splash -> JS branded splash). The overlay will still
              be used for the passcode path so the passcode screen can signal
              readiness before we hide the splash. */}
          {(overlayVisible && initialRoute === 'PasscodeUnlock') ? (
            <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: initialBg, alignItems: 'center', justifyContent: 'center', opacity: overlayOpacity }} pointerEvents="none">
              <AnimatedLogo />
            </Animated.View>
          ) : null}
        </PreferencesProvider>
      )}
      <OfflineBanner />
    </ThemeProvider>
    </ErrorBoundary>
  );
}
// Store a module-scoped pending value so callers earlier in the file can
// signal the desired initial route without throwing. We also log for
// diagnostics. If you later want the App component to pick up this value
// when it mounts, you can read `globalThis.__APP_PENDING_INITIAL_ROUTE__`.
function setInitialRoute(route: string) {
  try {
    (globalThis as any).__APP_PENDING_INITIAL_ROUTE__ = route;
    // diagnostic
    // eslint-disable-next-line no-console
    console.log('[App] setInitialRoute (module) ->', route);
  } catch (e) {
    // swallow errors to avoid breaking startup flow
  }
}

