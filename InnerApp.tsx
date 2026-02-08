import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper';

import ToastProvider from './src/contexts/ToastContext';
import ConfirmProvider from './src/contexts/ConfirmContext';
import { useTheme } from './src/theme/index';
import { RootStackParamList } from './src/screens/types';

/* Screens */
import LoginScreen from './src/screens/LoginScreen';
import IntroScreen from './src/screens/IntroScreen';
import PasscodeUnlockScreen from './src/screens/PasscodeUnlockScreen';
import SetPasscodeScreen from './src/screens/SetPasscodeScreen';
import SignupScreen from './src/screens/SignUpScreen';
import OtpVerificationScreen from './src/screens/OtpVerificationScreen';
import ResetOtpScreen from './src/screens/ResetOtpScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import SuccessOnboarding from './src/screens/SuccessOnboarding';
import DashboardScreen from './src/screens/DashboardScreen';
import ProfileScreen from './src/Dashboardcomponent/ProfileScreen';
import GetTagScreen from './src/Dashboardcomponent/GetTagScreen';
import CalculatorScreen from './src/Dashboardcomponent/CalculatorScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ReceiptScreen from './src/screens/ReceiptScreen';
import TradeConfirmationScreen from './src/screens/TradeConfirmationScreen';
import MyPreSubmissionsScreen from './src/screens/MyPreSubmissionsScreen';
import ImagePreviewScreen from './src/screens/ImagePreviewScreen';
import WithdrawalScreen from './src/screens/WithdrawalScreen';
import WithdrawalFormScreen from './src/screens/WithdrawalFormScreen';
import SendViaBankScreen from './src/screens/SendViaBankScreen';
import SendExdollarium from './src/screens/SendExdollarium';
import AddBankScreen from './src/screens/AddBankScreen';
import SetPINScreen from './src/screens/SetPINScreen';
import SuccessScreen from './src/screens/SuccessScreen';
import SendSuccess from './src/screens/SendSuccess';
import WithdrawalSuccess from './src/screens/WithdrawalSuccess';
import NotificationSettingsScreen from './src/screens/NotificationSettingsScreen';
import EarnScreen from './src/Dashboardcomponent/EarnScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

type Props = {
  initialRouteProp: keyof RootStackParamList;
  // optional navigation ref passed from parent so external handlers (notifications)
  // can navigate using the same ref instance.
  navigationRef?: any;
};

