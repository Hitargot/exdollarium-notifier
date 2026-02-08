export const formatSignedAmount = (amount?: number | null, type?: string) => {
  if (amount === undefined || amount === null) return '—';
  const num = Number(amount || 0);
  const abs = Math.abs(num);
  const t = (type || '').toString().toLowerCase();
  const isNegative = t.includes('withdrawal') || t.includes('sent transfer') || t.includes('sent');
  const isPositive = t.includes('fund') || t.includes('received transfer') || t.includes('received');
  const sign = isNegative ? '-' : isPositive ? '+' : '';
  return `${sign}₦${abs.toLocaleString()}`;
};

export const formatAmountPlain = (amount?: number | null) => {
  if (amount === undefined || amount === null) return '—';
  return `₦${Number(amount).toLocaleString()}`;
};

export default formatSignedAmount;
