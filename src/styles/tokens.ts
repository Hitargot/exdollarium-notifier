/**
 * Central design tokens for colors, spacing and radius.
 *
 * Purpose: provide a single source of truth for color usage across
 * the notifier (React Native) app and offer an easy mapping to
 * CSS variables for the web frontend.
 */

const colors = {
  // Brand
  brand: {
    primary: '#162660',      // main brand blue
    primaryDark: '#0f274f',  // hover / active
    primaryLight: '#d0e6fd', // light surface variant
  },

  // Supporting accents
  accent: {
    danger: '#FF3B30',   // critical / destructive
    accentAlt: '#FF6B65',
    highlight: '#ff6600',
    favorite: '#ffbf00',
  },

  // Status
  status: {
    success: '#16a34a',
    info: '#3b82f6',
    warning: '#ffc107',
    error: '#dc3545',
  },

  // Neutrals (useful scale)
  neutral: {
    900: '#111827',
    800: '#1f2937',
    700: '#374151',
    600: '#4b5563',
    500: '#6b7280',
    400: '#9aa6bf',
    300: '#d1d5db',
    200: '#e6e9ef',
    100: '#f3f6ff',
    50: '#fbfdff',
  },

  // Surfaces & backgrounds
  surface: {
    // Match the native launch / splash background (Android styles.xml uses #FFFFFF)
    page: '#FFFFFF',    // default page background (match native launch screen)
    card: '#FFFFFF',
    subtle: '#f5f7fb',
    softBeige: '#f1e4d1',
  },

  // Utility / semantic
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  // Gradients (as useful presets)
  gradient: {
    brandGreen: ['#004d00', '#0f660f'],
    sunset: ['#ff6600', '#ff3b30'],
  },
};

const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

const radius = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 16,
  pill: 9999,
};

// helper: produce a flat CSS variable map (optional, helpful when
// generating a CSS variables file for web). Not executed here,
// but exported for tooling or build-time use.
function toCssVariables(prefix = 'app') {
  const vars: Record<string, string> = {};

  function walk(obj: any, path: string[] = []) {
    Object.keys(obj).forEach((k) => {
      const v = obj[k];
      const next = path.concat(k);
      if (typeof v === 'string') {
        const name = `--${prefix}-${next.join('-')}`.toLowerCase();
        vars[name] = v;
      } else if (Array.isArray(v)) {
        // flatten arrays (gradients) into numbered vars
        v.forEach((val, i) => {
          const name = `--${prefix}-${next.join('-')}-${i + 1}`.toLowerCase();
          vars[name] = String(val);
        });
      } else if (typeof v === 'object' && v !== null) {
        walk(v, next);
      }
    });
  }

  walk(colors);
  return vars;
}

export { colors, spacing, radius, toCssVariables };
export default { colors, spacing, radius, toCssVariables };