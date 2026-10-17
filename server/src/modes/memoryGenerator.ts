import crypto from 'crypto';
import {
  Difficulty,
  MemoryChallengeServer,
  MemorySymbol,
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
  startTime: number = Date.now(),
  difficulty: Difficulty = 'medium'
): MemoryChallengeServer {
  // Sequence length and viewing time scale by Difficulty and Round
  let seqLength: number;
  let viewingDurationMs: number;
  let inputDurationMs: number;
  let gridSize: number;
  let patternCount: number;

  if (difficulty === 'easy') {
    // Easy: shorter sequence, generous viewing time, smaller grid
    seqLength = roundNumber <= 2 ? 3 : 4;
    viewingDurationMs = 3500;
    inputDurationMs = 8000;
    gridSize = 3;
    patternCount = 3;
  } else if (difficulty === 'medium') {
    // Medium: balanced recall challenge
    seqLength = roundNumber <= 2 ? 4 : 5;
    viewingDurationMs = 3000;
    inputDurationMs = MEMORY_INPUT_DURATION_MS;
    gridSize = roundNumber >= 4 ? 4 : 3;
    patternCount = gridSize === 4 ? 5 : 4;
  } else {
    // Hard: longer sequence, fast viewing time, demanding recall
    seqLength = roundNumber <= 2 ? 6 : 7;
    viewingDurationMs = 2400;
    inputDurationMs = 6500;
    gridSize = 4;
    patternCount = 6;
  }

  const sequence: string[] = [];
  const symbolIds = MEMORY_SYMBOLS.map((s) => s.id);

  for (let i = 0; i < seqLength; i++) {
    const randomSymbol = symbolIds[crypto.randomInt(0, symbolIds.length)];
    sequence.push(randomSymbol);
  }

  const viewingEndTime = startTime + viewingDurationMs;

  // Backward-compatible tile matrix solution (achievable on mobile screens)
  const totalTiles = gridSize * gridSize;
  const patternIndices = new Set<number>();
  while (patternIndices.size < patternCount) {
    patternIndices.add(crypto.randomInt(0, totalTiles));
  }
  const tileSolution = Array.from(patternIndices);

  return {
    id: `mem-${difficulty}-r${roundNumber}-${Date.now()}-${crypto.randomInt(100, 999)}`,
    symbols: MEMORY_SYMBOLS,
    sequence,
    solutionSequence: sequence,
    viewingDurationMs,
    inputDurationMs,
    viewingEndTime,
    gridSize,
    pattern: tileSolution,
    solution: tileSolution,
    revealDurationMs: viewingDurationMs,
  };
}
