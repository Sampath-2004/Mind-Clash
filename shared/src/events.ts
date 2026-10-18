import {
  GameMode,
  RoomSettings,
  RoomState,
  Player,
  ActiveChallengeClient,
  RoundRecapData,
  GameOverPodiumData,
} from './types/index.js';

export interface CreateRoomPayload {
  nickname: string;
  avatar: string;
}

export interface JoinRoomPayload {
  roomCode: string;
  nickname: string;
  avatar: string;
}

export interface ReconnectPayload {
  roomCode: string;
  sessionToken: string;
}

export interface SubmitTriviaPayload {
  answerIndex: number;
  clientTimeMs: number;
}

export interface SubmitMathPayload {
  answer: number;
  clientTimeMs: number;
}

export interface SubmitMemoryPayload {
  selectedIndices?: number[];
  sequence?: string[];
  clientTimeMs: number;
}

export interface SubmitReactionPayload {
  clientTimeMs: number;
}

export interface SubmitRareAnswerPayload {
  answer: string;
  clientTimeMs: number;
}

export interface ReconnectResponseData {
  room: RoomState;
  playerId: string;
  newSessionToken?: string;
  activeChallenge?: ActiveChallengeClient;
  remainingMs?: number;
  roundRecap?: RoundRecapData;
  podiumData?: GameOverPodiumData;
  submittedPlayerIds?: string[];
  mySubmittedAnswer?: string;
  isJudging?: boolean;
}

export interface ServerResponseAck<T = undefined> {
  success: boolean;
  data?: T;
  error?: string;
}

// Client to Server Events
export interface ClientToServerEvents {
  create_room: (
    payload: CreateRoomPayload,
    callback: (response: ServerResponseAck<{ roomCode: string; sessionToken: string; playerId: string }>) => void
  ) => void;

  join_room: (
    payload: JoinRoomPayload,
    callback: (response: ServerResponseAck<{ roomCode: string; sessionToken: string; playerId: string }>) => void
  ) => void;

  reconnect_player: (
    payload: ReconnectPayload,
    callback: (response: ServerResponseAck<ReconnectResponseData>) => void
  ) => void;

  update_settings: (
    payload: { settings: Partial<RoomSettings> },
    callback?: (response: ServerResponseAck) => void
  ) => void;

  kick_player: (
    payload: { targetPlayerId: string },
    callback?: (response: ServerResponseAck) => void
  ) => void;

  start_game: (callback?: (response: ServerResponseAck) => void) => void;

  submit_trivia_answer: (
    payload: SubmitTriviaPayload,
    callback?: (response: ServerResponseAck) => void
  ) => void;

  submit_math_answer: (
    payload: SubmitMathPayload,
    callback?: (response: ServerResponseAck) => void
  ) => void;

  submit_memory_tiles: (
    payload: SubmitMemoryPayload,
    callback?: (response: ServerResponseAck) => void
  ) => void;

  submit_reaction_click: (
    payload: SubmitReactionPayload,
    callback?: (response: ServerResponseAck) => void
  ) => void;

  submit_rare_answer: (
    payload: SubmitRareAnswerPayload,
    callback?: (response: ServerResponseAck) => void
  ) => void;

  ping_clock: (
    clientTime: number,
    callback: (data: { clientTime: number; serverTime: number }) => void
  ) => void;

  retry_ai_generation: (callback?: (response: ServerResponseAck) => void) => void;

  use_offline_questions: (callback?: (response: ServerResponseAck) => void) => void;

  cancel_match: (callback?: (response: ServerResponseAck) => void) => void;

  play_again: (callback?: (response: ServerResponseAck) => void) => void;

  return_to_lobby: (callback?: (response: ServerResponseAck) => void) => void;

  leave_room: () => void;
}

// Server to Client Events
export interface ServerToClientEvents {
  room_state_updated: (room: RoomState) => void;
  player_joined: (player: Player) => void;
  player_left: (data: { playerId: string; newHostId?: string }) => void;
  player_disconnected: (playerId: string) => void;
  player_reconnected: (player: Player) => void;
  questions_preparing: (data: { count: number; provider: string; notice?: string }) => void;
  questions_preparation_failed: (data: { error: string; canRetry: boolean; canUseOffline: boolean }) => void;
  game_starting: (data: { countdownMs: number; serverTime: number }) => void;
  round_intro: (data: {
    round: number;
    totalRounds: number;
    mode: GameMode;
    countdownMs: number;
    serverTime: number;
  }) => void;
  round_started: (data: {
    round: number;
    totalRounds: number;
    roundId: string;
    activeChallenge: ActiveChallengeClient;
    startTime: number;
    endTime: number;
    serverTime: number;
  }) => void;
  memory_phase_changed: (data: {
    phase: 'memorize' | 'recall';
    roundId: string;
    inputDurationMs?: number;
    recallStartTime?: number;
    recallEndTime?: number;
    serverTime: number;
  }) => void;
  submission_acknowledged: (data: { playerId: string }) => void;
  rare_answer_judging: (data: { prompt: string; roundNumber: number }) => void;
  round_voided: (data: { reason: string; replacementOffered: boolean }) => void;
  round_recap: (recap: RoundRecapData) => void;
  game_over: (podium: GameOverPodiumData) => void;
  kicked: (data: { reason: string }) => void;
  error_message: (data: { message: string }) => void;
}

export interface SocketData {
  roomCode?: string;
  playerId?: string;
  sessionToken?: string;
}
