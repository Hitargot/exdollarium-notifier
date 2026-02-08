import React, { useCallback, useEffect, useState } from 'react';
import { Snackbar } from 'react-native-paper';
import { Keyboard, Platform } from 'react-native';

type ToastAction = {
  message: string;
  duration?: number;
  actionLabel?: string;
  onPress?: () => void;
};

type ToastHandler = (payload: string | ToastAction) => void;

// Module-level handler set by the provider when mounted
let _handler: ToastHandler | null = null;

export function setToastHandler(fn: ToastHandler | null) {
  _handler = fn;
}

/**
 * Try to show an in-app toast using the mounted provider.
 * Returns true if handled, false otherwise.
 */
export function showInAppToast(messageOrOpts: string | ToastAction, duration?: number): boolean {
  if (_handler) {
    try {
      if (typeof messageOrOpts === 'string') {
        _handler({ message: messageOrOpts, duration });
      } else {
        _handler(messageOrOpts);
      }
      return true;
    } catch (e) {
      // ignore handler errors and fallback
      return false;
    }
  }
  return false;
}

export const ToastProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [duration, setDuration] = useState<number>(3000);
  const [actionLabel, setActionLabel] = useState<string | undefined>(undefined);
  const [actionHandler, setActionHandler] = useState<(() => void) | undefined>(undefined);
  const [bottomOffset, setBottomOffset] = useState<number>(0);

  const show = useCallback((opts: string | ToastAction) => {
    const dur = typeof opts === 'string' ? 3000 : (opts.duration || 3000);
    const msg = typeof opts === 'string' ? opts : opts.message;
    setMessage(msg);
    setDuration(dur);
    if (typeof opts === 'object' && opts.actionLabel) {
      setActionLabel(opts.actionLabel);
      setActionHandler(() => opts.onPress);
    } else {
      setActionLabel(undefined);
      setActionHandler(undefined);
    }
    // retrigger visibility to allow consecutive toasts
    setVisible(false);
    // small timeout so state updates settle before showing
    setTimeout(() => setVisible(true), 50);
  }, []);

  useEffect(() => {
    setToastHandler(show);
    return () => setToastHandler(null);
  }, [show]);

  // Move Snackbar above keyboard when it is visible (helps OTP and other input screens)
  useEffect(() => {
    const onShow = (e: any) => {
      try {
        const h = e.endCoordinates?.height || (Platform.OS === 'android' ? 260 : 300);
        setBottomOffset(h + 8);
      } catch (err) { setBottomOffset(8); }
    };
    const onHide = () => setBottomOffset(8);

    const showSub = Keyboard.addListener('keyboardDidShow', onShow);
    const hideSub = Keyboard.addListener('keyboardDidHide', onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <>
      {children}
      <Snackbar
        visible={visible}
        onDismiss={() => setVisible(false)}
        duration={duration}
        action={actionLabel ? { label: actionLabel, onPress: () => { if (actionHandler) actionHandler(); setVisible(false); } } : undefined}
        style={{ marginBottom: bottomOffset }}
      >
        {message}
      </Snackbar>
    </>
  );
};

export default ToastProvider;
