import io from 'socket.io-client';
import Constants from 'expo-constants';
import authStorage from './authStorage';
import { getProfile } from '../api/client';

let socket: any = null;
let connected = false;

const extra = (Constants.expoConfig && (Constants.expoConfig as any).extra) || {};
const baseURL = (extra.apiUrl || '').replace(/\/$/, '');

async function initSocket() {
  if (socket && connected) return socket;
  try {
    const token = await authStorage.getToken().catch(() => null);
    // connect (allow unauthenticated read-only connection)
    socket = io(baseURL || '', { transports: ['websocket'], autoConnect: true });
    socket.on('connect', async () => {
      connected = true;
      try {
        // authenticate if token available
        if (token) socket?.emit('authenticate', { token, role: 'user' });
        // try to join a user room for push delivery
        const profile = await getProfile().catch(() => null);
        const userId = profile && (profile._id || profile.id || profile.userId);
        if (userId) socket?.emit('joinRoom', `user_${String(userId)}`);
      } catch (e) {
        // ignore
      }
    });
    socket.on('disconnect', () => { connected = false; });
    socket.on('connect_error', (err: any) => { console.warn('[socket] connect_error', err && err.message); });
    return socket;
  } catch (e) {
    console.warn('Socket init failed', e);
    return socket;
  }
}

function getSocket() {
  return socket;
}

function on(event: string, cb: (...args: any[]) => void) {
  if (!socket) initSocket().then(() => socket?.on(event, cb));
  else socket.on(event, cb);
}

function off(event: string, cb?: (...args: any[]) => void) {
  if (!socket) return;
  if (cb) socket.off(event, cb);
  else socket.removeAllListeners(event);
}

function emit(event: string, payload?: any) {
  if (!socket) return;
  socket.emit(event, payload);
}

export default { initSocket, getSocket, on, off, emit };
