import crypto from 'crypto';
import {
  Difficulty,
  ReactionChallengeServer,
  REACTION_MIN_DELAY_MS,
  REACTION_MAX_DELAY_MS,
  REACTION_TIMEOUT_MS,
} from '@mind-clash/shared';

export const REACTION_NETWORK_NOTICE =
  'Online multiplayer reflex times depend on physical network latency (ping) between your device and the server. Reaction rankings are calibrated for competitive fun and casual play, not laboratory millisecond fairness.';

export function generateReactionChallenge(
  startTime: number,
  difficulty: Difficulty = 'medium'
): ReactionChallengeServer {
  let minDelay: number;
  let maxDelay: number;
  let timeoutMs: number;

  if (difficulty === 'easy') {
    minDelay = 2000;
    maxDelay = 3800;
    timeoutMs = 5000; // Generous reflex window
  } else if (difficulty === 'medium') {
    minDelay = REACTION_MIN_DELAY_MS;
    maxDelay = REACTION_MAX_DELAY_MS;
    timeoutMs = REACTION_TIMEOUT_MS; // Standard reflex window
  } else {
    // Hard: Wide unpredictable wait delay window (1.5s - 6.2s) heavily testing impulse control
    minDelay = 1500;
    maxDelay = 6200;
    // 3,000 ms response window - comfortably above normal network latency (100-300ms)
    timeoutMs = 3000;
  }

  const waitDelayMs = crypto.randomInt(minDelay, maxDelay + 1);
  const targetActivationTime = startTime + waitDelayMs;

  return {
    id: `rx-${difficulty}-${Date.now()}-${crypto.randomInt(100, 999)}`,
    waitDelayMs,
    targetActivationTime,
    timeoutMs,
    triggerTimestamp: targetActivationTime,
    networkNotice: REACTION_NETWORK_NOTICE,
  };
}
