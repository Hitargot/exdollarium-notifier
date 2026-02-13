export const formatSignedAmount = (amount?: number | null, type?: string) => {
  if (amount === undefined || amount === null) return '—';
  const num = Number(amount || 0);
  const abs = Math.abs(num);
  const t = (type || '').toString().toLowerCase();
  
  // More specific checks for transaction types
  const isNegative = t.includes('withdrawal') || t.includes('sent') || t.includes('debit') || t === 'transfer';
  const isPositive = t.includes('fund') || t.includes('received') || t.includes('credit') || t.includes('deposit') || t === 'receive';

  const sign = isNegative ? '-' : isPositive ? '+' : '';
  
  return `${sign}₦${abs.toLocaleString()}`;
};

export const formatAmountPlain = (amount?: number | null) => {
  if (amount === undefined || amount === null) return '—';
  return `₦${Number(amount).toLocaleString()}`;
};

export default formatSignedAmount;
