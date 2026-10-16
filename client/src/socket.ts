import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents } from '@mind-clash/shared';

// In development, Vite proxies /socket.io to the backend (http://localhost:3001)
// In production, when Express serves the static client, same-origin works automatically.
// An optional environment variable VITE_BACKEND_URL can override this if needed.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(BACKEND_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  transports: ['websocket', 'polling'],
});
