import { Animated } from 'react-native';

let resolved = false;
let resolveFn: (() => void) | null = null;
let promise: Promise<void> | null = null;

// Animated value consumers (UI) can import this and bind to logo transform.
export const logoScale = new Animated.Value(1.15); // start slightly larger so we can zoom out to 1

function ensurePromise() {
  if (!promise) {
    promise = new Promise((res) => { resolveFn = res; });
  }
  return promise;
}

export function awaitSplashDismiss(): Promise<void> {
  try { console.log('[splashController] awaitSplashDismiss called, resolved=', resolved); } catch (e) {}
  if (resolved) return Promise.resolve();
  return ensurePromise() as Promise<void>;
}

export function signalPasscodeReady(): void {
  if (resolved) return;
  // perform a short 'zoom out' animation on the shared logoScale, then resolve
  const doResolve = () => {
    resolved = true;
    if (resolveFn) {
      try { console.log('[splashController] signalPasscodeReady called (resolving)'); resolveFn(); } catch (e) { /* ignore */ }
      resolveFn = null;
      promise = null;
    }
  };

  try {
    console.log('[splashController] signalPasscodeReady called (starting zoom-out)');
  } catch (e) { /* ignore */ }

  try {
    Animated.timing(logoScale, { toValue: 1, duration: 420, useNativeDriver: true }).start(() => {
      doResolve();
    });
  } catch (e) {
    // If Animated fails for any reason, fallback to immediate resolve
    doResolve();
  }
}

export function resetSplashControllerForTests() {
  // helper used only in tests / dev to reset internal state
  resolved = false;
  resolveFn = null;
  promise = null;
  try { logoScale.setValue(1.15); } catch (e) { /* ignore */ }
}