export default function InnerApp({ initialRouteProp, navigationRef: parentNavRef }: Props) {
  const themeCtx = useTheme();

  // Track the current route so we can update the parent SafeArea background
  // dynamically. This prevents the Intro color leaking to other screens
  // while still ensuring the status bar area is dark when Intro is visible.
  const [currentRoute, setCurrentRoute] = React.useState<string | undefined>(initialRouteProp as string);

  // Treat some screens (Intro, Login, Signup) as full-screen dark routes
  // so the parent safe area/status bar uses the dark brand background while
  // those screens are visible.
  const darkRoutes = ['Intro', 'Login', 'Signup','OtpVerification'];
  const safeAreaBackground = darkRoutes.includes(currentRoute ?? '')
    ? '#162660'
    : (themeCtx.colors?.background || '#fff');

  // Use navigation ref passed from parent App if provided (so external
  // code can call navigationRef.current.navigate). Otherwise create a local ref.
  const navRef = React.useMemo(() => parentNavRef || createNavigationContainerRef<RootStackParamList>(), [parentNavRef]);

  const paperTheme = React.useMemo(() => ({
    dark: themeCtx.name === 'dark',
    roundness: themeCtx.radius || 4,
    colors: {
      primary: themeCtx.colors?.primary || themeCtx.colors?.accent || '#FF3B30',
      background: themeCtx.colors?.background || '#fff',
      surface: themeCtx.colors?.surface || '#fff',
      text: themeCtx.colors?.text || '#000',
      placeholder: themeCtx.colors?.muted || '#999',
      error: themeCtx.colors?.error || '#B00020',
      notification: themeCtx.colors?.accent || '#FF3B30',
    },
  }), [themeCtx]);

  return (
    <PaperProvider theme={paperTheme}>
      <SafeAreaProvider>
        <ToastProvider>
          <ConfirmProvider>
            <SafeAreaView style={{ flex: 1, backgroundColor: safeAreaBackground }}>
              <StatusBar
                style={themeCtx.name === 'dark' ? 'light' : 'dark'}
              />

              <NavigationContainer
                ref={navRef}
                onReady={() => {
                  try {
                    // set current route when navigator becomes ready
                    const r = (navRef as any).current?.getCurrentRoute?.();
                    setCurrentRoute(r?.name ?? initialRouteProp as string);

                    // If a pending navigation was queued before the navigator
                    // was ready (for example a notification tap), consume it now.
                    const pending = (globalThis as any).__APP_PENDING_NOTIFICATION_NAV__;
                    if (pending && pending.name) {
                      try { (navRef as any).current?.navigate(pending.name, pending.params); } catch (_) { }
                      try { delete (globalThis as any).__APP_PENDING_NOTIFICATION_NAV__; } catch (_) { }
                    }
                  } catch (e) { }
                }}
                onStateChange={() => {
                  try {
                    const r = (navRef as any).current?.getCurrentRoute?.();
                    setCurrentRoute(r?.name ?? currentRoute);
                  } catch (e) { }
                }}
              >
                <Stack.Navigator
                  initialRouteName={initialRouteProp}
                  screenOptions={{ headerShown: false }}
                >
                  <Stack.Screen name="Login" component={LoginScreen} />
                  <Stack.Screen name="Intro" component={IntroScreen} />
                  <Stack.Screen
                    name="PasscodeUnlock"
                    component={PasscodeUnlockScreen}
                    options={{ animation: 'none' }}
                  />
                  <Stack.Screen name="SetPasscode" component={SetPasscodeScreen} />
                  <Stack.Screen name="Signup" component={SignupScreen} />
                  <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
                  <Stack.Screen name="SuccessOnboarding" component={SuccessOnboarding} />
                  <Stack.Screen name="ResetOtp" component={ResetOtpScreen} />
                  <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
                  <Stack.Screen name="Dashboard" component={DashboardScreen} />
                  <Stack.Screen name="Notifications" component={NotificationsScreen} />
                  <Stack.Screen name="Profile" component={ProfileScreen} />
                  <Stack.Screen name="GetTag" component={GetTagScreen} />
                  <Stack.Screen name="Calculator" component={CalculatorScreen} />
                  <Stack.Screen name="History" component={HistoryScreen} />
                  <Stack.Screen name="Help" component={require('./src/screens/HelpScreen').default} />
                  <Stack.Screen name="Messages" component={require('./src/screens/MessagesScreen').default} />
                  <Stack.Screen name="Tickets" component={require('./src/screens/TicketsScreen').default} />
                  <Stack.Screen name="Chat" component={require('./src/screens/ChatScreen').default} />
                  <Stack.Screen name="Receipt" component={ReceiptScreen} />
                  <Stack.Screen name="TradeConfirmation" component={TradeConfirmationScreen} />
                  <Stack.Screen name="MyPreSubmissions" component={MyPreSubmissionsScreen} />
                  <Stack.Screen name="ImagePreview" component={ImagePreviewScreen} />
                  <Stack.Screen name="Withdrawal" component={WithdrawalScreen} />
                  <Stack.Screen name="WithdrawalFormScreen" component={WithdrawalFormScreen} />
                  <Stack.Screen name="SendViaBankScreen" component={SendViaBankScreen} />
                  <Stack.Screen name="SendExdollarium" component={SendExdollarium} />
                  <Stack.Screen name="AddBankScreen" component={AddBankScreen} />
                  <Stack.Screen name="SetPINScreen" component={SetPINScreen} />
                  <Stack.Screen name="SuccessScreen" component={SuccessScreen} />
                  <Stack.Screen name="SendSuccess" component={SendSuccess} />
                  <Stack.Screen name="WithdrawalSuccess" component={WithdrawalSuccess} />
                  <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
                  <Stack.Screen name="Earn" component={EarnScreen} />
                  <Stack.Screen name="VerifyPinOtpScreen" component={require('./src/screens/VerifyPinOtpScreen').default} />
                  <Stack.Screen name="ResetPinScreen" component={require('./src/screens/ResetPinScreen').default} />
                </Stack.Navigator>
              </NavigationContainer>
            </SafeAreaView>
          </ConfirmProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </PaperProvider>
  );
}
