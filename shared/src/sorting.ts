import { Player } from './types/index.js';

/**
 * Deterministic player comparison function.
 * Ensures completely stable, predictable ranking across server and client:
 * 1. Score (descending)
 * 2. Highest Streak (descending)
 * 3. Total Solved / Accuracy (descending)
 * 4. Fastest Reaction Time (ascending, lower is faster)
 * 5. Lexicographical by nickname (ascending)
 * 6. Unique Player ID (ascending)
 */
export function deterministicPlayerSort(a: Player, b: Player): number {
  if (b.score !== a.score) {
    return b.score - a.score;
  }

  const bStreak = b.stats?.highestStreak ?? 0;
  const aStreak = a.stats?.highestStreak ?? 0;
  if (bStreak !== aStreak) {
    return bStreak - aStreak;
  }

  const aCorrect =
    (a.stats?.triviaCorrect ?? 0) +
    (a.stats?.mathCorrect ?? 0) +
    (a.stats?.memoryPerfectCount ?? 0);
  const bCorrect =
    (b.stats?.triviaCorrect ?? 0) +
    (b.stats?.mathCorrect ?? 0) +
    (b.stats?.memoryPerfectCount ?? 0);
  if (bCorrect !== aCorrect) {
    return bCorrect - aCorrect;
  }

  const aRx = a.stats?.fastestReactionMs ?? 999999;
  const bRx = b.stats?.fastestReactionMs ?? 999999;
  if (aRx !== bRx) {
    return aRx - bRx;
  }

  const nameComp = a.nickname.localeCompare(b.nickname);
  if (nameComp !== 0) return nameComp;

  return a.id.localeCompare(b.id);
}
