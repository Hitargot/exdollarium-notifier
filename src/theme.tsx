import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import tokens from './styles/tokens';

type ThemeName = 'light' | 'dark';
type ThemePreference = 'system' | ThemeName;

const THEME_PREF_KEY = 'themePreference';

export const light = {
  name: 'light' as ThemeName,
  background: tokens.colors.surface.card || '#ffffff',
  card: tokens.colors.surface.card || '#ffffff',
  text: tokens.colors.brand.primary || '#162660',
  muted: tokens.colors.neutral[500] || '#666',
  border: tokens.colors.neutral[200] || '#eee',
  accent: tokens.colors.accent.danger || '#FF3B30',
  favorite: tokens.colors.accent.favorite || '#ffbf00',
};

export const dark = {
  name: 'dark' as ThemeName,
  // Use true black for dark mode background to produce a black UI in dark mode
  background: '#000000',
  card: tokens.colors.neutral[800] || '#0f1724',
  text: tokens.colors.surface.card || '#e6eef9',
  muted: tokens.colors.neutral[400] || '#9aa6bf',
  border: tokens.colors.neutral[800] || '#1f2937',
  accent: tokens.colors.accent.accentAlt || '#FF6B65',
  favorite: tokens.colors.accent.favorite || '#ffbf00',
};

type Theme = typeof light;

type ThemeContextValue = {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [system, setSystem] = useState<ColorSchemeName>(Appearance.getColorScheme());

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystem(colorScheme));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(THEME_PREF_KEY);
        if (raw === 'light' || raw === 'dark' || raw === 'system') setPreferenceState(raw as ThemePreference);
      } catch (e) { /* ignore */ }
    })();
  }, []);

  const setPreference = useCallback(async (p: ThemePreference) => {
    setPreferenceState(p);
    try { await AsyncStorage.setItem(THEME_PREF_KEY, p); } catch (e) { /* ignore */ }
  }, []);

  const effective = useMemo(() => {
    const use = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
    return use === 'dark' ? dark : light;
  }, [preference, system]);

  return (
    <ThemeContext.Provider value={{ theme: effective, preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export type { ThemeName, ThemePreference };
