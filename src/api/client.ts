import axios, { AxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authStorage from '../utils/authStorage';

const extra = (Constants.expoConfig && (Constants.expoConfig as any).extra) || {};

// Normalize API base URL coming from app config / .env.
// Some dev setups accidentally include quotes or a trailing '/api' which causes
// the client to request '/api/api/...' and get 404s. This helper cleans that.
const rawApi = (extra.apiUrl || extra.API_URL || extra.apiUrl || '') as string;
const normalizeApiBase = (a: string) => {
  if (!a) return '';
  let s = String(a).trim();
  // remove surrounding single or double quotes if present
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    s = s.slice(1, -1).trim();
  }
  // remove any trailing slashes
  s = s.replace(/\/+$/g, '');
  // if someone included the '/api' path, strip it so client adds '/api' itself
  if (s.toLowerCase().endsWith('/api')) s = s.slice(0, -4);
  return s;
};
const baseURL = normalizeApiBase(rawApi);
// Helpful debug: log configured API base in dev builds so we can confirm it at runtime
try { console.log('[api/client] configured baseURL =', baseURL || '<empty>'); } catch (e) {}

const client = axios.create({ baseURL, timeout: 15000 });

// Attach token automatically
interface AuthStorageLike {
  getToken(): Promise<string | null>;
}

client.interceptors.request.use(async (cfg: any): Promise<any> => {
  try {
    // Prefer secure storage token when available
    const storage = authStorage as AuthStorageLike;
    let token: string | null | undefined = await storage.getToken();
    // fallback to legacy jwtToken in AsyncStorage if present
    if (!token) token = await AsyncStorage.getItem('jwtToken');
    // Normalize token: strip any accidentally-stored 'Bearer ' prefix
    if (typeof token === 'string' && token.toLowerCase().startsWith('bearer ')) {
      token = token.split(' ')[1];
    }
    if (token && cfg.headers) (cfg.headers as Record<string, string>).Authorization = `Bearer ${token}`;

    // Attach test-client token header for opt-in testing if available (from expo constants or AsyncStorage)
    try {
      const extras: any = extra || {};
      let testToken: string | null | undefined = extras.TEST_CLIENT_TOKEN || extras.testClientToken || extras.test_client_token || null;
      if (!testToken) {
        // fallback to AsyncStorage key (useful for dev/test builds)
        testToken = await AsyncStorage.getItem('TEST_CLIENT_TOKEN');
      }
      if (testToken && cfg.headers) (cfg.headers as Record<string, string>)['X-Test-Token'] = testToken;
    } catch (e) {
      // ignore test token attach errors
    }
  } catch (e) {
    // ignore
  }
  return cfg;
});

export const getProfile = async () => {
  const res = await client.get('/api/user/profile');
  return res.data;
};

export const getWalletData = async () => {
  const res = await client.get('/api/wallet/data');
  return res.data;
};

export const getTransactions = async (limit = 20) => {
  const res = await client.get(`/api/transaction/transaction-history?limit=${limit}`);
  return res.data;
};

export const getConfirmations = async (limit = 20) => {
  const res = await client.get(`/api/confirmations?limit=${limit}`);
  return res.data;
};



export const getPreSubmissions = async () => {
  const res = await client.get('/api/pre-submissions');
  return res.data;
};

// Tickets API
export const getTickets = async () => {
  const res = await client.get('/api/tickets');
  return res.data;
};

export const getTicket = async (ticketId: string) => {
  const res = await client.get(`/api/tickets/${encodeURIComponent(ticketId)}`);
  return res.data;
};

export const createTicket = async (payload: { subject: string; message: string; name?: string; email?: string; priority?: string; attachments?: any[]; type?: string }) => {
  // if attachments present, build FormData
  if (payload.attachments && Array.isArray(payload.attachments) && payload.attachments.length > 0) {
    const form = new FormData();
    form.append('subject', payload.subject);
    form.append('message', payload.message);
    if (payload.type) form.append('type', payload.type);
    if (payload.name) form.append('name', payload.name);
    if (payload.email) form.append('email', payload.email);
    if (payload.priority) form.append('priority', payload.priority);
    payload.attachments.forEach((a: any, idx: number) => {
      // a should be { uri, name, type }
      form.append('attachments', { uri: a.uri, name: a.name || `file${idx}`, type: a.type || 'application/octet-stream' } as any);
    });
    // Use fetch for multipart uploads to avoid axios/FormData issues in React Native
    try {
      const url = `${baseURL.replace(/\/$/, '')}/api/tickets`;
      // Prefer secure storage token when available
      let token: string | null | undefined = null;
      try {
        token = await (authStorage as any).getToken();
      } catch (e) { token = await AsyncStorage.getItem('jwtToken'); }
      const headers: any = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const resp = await fetch(url, { method: 'POST', headers, body: form as any });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) throw data || new Error('createTicket upload failed');
      return data;
    } catch (e) {
      // rethrow so callers see the failure
      throw e;
    }
  }
  const body: any = { subject: payload.subject, message: payload.message, name: payload.name, email: payload.email, priority: payload.priority };
  if (payload.type) body.type = payload.type;
  const res = await client.post('/api/tickets', body);
  return res.data;
};

