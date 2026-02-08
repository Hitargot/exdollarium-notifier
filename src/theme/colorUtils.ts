// Small utility to pick a readable foreground color (black or white)
// based on the background color's luminance. This keeps text/icons
// readable when backgrounds become very dark (true black) or very light.

function hexToRgb(hex: string) {
  if (!hex) return null;
  const h = hex.replace('#', '').trim();
  const parsed = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const int = parseInt(parsed, 16);
  if (Number.isNaN(int)) return null;
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }) {
  // convert sRGB to linear
  const srgb = [r, g, b].map((v) => v / 255).map((c) => {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  // Rec 709 luminance
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

export function pickContrastText(bgColor?: string, light = '#FFFFFF', dark = '#000000') {
  try {
    if (!bgColor) return dark;
    const rgb = hexToRgb(bgColor);
    if (!rgb) return dark;
    const lum = relativeLuminance(rgb);
    // threshold: if background luminance is low (dark bg) pick light text
    // 0.179 is a conservative WCAG-ish threshold; tweak if needed
    return lum < 0.18 ? light : dark;
  } catch (e) {
    return dark;
  }
}

export default { pickContrastText };
