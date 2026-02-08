// Simple in-memory cache for transactions and last-loaded timestamp.
// Keeps values across component unmounts while the JS bundle is alive.

let lastLoadedAt: number | null = null;
let transactionsCache: any[] | null = null;

export const getLastLoadedAt = () => lastLoadedAt;
export const setLastLoadedAt = (value: number | null) => { lastLoadedAt = value; };

export const getCachedTransactions = () => transactionsCache;
export const setCachedTransactions = (txns: any[] | null) => { transactionsCache = txns; };

export const clearTransactionCache = () => { lastLoadedAt = null; transactionsCache = null; };

export default {
  getLastLoadedAt,
  setLastLoadedAt,
  getCachedTransactions,
  setCachedTransactions,
  clearTransactionCache,
};
