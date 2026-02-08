// Helpers for receipt/transaction IDs
export function normalizeTransactionRef(id: any): string | undefined {
  if (!id && id !== 0) return undefined;
  const s = String(id || '').trim();
  if (!s) return undefined;

  // common noise words we should ignore
  const stopwords = new Set([
    'your', 'transaction', 'id', 'receipt', 'the', 'a', 'an', 'to', 'from',
    // transaction-type words we should not treat as ids
    'withdrawal', 'withdraw', 'transfer', 'funding', 'funded', 'funds', 'deposit', 'payment', 'sent', 'received', 'confirmation', 'trade',
    // status words
    'pending', 'completed', 'complete', 'success', 'successful', 'failed', 'rejected', 'cancelled', 'processing', 'processed'
  ]);

  // normalize by replacing punctuation (except - and _) with spaces, then split into tokens
  const raw = s.replace(/[^A-Za-z0-9\-_]+/g, ' ');
  const tokens = raw.split(/\s+/).map(t => t.trim()).filter(Boolean);

  for (const t of tokens) {
    const low = t.toLowerCase();
    if (stopwords.has(low)) continue;
    // prefer tokens that look explicitly like TRX-xxxx
    if (/^TRX[-_A-Za-z0-9]{4,}$/i.test(t)) return t;
    // prefer tokens containing both letters and digits and length >= 6 (e.g., abc1234)
    if (t.length >= 6 && /[A-Za-z]/.test(t) && /\d/.test(t)) return t;
  // accept longer alphanumeric tokens (likely ids) length >= 8, but require digit or -/_ so we don't accept pure words like 'completed'
  if (t.length >= 8 && /^[A-Za-z0-9\-_]+$/.test(t) && (/[0-9]/.test(t) || /[-_]/.test(t))) return t;
    // last resort: digits-only token with reasonable length >= 6
    if (t.length >= 6 && /^\d+$/.test(t)) return t;
  }

  // if nothing matched, but the whole string looks like an id, return it
  const candidate = s.replace(/^[^A-Za-z0-9\-_]+|[^A-Za-z0-9\-_]+$/g, '');
  if (candidate.length >= 4 && /^[A-Za-z0-9\-_]+$/.test(candidate) && !stopwords.has(candidate.toLowerCase())) return candidate;

  return undefined;
}

export function isMinimalTransaction(obj: any) {
  if (!obj || typeof obj !== 'object') return true;
  // Consider minimal if it only has an id/transactionId and no amount/status/bank/files/service
  const hasUseful = obj.amount || obj.status || obj.bankMeta || obj.serviceName || (Array.isArray(obj.fileUrls) && obj.fileUrls.length > 0) || obj.note;
  return !hasUseful;
}
