import tokens from './tokens';

export const colors = {
  // Base / brand
  primary: tokens.colors.brand.primary,
  link: tokens.colors.status.info,

  // Accents / warnings
  warning: tokens.colors.accent.highlight,

  // Semantic
  success: tokens.colors.status.success,
  successDark: tokens.colors.status.success,
  error: tokens.colors.status.error,

  // Surfaces
  background: tokens.colors.surface.page,
  surface: tokens.colors.surface.card,

  // Basic neutrals
  white: tokens.colors.white,
  black: tokens.colors.black,

  // Text
  text: tokens.colors.neutral[900],
  subtle: tokens.colors.neutral[700],
  muted: tokens.colors.neutral[500],
  mutedLight: tokens.colors.neutral[400],

  // Borders and inputs
  border: tokens.colors.neutral[200],

  // Utility
  overlay: 'rgba(0,0,0,0.33)',
};

export type ThemeColors = typeof colors;

const theme = {
  colors,
  spacing: tokens.spacing,
  radius: tokens.radius,
};

export default theme;
