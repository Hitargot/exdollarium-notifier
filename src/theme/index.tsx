import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import staticTheme from '../styles/theme';

type ThemeName = 'light' | 'dark';
type ThemePreference = 'system' | ThemeName;

const THEME_PREF_KEY = 'themePreference';

export const light = {
  name: 'light' as ThemeName,
  background: '#ffffff',
  card: '#ffffff',
  text: '#162660',
  muted: '#666',
  border: '#eee',
  accent: '#FF3B30',
  favorite: '#ffbf00'
};

export const dark = {
  name: 'dark' as ThemeName,
  // Use true black for dark mode background to achieve a true "black" dark theme
  background: '#000000',
  card: '#0f1724',
  text: '#e6eef9',
  muted: '#9aa6bf',
  border: '#1f2937',
  accent: '#FF6B65',
  favorite: '#ffbf00'
};

type Theme = typeof light;

type ThemeContextValue = any;

// expose the merged theme object at the top-level of the context so
// consumers can call `const theme = useTheme()` and access `theme.colors.*`
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// Simple readiness promise so callers can wait until the ThemeProvider has
// performed its initial preference load and computed the effective theme.
let themeReadyResolved = false;
let themeReadyResolve: (() => void) | null = null;
const themeReadyPromise = new Promise<void>((res) => { themeReadyResolve = res; });

export function awaitThemeReady(): Promise<void> {
  if (themeReadyResolved) return Promise.resolve();
  return themeReadyPromise;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Default to 'light' to ensure the app uses the light theme when no preference is stored
  const [preference, setPreferenceState] = useState<ThemePreference>('light');
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
    const base = use === 'dark' ? dark : light;
    // Merge with staticTheme colors to preserve the app-wide color tokens (primary, error, etc.)
    const colors = {
      ...staticTheme.colors,
      // override surface/background/text/muted/border/accent with provider values
      background: base.background,
      surface: base.card || staticTheme.colors.surface,
      text: base.text,
      muted: base.muted,
      border: base.border,
  accent: (base as any).accent || staticTheme.colors.warning,
    } as any;

    // Mutate the shared static theme object so legacy imports that
    // directly reference `src/styles/theme` observe runtime changes.
    // This keeps existing components working without immediate migration.
    try {
      Object.assign(staticTheme.colors, {
        background: colors.background,
        surface: colors.surface,
        text: colors.text,
        muted: colors.muted,
        border: colors.border,
        accent: colors.accent,
      });
    } catch (e) {
      // In case staticTheme is frozen or not writable, ignore the error.
    }

    const merged = {
      name: base.name,
      colors,
      spacing: staticTheme.spacing,
      radius: staticTheme.radius,
    };

    return merged;
  }, [preference, system]);

  const ctxValue = useMemo(() => ({
    // spread the merged theme (colors, spacing, radius, name)
    ...effective,
    // runtime preference helpers
    preference,
    setPreference,
  }), [effective, preference, setPreference]);

  // resolve the readiness promise once the merged theme is available
  useEffect(() => {
    if (!themeReadyResolved && themeReadyResolve) {
      try { themeReadyResolve(); } catch (e) {}
      themeReadyResolved = true;
      themeReadyResolve = null;
    }
  }, [ctxValue]);

  return (
    <ThemeContext.Provider value={ctxValue}>
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
