import React, { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import ConfirmModal from '../components/ConfirmModal';

type ConfirmOptions = {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
};

type ConfirmHandler = (opts: ConfirmOptions) => Promise<boolean>;

let _handler: ConfirmHandler | null = null;

export function setConfirmHandler(fn: ConfirmHandler | null) {
  _handler = fn;
}

/**
 * Show an in-app confirm dialog if provider mounted, otherwise fallback to system Alert.
 */
export function showInAppConfirm(opts: ConfirmOptions): Promise<boolean> {
  if (_handler) return _handler(opts);

  // Fallback to Alert-based confirm
  return new Promise((resolve) => {
    Alert.alert(opts.title || 'Confirm', opts.message || '', [
      { text: opts.cancelText || 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: opts.confirmText || 'Confirm', onPress: () => resolve(true) },
    ]);
  });
}

export const ConfirmProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [confirmText, setConfirmText] = useState<string>('Confirm');
  const [cancelText, setCancelText] = useState<string>('Cancel');
  const resolverRef = React.useRef<((v: boolean) => void) | null>(null);

  const show = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setTitle(opts.title);
      setMessage(opts.message);
      // allow explicit empty string for cancelText (single-button mode)
      setConfirmText(opts.confirmText === undefined ? 'Confirm' : opts.confirmText);
      setCancelText(opts.cancelText === undefined ? 'Cancel' : opts.cancelText);
      // show dialog
      setVisible(true);
    });
  }, []);

  useEffect(() => {
    setConfirmHandler(show);
    return () => setConfirmHandler(null);
  }, [show]);

  const handleClose = (result: boolean) => {
    setVisible(false);
    // resolve promise
    const r = resolverRef.current;
    resolverRef.current = null;
    if (r) r(result);
  };

  return (
    <>
      {children}
      <ConfirmModal
        visible={visible}
        title={title}
        message={message}
        confirmText={confirmText}
        cancelText={cancelText}
        onCancel={() => handleClose(false)}
        onConfirm={() => handleClose(true)}
      />
    </>
  );
};

export default ConfirmProvider;
