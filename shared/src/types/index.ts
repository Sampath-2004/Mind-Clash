export type GameMode = 'trivia' | 'math' | 'memory' | 'reaction';

export type RoomStatus =
  | 'LOBBY'
  | 'COUNTDOWN'
  | 'ROUND_INTRO'
  | 'ROUND_ACTIVE'
  | 'ROUND_RECAP'
  | 'GAME_OVER';

export interface PlayerStats {
  triviaCorrect: number;
  triviaTotal: number;
  mathCorrect: number;
  mathTotal: number;
  memoryPerfectCount: number;
  fastestReactionMs: number | null;
  highestStreak: number;
}

export interface Player {
  id: string; // Socket ID (updated upon reconnect)
  sessionToken: string; // Persistent UUID for session recovery
  nickname: string;
  avatar: string; // Avatar icon identifier or emoji
  score: number;
  streak: number;
  isHost: boolean;
  isConnected: boolean;
  disconnectedAt?: number | null;
  stats: PlayerStats;
}

export interface RoomSettings {
  roundCount: number;
  selectedModes: GameMode[];
}

export interface TriviaQuestionClient {
  id: string;
  category: string;
  question: string;
  options: string[];
  durationMs: number;
}

export interface TriviaQuestionServer extends TriviaQuestionClient {
  correctIndex: number;
}

export interface MathQuestionClient {
  id: string;
  prompt: string;
  options: number[];
  durationMs: number;
}

export interface MathQuestionServer extends MathQuestionClient {
  correctAnswer: number;
}

export interface MemoryChallengeClient {
  id: string;
  gridSize: number; // e.g. 3 for 3x3 (9 tiles) or 4 for 4x4 (16 tiles)
  pattern: number[]; // Indices revealed during reveal phase
  revealDurationMs: number;
  inputDurationMs: number;
}

export interface MemoryChallengeServer extends MemoryChallengeClient {
  solution: number[];
}

export interface ReactionChallengeClient {
  id: string;
  waitDelayMs: number; // Scheduled delay before screen changes
  timeoutMs: number;
}

export interface ReactionChallengeServer extends ReactionChallengeClient {
  triggerTimestamp: number; // Server timestamp when green screen triggers
}

export type ActiveChallengeClient =
  | { mode: 'trivia'; challenge: TriviaQuestionClient }
  | { mode: 'math'; challenge: MathQuestionClient }
  | { mode: 'memory'; challenge: MemoryChallengeClient }
  | { mode: 'reaction'; challenge: ReactionChallengeClient };

export interface PlayerRoundResult {
  playerId: string;
  nickname: string;
  avatar: string;
  pointsEarned: number;
  totalScore: number;
  rank: number;
  rankDelta: number; // Position change relative to last round (+1, -2, 0)
  isCorrect: boolean;
  timeSpentMs?: number;
  falseStart?: boolean;
}

export interface RoundRecapData {
  roundNumber: number;
  totalRounds: number;
  mode: GameMode;
  results: PlayerRoundResult[];
  triviaRevealIndex?: number;
  mathCorrectAnswer?: number;
  memorySolution?: number[];
}

export interface FinalGameAccolade {
  title: string;
  description: string;
  playerId: string;
  nickname: string;
  avatar: string;
  value: string;
}

export interface GameOverPodiumData {
  leaderboard: Player[];
  accolades: FinalGameAccolade[];
}

export interface RoomState {
  roomCode: string;
  hostId: string;
  players: Player[];
  status: RoomStatus;
  currentRound: number;
  totalRounds: number;
  activeMode: GameMode | null;
  settings: RoomSettings;
  roundStartTime?: number | null;
  roundEndTime?: number | null;
}
