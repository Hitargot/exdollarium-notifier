/**
 * Small utilities to format numeric input values for display (thousands separators)
 * while keeping an unformatted numeric string for computations/submission.
 */

export function formatWithCommas(input: string): string {
  if (!input && input !== '0') return '';
  const s = String(input);
  // Allow a single decimal point, preserve trailing decimal if present
  const parts = s.split('.');
  const intPart = parts[0].replace(/[^0-9]/g, '') || '0';
  const decPart = parts.length > 1 ? parts.slice(1).join('').replace(/[^0-9]/g, '') : null;
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart !== null ? `${withCommas}${decPart.length ? '.' + decPart : '.'}` : withCommas;
}

export function stripFormatting(input: string): string {
  if (!input) return '';
  // Remove commas and any non-digit/decimal characters, but allow one decimal point
  const cleaned = input.replace(/,/g, '').replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length <= 1) return parts[0] || '';
  return parts[0] + '.' + parts.slice(1).join('');
}

export default { formatWithCommas, stripFormatting };
