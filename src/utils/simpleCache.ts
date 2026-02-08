// A tiny in-memory key/value cache with timestamp and in-flight guard.
type CacheEntry = { value: any; lastLoadedAt: number | null; isFetching?: boolean };

const store: Record<string, CacheEntry> = {};

export const get = (key: string) => (store[key] ? store[key].value : null);
export const set = (key: string, value: any) => {
  if (!store[key]) store[key] = { value: null, lastLoadedAt: null, isFetching: false };
  store[key].value = value;
  store[key].lastLoadedAt = Date.now();
};

export const getLastLoadedAt = (key: string) => (store[key] ? store[key].lastLoadedAt : null);
export const setLastLoadedAt = (key: string, ts: number | null) => {
  if (!store[key]) store[key] = { value: null, lastLoadedAt: null, isFetching: false };
  store[key].lastLoadedAt = ts;
};

export const isFetching = (key: string) => !!(store[key] && store[key].isFetching);
export const setFetching = (key: string, v: boolean) => {
  if (!store[key]) store[key] = { value: null, lastLoadedAt: null, isFetching: false };
  store[key].isFetching = !!v;
};

export const clear = (key: string) => { delete store[key]; };

export default { get, set, getLastLoadedAt, setLastLoadedAt, isFetching, setFetching, clear };
