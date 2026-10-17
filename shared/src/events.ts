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

export interface ReconnectResponseData {
  room: RoomState;
  playerId: string;
  newSessionToken?: string;
  activeChallenge?: ActiveChallengeClient;
  remainingMs?: number;
  roundRecap?: RoundRecapData;
  podiumData?: GameOverPodiumData;
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

  ping_clock: (
    clientTime: number,
    callback: (data: { clientTime: number; serverTime: number }) => void
  ) => void;

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
  submission_acknowledged: (data: { playerId: string }) => void;
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
