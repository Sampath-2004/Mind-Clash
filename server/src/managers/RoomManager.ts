import crypto from 'crypto';
import {
  RoomState,
  Player,
  RoomSettings,
  CreateRoomInput,
  JoinRoomInput,
  ReconnectInput,
  createRoomSchema,
  joinRoomSchema,
  reconnectSchema,
  updateSettingsSchema,
  kickPlayerSchema,
  MAX_PLAYERS_PER_ROOM,
  DEFAULT_ROUND_COUNT,
  RECONNECT_GRACE_PERIOD_MS,
  MIN_ROUND_COUNT,
  MAX_ROUND_COUNT,
} from '@mind-clash/shared';
import { generateUniqueRoomCode } from '../utils/codeGenerator.js';

export class RoomManager {
  private rooms = new Map<string, RoomState>();
  private socketToRoom = new Map<string, string>(); // socketId -> roomCode
  private sessionToPlayer = new Map<string, { roomCode: string; playerId: string }>(); // sessionToken -> player info
  private disconnectTimers = new Map<string, NodeJS.Timeout>(); // sessionToken -> timer

  constructor() {}

  /**
   * Retrieves an active room by code.
   */
  public getRoom(roomCode: string): RoomState | undefined {
    return this.rooms.get(roomCode.toUpperCase());
  }

  /**
   * Gets the room a socket currently belongs to.
   */
  public getRoomBySocketId(socketId: string): RoomState | undefined {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return undefined;
    return this.rooms.get(roomCode);
  }

  /**
   * Creates a new room with the calling client as host.
   */
  public createRoom(
    socketId: string,
    rawInput: CreateRoomInput
  ): { room: RoomState; player: Player; sessionToken: string } {
    // 1. Validate input with Zod
    const input = createRoomSchema.parse(rawInput);

    // 2. Generate cryptographically unique room code
    const roomCode = generateUniqueRoomCode((code) => this.rooms.has(code));

    // 3. Generate secure session recovery token
    const sessionToken = crypto.randomUUID();

    const hostPlayer: Player = {
      id: socketId,
      sessionToken,
      nickname: input.nickname.trim(),
      avatar: input.avatar,
      score: 0,
      streak: 0,
      isHost: true,
      isConnected: true,
      stats: {
        triviaCorrect: 0,
        triviaTotal: 0,
        mathCorrect: 0,
        mathTotal: 0,
        memoryPerfectCount: 0,
        fastestReactionMs: null,
        highestStreak: 0,
      },
    };

    const initialSettings: RoomSettings = {
      roundCount: DEFAULT_ROUND_COUNT,
      selectedModes: ['trivia', 'math', 'memory', 'reaction'],
    };

    const room: RoomState = {
      roomCode,
      hostId: socketId,
      players: [hostPlayer],
      status: 'LOBBY',
      currentRound: 1,
      totalRounds: DEFAULT_ROUND_COUNT,
      activeMode: 'trivia',
      settings: initialSettings,
    };

    this.rooms.set(roomCode, room);
    this.socketToRoom.set(socketId, roomCode);
    this.sessionToPlayer.set(sessionToken, { roomCode, playerId: socketId });

    return { room, player: hostPlayer, sessionToken };
  }

  /**
   * Joins an existing room.
   */
  public joinRoom(
    socketId: string,
    rawInput: JoinRoomInput
  ): { room: RoomState; player: Player; sessionToken: string } {
    // 1. Validate payload
    const input = joinRoomSchema.parse(rawInput);
    const roomCode = input.roomCode.toUpperCase();

    const room = this.rooms.get(roomCode);
    if (!room) {
      throw new Error(`Room "${roomCode}" does not exist or has expired`);
    }

    if (room.status !== 'LOBBY') {
      throw new Error('Match is already in progress');
    }

    if (room.players.length >= MAX_PLAYERS_PER_ROOM) {
      throw new Error(`Room is full (max ${MAX_PLAYERS_PER_ROOM} players)`);
    }

    // Check duplicate nickname in active room
    const nameTaken = room.players.some(
      (p) => p.nickname.toLowerCase() === input.nickname.trim().toLowerCase()
    );
    if (nameTaken) {
      throw new Error(`Nickname "${input.nickname}" is already in use in this room`);
    }

    const sessionToken = crypto.randomUUID();

    const newPlayer: Player = {
      id: socketId,
      sessionToken,
      nickname: input.nickname.trim(),
      avatar: input.avatar,
      score: 0,
      streak: 0,
      isHost: false,
      isConnected: true,
      stats: {
        triviaCorrect: 0,
        triviaTotal: 0,
        mathCorrect: 0,
        mathTotal: 0,
        memoryPerfectCount: 0,
        fastestReactionMs: null,
        highestStreak: 0,
      },
    };

    room.players.push(newPlayer);
    this.socketToRoom.set(socketId, roomCode);
    this.sessionToPlayer.set(sessionToken, { roomCode, playerId: socketId });

    return { room, player: newPlayer, sessionToken };
  }

