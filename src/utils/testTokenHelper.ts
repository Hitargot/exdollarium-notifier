import AsyncStorage from '@react-native-async-storage/async-storage';

const TEST_TOKEN_KEY = 'TEST_CLIENT_TOKEN';

export async function setTestToken(token: string): Promise<void> {
  if (!token) return;
  try {
    await AsyncStorage.setItem(TEST_TOKEN_KEY, token);
  } catch (e) {
    // ignore in dev helper
    // eslint-disable-next-line no-console
    console.warn('Failed to set test token in AsyncStorage', e);
  }
}

export async function getTestToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TEST_TOKEN_KEY);
  } catch (e) {
    return null;
  }
}

export async function clearTestToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(TEST_TOKEN_KEY);
  } catch (e) {
    // ignore
  }
}

// Convenience: expose on global for quick dev console use when RN debugger is connected
if (__DEV__) {
  try {
    // @ts-ignore
    global.__setTestToken = setTestToken;
    // @ts-ignore
    global.__getTestToken = getTestToken;
    // @ts-ignore
    global.__clearTestToken = clearTestToken;
  } catch (e) {}
}

export default { setTestToken, getTestToken, clearTestToken };
