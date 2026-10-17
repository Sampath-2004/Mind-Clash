import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents } from '@mind-clash/shared';

// In production, connect directly to the deployed website's origin.
// In development, Vite proxies /socket.io to the backend (or connects to window.location.origin).
// An optional environment variable VITE_BACKEND_URL can override the target origin if needed.
const getSocketUrl = (): string | undefined => {
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return undefined;
};

const socketTarget = getSocketUrl();

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = socketTarget
  ? io(socketTarget, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
    })
  : io({
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
    });
