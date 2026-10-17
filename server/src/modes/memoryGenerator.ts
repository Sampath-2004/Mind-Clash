import crypto from 'crypto';
import {
  MemoryChallengeServer,
  MemorySymbol,
  MEMORY_REVEAL_DURATION_MS,
  MEMORY_INPUT_DURATION_MS,
} from '@mind-clash/shared';

export const MEMORY_SYMBOLS: MemorySymbol[] = [
  { id: 'star', label: 'Star', icon: '⭐', colorClass: 'text-amber-400 border-amber-400/50 bg-amber-500/10' },
  { id: 'diamond', label: 'Diamond', icon: '💎', colorClass: 'text-cyan-400 border-cyan-400/50 bg-cyan-500/10' },
  { id: 'flame', label: 'Flame', icon: '🔥', colorClass: 'text-rose-400 border-rose-400/50 bg-rose-500/10' },
  { id: 'bolt', label: 'Lightning', icon: '⚡', colorClass: 'text-yellow-400 border-yellow-400/50 bg-yellow-500/10' },
  { id: 'shield', label: 'Shield', icon: '🛡️', colorClass: 'text-emerald-400 border-emerald-400/50 bg-emerald-500/10' },
  { id: 'moon', label: 'Moon', icon: '🌙', colorClass: 'text-purple-400 border-purple-400/50 bg-purple-500/10' },
];

export function generateMemoryChallenge(
  roundNumber: number,
  startTime: number = Date.now()
): MemoryChallengeServer {
  // Sequence length scales with round number: Round 1-2: 4, Round 3-4: 5, Round 5+: 6
  const seqLength = roundNumber <= 2 ? 4 : roundNumber <= 4 ? 5 : 6;
  const viewingDurationMs = roundNumber <= 2 ? 3000 : roundNumber <= 4 ? 3500 : 4000;
  const inputDurationMs = MEMORY_INPUT_DURATION_MS;

  const sequence: string[] = [];
  const symbolIds = MEMORY_SYMBOLS.map((s) => s.id);

  for (let i = 0; i < seqLength; i++) {
    const randomSymbol = symbolIds[crypto.randomInt(0, symbolIds.length)];
    sequence.push(randomSymbol);
  }

  const viewingEndTime = startTime + viewingDurationMs;

  // Backward-compatible tile matrix solution
  const gridSize = roundNumber >= 4 ? 4 : 3;
  const totalTiles = gridSize * gridSize;
  const patternCount = gridSize === 4 ? 6 : 4;
  const patternIndices = new Set<number>();
  while (patternIndices.size < patternCount) {
    patternIndices.add(crypto.randomInt(0, totalTiles));
  }
  const tileSolution = Array.from(patternIndices);

  return {
    id: `mem-r${roundNumber}-${Date.now()}-${crypto.randomInt(100, 999)}`,
    symbols: MEMORY_SYMBOLS,
    sequence,
    solutionSequence: sequence,
    viewingDurationMs,
    inputDurationMs,
    viewingEndTime,
    gridSize,
    pattern: tileSolution,
    solution: tileSolution,
    revealDurationMs: viewingDurationMs || MEMORY_REVEAL_DURATION_MS,
  };
}
