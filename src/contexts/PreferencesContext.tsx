import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SHOW_SPARKLINE_KEY = 'showBalanceSparkline';

type Preferences = {
  showBalanceSparkline: boolean;
};

type PreferencesContextValue = {
  preferences: Preferences;
  setShowBalanceSparkline: (v: boolean) => Promise<void>;
  ready: boolean;
};

const defaultPrefs: Preferences = { showBalanceSparkline: true };

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

export const PreferencesProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const [prefs, setPrefs] = useState<Preferences>(defaultPrefs);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SHOW_SPARKLINE_KEY);
        if (!mounted) return;
        if (raw === null) {
          setPrefs(defaultPrefs);
        } else {
          setPrefs((p) => ({ ...p, showBalanceSparkline: JSON.parse(raw) }));
        }
      } catch (e) {
        if (mounted) setPrefs(defaultPrefs);
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const setShowBalanceSparkline = useCallback(async (v: boolean) => {
    setPrefs((p) => ({ ...p, showBalanceSparkline: v }));
    try { await AsyncStorage.setItem(SHOW_SPARKLINE_KEY, JSON.stringify(v)); } catch (e) { /* ignore */ }
  }, []);

  return (
    <PreferencesContext.Provider value={{ preferences: prefs, setShowBalanceSparkline, ready }}>
      {children}
    </PreferencesContext.Provider>
  );
};

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}

export default PreferencesProvider;