  /**
   * Reconnects an existing player using their session token.
   */
  public reconnectPlayer(
    newSocketId: string,
    rawInput: ReconnectInput
  ): { room: RoomState; player: Player } {
    const input = reconnectSchema.parse(rawInput);
    const roomCode = input.roomCode.toUpperCase();
    const room = this.rooms.get(roomCode);

    if (!room) {
      throw new Error(`Room "${roomCode}" does not exist`);
    }

    const player = room.players.find((p) => p.sessionToken === input.sessionToken);
    if (!player) {
      throw new Error('Session token not recognized or grace period expired');
    }

    // Cancel pending disconnect removal timer if any
    const pendingTimer = this.disconnectTimers.get(player.sessionToken);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      this.disconnectTimers.delete(player.sessionToken);
    }

    // Clean old socket mapping
    this.socketToRoom.delete(player.id);

    // Update player socket ID and connectivity
    player.id = newSocketId;
    player.isConnected = true;
    player.disconnectedAt = null;

    // If room host was disconnected, this player remains host or resumes host if room.hostId matches
    if (room.hostId === player.id || player.isHost) {
      room.hostId = newSocketId;
      player.isHost = true;
    }

    this.socketToRoom.set(newSocketId, roomCode);
    this.sessionToPlayer.set(player.sessionToken, { roomCode, playerId: newSocketId });

