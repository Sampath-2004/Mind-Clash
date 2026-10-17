import crypto from 'crypto';
import {
  ReactionChallengeServer,
  REACTION_MIN_DELAY_MS,
  REACTION_MAX_DELAY_MS,
  REACTION_TIMEOUT_MS,
} from '@mind-clash/shared';

export const REACTION_NETWORK_NOTICE =
  'Online multiplayer reflex times depend on physical network latency (ping) between your device and the server. Reaction rankings are calibrated for competitive fun and casual play, not laboratory millisecond fairness.';

export function generateReactionChallenge(startTime: number): ReactionChallengeServer {
  const waitDelayMs = crypto.randomInt(REACTION_MIN_DELAY_MS, REACTION_MAX_DELAY_MS + 1);
  const targetActivationTime = startTime + waitDelayMs;

  return {
    id: `rx-${Date.now()}-${crypto.randomInt(100, 999)}`,
    waitDelayMs,
    targetActivationTime,
    timeoutMs: REACTION_TIMEOUT_MS,
    triggerTimestamp: targetActivationTime,
    networkNotice: REACTION_NETWORK_NOTICE,
  };
}
