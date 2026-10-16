// Disambiguated room code alphabet (excludes 0, O, 1, I)
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;

// Player & Room limits
export const MIN_PLAYERS_PER_ROOM = 2;
export const MAX_PLAYERS_PER_ROOM = 10;
export const DEFAULT_ROUND_COUNT = 5;
export const MIN_ROUND_COUNT = 3;
export const MAX_ROUND_COUNT = 10;

// Reconnect & Disconnect Grace Timers (ms)
export const RECONNECT_GRACE_PERIOD_MS = 60_000; // 60 seconds
export const HOST_MIGRATION_GRACE_PERIOD_MS = 15_000; // 15 seconds

// Game Timing Defaults (ms)
export const GAME_START_COUNTDOWN_MS = 3_000; // 3, 2, 1, GO!
export const ROUND_INTRO_COUNTDOWN_MS = 3_000; // "Round X: Mode Name"
export const ROUND_RECAP_DURATION_MS = 5_000; // Score reveal + ranking

// Mode-Specific Timing Defaults (ms)
export const TRIVIA_ROUND_DURATION_MS = 12_000;
export const MATH_ROUND_DURATION_MS = 10_000;
export const MEMORY_REVEAL_DURATION_MS = 2_800;
export const MEMORY_INPUT_DURATION_MS = 7_200;
export const REACTION_MIN_DELAY_MS = 2_000;
export const REACTION_MAX_DELAY_MS = 5_000;
export const REACTION_TIMEOUT_MS = 4_000;

// Network tolerance buffer for client-server latency
export const NETWORK_LATENCY_BUFFER_MS = 350;

// Scoring Constants
export const SCORING = {
  TRIVIA: {
    BASE_POINTS: 500,
    MAX_SPEED_BONUS: 500,
  },
  MATH: {
    BASE_POINTS: 500,
    MAX_SPEED_BONUS: 500,
  },
  MEMORY: {
    BASE_POINTS: 400,
    PER_CORRECT_TILE: 100,
    PER_WRONG_TILE_PENALTY: 50,
    ALL_CORRECT_BONUS: 200,
  },
  REACTION: {
    FASTEST_REACTION_POINTS: 1000,
    MIN_POINTS: 200,
    FALSE_START_PENALTY: -200,
  },
} as const;
