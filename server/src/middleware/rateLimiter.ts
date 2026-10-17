import { Socket } from 'socket.io';

interface RateLimitTracker {
  count: number;
  resetTime: number;
}

const socketLimits = new Map<string, RateLimitTracker>();

const WINDOW_MS = 5000; // 5 second window
const MAX_EVENTS_PER_WINDOW = 40; // Max 40 events per 5 seconds per socket

/**
 * Returns true if the socket is within rate limits, or false if rate limit exceeded.
 */
export function checkRateLimit(socket: Socket): boolean {
  const socketId = socket.id;
  const now = Date.now();
  const tracker = socketLimits.get(socketId);

  if (!tracker || now > tracker.resetTime) {
    socketLimits.set(socketId, {
      count: 1,
      resetTime: now + WINDOW_MS,
    });
    return true;
  }

  tracker.count++;
  if (tracker.count > MAX_EVENTS_PER_WINDOW) {
    return false;
  }

  return true;
}

export function cleanupSocketRateLimit(socketId: string) {
  socketLimits.delete(socketId);
}
