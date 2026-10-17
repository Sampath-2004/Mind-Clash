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
  explanation?: string;
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

export interface MemorySymbol {
  id: string; // e.g. 'star', 'diamond', 'flame', 'bolt', 'shield', 'moon'
  label: string; // Textual name for accessibility: 'Star', 'Diamond', 'Flame', etc.
  icon: string; // Emoji / shape identifier: '⭐', '💎', '🔥', '⚡', '🛡️', '🌙'
  colorClass: string;
}

export interface MemoryChallengeClient {
  id: string;
  symbols: MemorySymbol[]; // The symbol palette for reproduction
  sequence: string[]; // Symbol IDs to memorize in order during viewing period
  viewingDurationMs: number; // Server-controlled viewing period in ms
  inputDurationMs: number; // Reproduction time window
  viewingEndTime: number; // Authoritative server timestamp when viewing ends and input unlocks
  gridSize?: number; // Backward compatibility
  pattern?: number[]; // Backward compatibility
  revealDurationMs?: number; // Backward compatibility
}

export interface MemoryChallengeServer extends MemoryChallengeClient {
  solution: number[]; // Backward compatibility
  solutionSequence: string[]; // Authoritative ordered symbol IDs
}

export interface ReactionChallengeClient {
  id: string;
  waitDelayMs: number; // Scheduled delay before target activation
  targetActivationTime: number; // Synchronized server timestamp when target activates
  timeoutMs: number;
  networkNotice: string; // Latency fairness disclosure
}

export interface ReactionChallengeServer extends ReactionChallengeClient {
  triggerTimestamp: number; // Server timestamp when target activates
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
  triviaCorrectText?: string;
  mathCorrectAnswer?: number;
  memorySolution?: number[];
  memorySequence?: string[];
  reactionFastestMs?: number;
  networkNotice?: string;
  explanation?: string;
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
  roundId?: string | null;
  roundStartTime?: number | null;
  roundEndTime?: number | null;
  serverTime?: number;
  lastActivityAt?: number;
}