// Reply to an existing ticket (admin <-> user conversation)
export const replyTicket = async (ticketId: string, payload: { message: string; attachments?: any[] }) => {
  // if attachments present, build FormData
  if (payload.attachments && Array.isArray(payload.attachments) && payload.attachments.length > 0) {
    const form = new FormData();
    form.append('message', payload.message);
    payload.attachments.forEach((a: any, idx: number) => {
      form.append('attachments', { uri: a.uri, name: a.name || `file${idx}`, type: a.type || 'application/octet-stream' } as any);
    });
    // Use fetch for multipart uploads to avoid axios/FormData issues in React Native
    try {
      const url = `${baseURL.replace(/\/$/, '')}/api/tickets/${encodeURIComponent(ticketId)}/reply`;
      let token: string | null | undefined = null;
      try {
        token = await (authStorage as any).getToken();
      } catch (e) { token = await AsyncStorage.getItem('jwtToken'); }
      const headers: any = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const resp = await fetch(url, { method: 'POST', headers, body: form as any });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) throw data || new Error('replyTicket upload failed');
      return data;
    } catch (e) {
      throw e;
    }
  }
  const res = await client.post(`/api/tickets/${encodeURIComponent(ticketId)}/reply`, payload);
  return res.data;
};

export const updateTicketStatus = async (ticketId: string, status: string) => {
  const res = await client.patch(`/api/tickets/${encodeURIComponent(ticketId)}/status`, { status });
  return res.data;
};

// Mark tickets as seen/read by the user. The backend may accept a batch request to update
// server-side seen state so support agents see that the user has read admin replies.
// If the backend does not implement this endpoint, callers should catch and ignore errors.
export const markTicketsSeen = async (ticketIds: string[]) => {
  // attempt a batch PUT; fall back to per-ticket patch if necessary
  try {
    const res = await client.put('/api/tickets/seen', { tickets: ticketIds });
    return res.data;
  } catch (e) {
    // try best-effort per-ticket endpoint
    for (const id of ticketIds) {
      try {
        await client.put(`/api/tickets/${encodeURIComponent(id)}/seen`);
      } catch (_) {
        // ignore individual failures
      }
    }
    return null;
  }
};

export const getPreSubmissionsCount = async () => {
  // Avoid calling the API when there is no auth token available (prevents 401/no-op calls)
  try {
    const token = await authStorage.getToken();
    if (!token) return 0;
  } catch (e) {
    return 0;
  }

  // backend returns list; count locally to avoid adding new endpoint
  const data = await getPreSubmissions().catch(() => ({ preSubmissions: [] }));
  const list = data.preSubmissions || data.data || data || [];
  if (!Array.isArray(list)) return 0;
  // count only pending items
  return list.filter((p: any) => (p.status || 'Pending').toString() === 'Pending').length;
};

// Notifications
export const getNotifications = async () => {
  const res = await client.get('/api/notifications/notifications');
  return res.data;
};

export const markNotificationRead = async (id: string) => {
  const res = await client.put(`/api/notifications/${id}/read`);
  return res.data;
};

export const markAllNotificationsRead = async () => {
  const res = await client.put('/api/notifications/readAll');
  return res.data;
};

// Receipts
export const getTransactionReceipt = async (id: string) => {
  const res = await client.get(`/api/transaction/transaction-history/receipt/${id}`);
  return res.data;
};

export const getConfirmationReceipt = async (id: string) => {
  const res = await client.get(`/api/confirmations/receipt/${id}`);
  return res.data;
};

/** Fetch all services (includes exchangeRates: { usd, eur, gbp }) */
export const getServices = async () => {
  const res = await client.get('/api/services');
  return res.data;
};

// ─── KYC ──────────────────────────────────────────────────────────────────────

/** Get the current user's KYC status. */
export const getKYCStatus = async () => {
  const res = await client.get('/api/kyc/status');
  return res.data; // { kyc: { status, idType, idNumber, ... } }
};

/**
 * Submit KYC documents.
 * @param formData  FormData with fields: idType, idNumber, document (file), selfie (file)
 */
export const submitKYC = async (formData: FormData) => {
  const res = await client.post('/api/kyc/submit', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export default client;