    return { room, player };
  }

  /**
   * Explicit player leave.
   */
  public leaveRoom(socketId: string): {
    room?: RoomState;
    player?: Player;
    newHostId?: string;
    roomDestroyed: boolean;
  } {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return { roomDestroyed: false };

    const room = this.rooms.get(roomCode);
    if (!room) return { roomDestroyed: false };

    const playerIndex = room.players.findIndex((p) => p.id === socketId);
    if (playerIndex === -1) return { roomDestroyed: false };

    const [leavingPlayer] = room.players.splice(playerIndex, 1);
    this.socketToRoom.delete(socketId);
    this.sessionToPlayer.delete(leavingPlayer.sessionToken);

    // Clean disconnect timer if any
    const timer = this.disconnectTimers.get(leavingPlayer.sessionToken);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(leavingPlayer.sessionToken);
    }

    // If room is now empty, destroy room immediately
    if (room.players.length === 0) {
      this.rooms.delete(roomCode);
      return { roomDestroyed: true, player: leavingPlayer };
    }

    // If leaving player was host, migrate host to first connected player
    let newHostId: string | undefined;
    if (leavingPlayer.isHost) {
      const nextHost = room.players.find((p) => p.isConnected) || room.players[0];
      if (nextHost) {
        nextHost.isHost = true;
        room.hostId = nextHost.id;
        newHostId = nextHost.id;
      }
    }

    return { room, player: leavingPlayer, newHostId, roomDestroyed: false };
  }

  /**
   * Handles unexpected socket disconnection.
   * Keeps player slot open for RECONNECT_GRACE_PERIOD_MS (60s).
   * Migrates host if the host is disconnected.
   */
  public handleDisconnect(socketId: string): {
    room?: RoomState;
    player?: Player;
    newHostId?: string;
  } {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return {};

    const room = this.rooms.get(roomCode);
    if (!room) return {};

    const player = room.players.find((p) => p.id === socketId);
    if (!player) return {};

    player.isConnected = false;
    player.disconnectedAt = Date.now();

    // If disconnected player was host, migrate host to next connected player so lobby doesn't hang
    let newHostId: string | undefined;
    if (player.isHost) {
      const activePlayer = room.players.find((p) => p.isConnected && p.id !== player.id);
      if (activePlayer) {
        player.isHost = false;
        activePlayer.isHost = true;
        room.hostId = activePlayer.id;
        newHostId = activePlayer.id;
      }
    }

    // Schedule player purge after grace period
    const graceTimer = setTimeout(() => {
      this.purgeDisconnectedPlayer(roomCode, player.sessionToken);
    }, RECONNECT_GRACE_PERIOD_MS);

    this.disconnectTimers.set(player.sessionToken, graceTimer);

    return { room, player, newHostId };
  }

  /**
   * Removes disconnected player after grace period has expired.
   */
  private purgeDisconnectedPlayer(roomCode: string, sessionToken: string) {
    this.disconnectTimers.delete(sessionToken);
    const room = this.rooms.get(roomCode);
    if (!room) return;

    const idx = room.players.findIndex((p) => p.sessionToken === sessionToken);
    if (idx !== -1) {
      const [purged] = room.players.splice(idx, 1);
      this.socketToRoom.delete(purged.id);
      this.sessionToPlayer.delete(sessionToken);

      // Destroy room if all players are gone
      if (room.players.length === 0) {
        this.rooms.delete(roomCode);
      } else if (purged.isHost) {
        const nextHost = room.players.find((p) => p.isConnected) || room.players[0];
        if (nextHost) {
          nextHost.isHost = true;
          room.hostId = nextHost.id;
        }
      }
    }
  }

  /**
   * Kicks a player (Host only).
   */
  public kickPlayer(
    hostSocketId: string,
    rawInput: { targetPlayerId: string }
  ): { room: RoomState; kickedPlayer: Player } {
    const input = kickPlayerSchema.parse(rawInput);
    const room = this.getRoomBySocketId(hostSocketId);

    if (!room) {
      throw new Error('Host is not in a room');
    }

    if (room.hostId !== hostSocketId) {
      throw new Error('Only the room host has permission to kick players');
    }

    if (input.targetPlayerId === hostSocketId) {
      throw new Error('Host cannot kick themselves');
    }

    const idx = room.players.findIndex((p) => p.id === input.targetPlayerId);
    if (idx === -1) {
      throw new Error('Target player not found in room');
    }

    const [kickedPlayer] = room.players.splice(idx, 1);
    this.socketToRoom.delete(kickedPlayer.id);
    this.sessionToPlayer.delete(kickedPlayer.sessionToken);

    return { room, kickedPlayer };
  }

  /**
   * Updates room settings (Host only).
   */
  public updateSettings(
    hostSocketId: string,
    rawInput: { settings: Partial<RoomSettings> }
  ): RoomState {
    const { settings: newSettings } = updateSettingsSchema.parse(rawInput);
    const room = this.getRoomBySocketId(hostSocketId);

    if (!room) {
      throw new Error('Room not found');
    }

    if (room.hostId !== hostSocketId) {
      throw new Error('Only the host can modify room settings');
    }

    if (newSettings.roundCount !== undefined) {
      const clamped = Math.max(
        MIN_ROUND_COUNT,
        Math.min(MAX_ROUND_COUNT, newSettings.roundCount)
      );
      room.settings.roundCount = clamped;
      room.totalRounds = clamped;
    }

    if (newSettings.selectedModes && newSettings.selectedModes.length > 0) {
      room.settings.selectedModes = newSettings.selectedModes;
    }

    return room;
  }

  /**
   * Reset / cleanup for tests and graceful shutdown.
   */
  public clearAll() {
    this.disconnectTimers.forEach((timer) => clearTimeout(timer));
    this.disconnectTimers.clear();
    this.rooms.clear();
    this.socketToRoom.clear();
    this.sessionToPlayer.clear();
  }
}

export const roomManager = new RoomManager();
