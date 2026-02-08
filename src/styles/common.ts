import { StyleSheet } from 'react-native';
import theme from './theme';

const common = StyleSheet.create({
  containerCenter: { flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 20 },
  brand: { fontSize: 32, fontWeight: '800', color: theme.colors.primary },
  subtitle: { color: theme.colors.muted, marginTop: 4 },

  form: { padding: 20, marginHorizontal: 16, backgroundColor: theme.colors.surface, borderRadius: 12, elevation: 3 },
  label: { color: theme.colors.subtle, fontSize: 13, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: theme.colors.border, padding: 12, borderRadius: 8, marginBottom: 12, backgroundColor: theme.colors.surface },

  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  eyeBtn: { padding: 10, marginLeft: 8 },
  eyeText: { color: theme.colors.primary, fontWeight: '600' },

  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },

  primaryButton: { backgroundColor: theme.colors.primary, padding: 14, borderRadius: 10, marginTop: 18, alignItems: 'center' },
  primaryButtonText: { color: theme.colors.white, fontWeight: '700' },

  link: { color: theme.colors.link, fontWeight: '700' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 14 },
  small: { color: theme.colors.muted },
  smallLink: { color: theme.colors.mutedLight, textDecorationLine: 'underline' },
});

export default common;
