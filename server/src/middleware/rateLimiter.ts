import { Socket } from 'socket.io';

export type RateLimitCategory = 'room_action' | 'gameplay_action' | 'general';

interface RateLimitTracker {
  count: number;
  resetTime: number;
}

interface TierConfig {
  windowMs: number;
  maxEvents: number;
}

const TIER_CONFIGS: Record<RateLimitCategory, TierConfig> = {
  room_action: {
    windowMs: 10_000, // 10 seconds
    maxEvents: 8,     // max 8 room create/join/reconnect attempts per 10s
  },
  gameplay_action: {
    windowMs: 5_000,  // 5 seconds
    maxEvents: 15,    // max 15 submissions per 5s
  },
  general: {
    windowMs: 5_000,  // 5 seconds
    maxEvents: 50,    // max 50 clock pings/general actions per 5s
  },
};

// socketId -> category -> RateLimitTracker
const socketTrackers = new Map<string, Map<RateLimitCategory, RateLimitTracker>>();

/**
 * Returns true if the socket is within rate limits for the given category,
 * or false if the rate limit has been exceeded.
 */
export function checkRateLimit(
  socket: Socket,
  category: RateLimitCategory = 'general'
): boolean {
  const socketId = socket.id;
  const now = Date.now();
  const config = TIER_CONFIGS[category];

  let clientCategories = socketTrackers.get(socketId);
  if (!clientCategories) {
    clientCategories = new Map<RateLimitCategory, RateLimitTracker>();
    socketTrackers.set(socketId, clientCategories);
  }

  const tracker = clientCategories.get(category);

  if (!tracker || now > tracker.resetTime) {
    clientCategories.set(category, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return true;
  }

  tracker.count++;
  if (tracker.count > config.maxEvents) {
    return false;
  }

  return true;
}

/**
 * Clean up rate limit state when a socket disconnects to prevent memory leaks.
 */
export function cleanupSocketRateLimit(socketId: string): void {
  socketTrackers.delete(socketId);
}

/**
 * Reset all rate limit trackers (used primarily in test suites).
 */
export function resetRateLimits(): void {
  socketTrackers.clear();
}
