import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { httpServer, io } from '../src/index.js';
import { io as Client, Socket } from 'socket.io-client';
import { AddressInfo } from 'net';
import { roomManager } from '../src/managers/RoomManager.js';
import { getGameEngine } from '../src/socket/roomHandlers.js';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  Player,
  deterministicPlayerSort,
  RoomState,
} from '@mind-clash/shared';

type TestSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

function ensureConnected(socket: TestSocket): Promise<void> {
  if (socket.connected) return Promise.resolve();
  return new Promise<void>((resolve) => {
    socket.once('connect', () => resolve());
  });
}

function waitForEvent<T>(
  socket: TestSocket,
  eventName: keyof ServerToClientEvents,
  timeoutMs = 8000
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`waitForEvent('${String(eventName)}') timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const handler = (data: unknown) => {
      clearTimeout(timer);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socket.off(eventName as any, handler as any);
      resolve(data as T);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.on(eventName as any, handler as any);
  });
}

describe('Phase 7: Complete Game Progression, Deterministic Ties, Rematches & Permissions Tests', () => {
  let port: number;
  const connectedSockets: TestSocket[] = [];

  const createClientSocket = (): TestSocket => {
    const socket = Client(`http://localhost:${port}`, {
      transports: ['websocket'],
      forceNew: true,
      autoConnect: true,
    }) as TestSocket;
    connectedSockets.push(socket);
    return socket;
  };

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        port = (httpServer.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    connectedSockets.forEach((s) => {
      if (s.connected) s.disconnect();
    });
    const engine = getGameEngine();
    if (engine) engine.clearAll();
    roomManager.clearAll();
    io.close();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  it('1. Deterministic Tie Handling: multi-tier tie-breakers produce stable, reproducible rankings', () => {
    const baseStats = {
      triviaCorrect: 2,
      triviaTotal: 3,
      mathCorrect: 2,
      mathTotal: 2,
      memoryPerfectCount: 1,
      fastestReactionMs: 250,
      highestStreak: 3,
    };

    // Tier 1: Different points
    const pHigh: Player = {
      id: 'p-1',
      sessionToken: 't-1',
      nickname: 'HighScorer',
      avatar: 'cyber-brain',
      score: 1500,
      streak: 2,
      isHost: false,
      isConnected: true,
      stats: { ...baseStats },
    };

    const pLow: Player = {
      id: 'p-2',
      sessionToken: 't-2',
      nickname: 'LowScorer',
      avatar: 'plasma-dragon',
      score: 1200,
      streak: 2,
      isHost: false,
      isConnected: true,
      stats: { ...baseStats },
    };

    expect(deterministicPlayerSort(pHigh, pLow)).toBeLessThan(0);
    expect(deterministicPlayerSort(pLow, pHigh)).toBeGreaterThan(0);

    // Tier 2: Same points, different streak tie-breaker
    const pTiedStreak4: Player = {
      ...pHigh,
      id: 'p-3',
      nickname: 'Streak4Player',
      score: 1000,
      stats: { ...baseStats, highestStreak: 4 },
    };
    const pTiedStreak2: Player = {
      ...pHigh,
      id: 'p-4',
      nickname: 'Streak2Player',
      score: 1000,
      stats: { ...baseStats, highestStreak: 2 },
    };
    expect(deterministicPlayerSort(pTiedStreak4, pTiedStreak2)).toBeLessThan(0);

    // Tier 3: Same points and streak, different accuracy / total solved
    const pTiedAccHigher: Player = {
      ...pHigh,
      id: 'p-5',
      nickname: 'AccHigh',
      score: 1000,
      stats: { ...baseStats, highestStreak: 3, triviaCorrect: 4 },
    };
    const pTiedAccLower: Player = {
      ...pHigh,
      id: 'p-6',
      nickname: 'AccLow',
      score: 1000,
      stats: { ...baseStats, highestStreak: 3, triviaCorrect: 1 },
    };
    expect(deterministicPlayerSort(pTiedAccHigher, pTiedAccLower)).toBeLessThan(0);

    // Tier 4: Same points, streak, and accuracy, faster reaction time wins
    const pTiedFastRx: Player = {
      ...pHigh,
      id: 'p-7',
      nickname: 'FastRx',
      score: 1000,
      stats: { ...baseStats, fastestReactionMs: 180 },
    };
    const pTiedSlowRx: Player = {
      ...pHigh,
      id: 'p-8',
      nickname: 'SlowRx',
      score: 1000,
      stats: { ...baseStats, fastestReactionMs: 340 },
    };
    expect(deterministicPlayerSort(pTiedFastRx, pTiedSlowRx)).toBeLessThan(0);

    // Tier 5: Exactly identical points and stats, alphabetical by nickname breaks tie deterministically
    const pAlphaA: Player = {
      ...pHigh,
      id: 'p-9',
      nickname: 'AlphaPlayer',
      score: 1000,
      stats: { ...baseStats },
    };
    const pAlphaZ: Player = {
      ...pHigh,
      id: 'p-10',
      nickname: 'ZetaPlayer',
      score: 1000,
      stats: { ...baseStats },
    };
    expect(deterministicPlayerSort(pAlphaA, pAlphaZ)).toBeLessThan(0);
    expect(deterministicPlayerSort(pAlphaZ, pAlphaA)).toBeGreaterThan(0);
  });

  it('2. Privileged Actions & Permissions: Server strictly enforces host authorization', async () => {
    const host = createClientSocket();
    const guest = createClientSocket();
    await Promise.all([ensureConnected(host), ensureConnected(guest)]);

    const createRes = await new Promise<{
      success: boolean;
      data?: { roomCode: string };
    }>((resolve) => {
      host.emit('create_room', { nickname: 'TrueHost', avatar: 'cyber-brain' }, resolve);
    });
    const roomCode = createRes.data!.roomCode;

    await new Promise<{ success: boolean }>((resolve) => {
      guest.emit('join_room', { roomCode, nickname: 'RegularGuest', avatar: 'plasma-dragon' }, resolve);
    });

    // 1. Host can successfully update room settings to 15 rounds
    const hostUpdateRes = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      host.emit(
        'update_settings',
        { settings: { roundCount: 15, selectedModes: ['trivia', 'math', 'reaction'] } },
        resolve
      );
    });
    expect(hostUpdateRes.success).toBe(true);

    const room = roomManager.getRoom(roomCode)!;
    expect(room.settings.roundCount).toBe(15);
    expect(room.totalRounds).toBe(15);
    expect(room.settings.selectedModes).toEqual(['trivia', 'math', 'reaction']);

    // 2. Non-host attempts update_settings -> Strictly REJECTED
    const guestUpdateRes = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      guest.emit('update_settings', { settings: { roundCount: 5 } }, resolve);
    });
    expect(guestUpdateRes.success).toBe(false);
    expect(guestUpdateRes.error).toMatch(/Only the host/i);

    // 3. Non-host attempts start_game -> Strictly REJECTED
    const guestStartRes = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      guest.emit('start_game', resolve);
    });
    expect(guestStartRes.success).toBe(false);
    expect(guestStartRes.error).toMatch(/Only the host/i);

    // 4. Non-host attempts kick_player -> Strictly REJECTED
    const guestKickRes = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      guest.emit('kick_player', { targetPlayerId: host.id! }, resolve);
    });
    expect(guestKickRes.success).toBe(false);
    expect(guestKickRes.error).toMatch(/Only the room host/i);

    // 5. Non-host attempts play_again -> Strictly REJECTED
    const guestRematchRes = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      guest.emit('play_again', resolve);
    });
    expect(guestRematchRes.success).toBe(false);
    expect(guestRematchRes.error).toMatch(/Only the host/i);

    // 6. Non-host attempts return_to_lobby -> Strictly REJECTED
    const guestReturnRes = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      guest.emit('return_to_lobby', resolve);
    });
    expect(guestReturnRes.success).toBe(false);
    expect(guestReturnRes.error).toMatch(/Only the host/i);
  });

  it('3. Host Changes / Migration: Promotes new host upon disconnection, granting privileged actions', async () => {
    const host1 = createClientSocket();
    const guest1 = createClientSocket();
    const guest2 = createClientSocket();
    await Promise.all([
      ensureConnected(host1),
      ensureConnected(guest1),
      ensureConnected(guest2),
    ]);

    const createRes = await new Promise<{
      success: boolean;
      data?: { roomCode: string };
    }>((resolve) => {
      host1.emit('create_room', { nickname: 'InitialHost', avatar: 'cyber-brain' }, resolve);
    });
    const roomCode = createRes.data!.roomCode;

    await new Promise<{ success: boolean }>((resolve) => {
      guest1.emit('join_room', { roomCode, nickname: 'PromotedCandidate', avatar: 'astro-bot' }, resolve);
    });
    await new Promise<{ success: boolean }>((resolve) => {
      guest2.emit('join_room', { roomCode, nickname: 'SecondGuest', avatar: 'hyper-fox' }, resolve);
    });

    const room = roomManager.getRoom(roomCode)!;
    expect(room.hostId).toBe(host1.id);

    // Host 1 explicitly leaves or disconnects
    const hostLeftPromise = waitForEvent<{ newHostId?: string }>(guest1, 'player_left', 4000);
    host1.emit('leave_room');
    const leaveData = await hostLeftPromise;

    // Verify host migration
    expect(leaveData.newHostId).toBe(guest1.id);
    expect(room.hostId).toBe(guest1.id);
    const promotedPlayer = room.players.find((p) => p.id === guest1.id)!;
    expect(promotedPlayer.isHost).toBe(true);

    // The newly promoted host can now successfully update settings
    const newHostUpdate = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      guest1.emit(
        'update_settings',
        { settings: { roundCount: 10, selectedModes: ['math', 'memory'] } },
        resolve
      );
    });
    expect(newHostUpdate.success).toBe(true);
    expect(room.settings.roundCount).toBe(10);
    expect(room.settings.selectedModes).toEqual(['math', 'memory']);

    // The newly promoted host can start the game
    const startRes = await new Promise<{ success: boolean }>((resolve) => {
      guest1.emit('start_game', resolve);
    });
    expect(startRes.success).toBe(true);
    expect(room.status).toBe('COUNTDOWN');
  });

  it('4. Rematches & Return to Lobby: Preserves player roster while resetting scores, stats, rounds, and timers', async () => {
    const host = createClientSocket();
    const player2 = createClientSocket();
    await Promise.all([ensureConnected(host), ensureConnected(player2)]);

    const createRes = await new Promise<{
      success: boolean;
      data?: { roomCode: string };
    }>((resolve) => {
      host.emit('create_room', { nickname: 'RematchHost', avatar: 'solar-phoenix' }, resolve);
    });
    const roomCode = createRes.data!.roomCode;

    await new Promise<{ success: boolean }>((resolve) => {
      player2.emit('join_room', { roomCode, nickname: 'RematchChallenger', avatar: 'void-ninja' }, resolve);
    });

    const room = roomManager.getRoom(roomCode)!;
    room.settings.roundCount = 5;

    // Simulate active game state with scores, streaks, and match stats
    room.status = 'GAME_OVER';
    room.currentRound = 5;
    room.roundId = 'r-5-final';
    room.roundStartTime = Date.now() - 10000;
    room.roundEndTime = Date.now() - 1000;
    room.activeMode = 'reaction';

    room.players[0].score = 2400;
    room.players[0].streak = 4;
    room.players[0].stats = {
      triviaCorrect: 2,
      triviaTotal: 2,
      mathCorrect: 1,
      mathTotal: 1,
      memoryPerfectCount: 1,
      fastestReactionMs: 210,
      highestStreak: 4,
    };

    room.players[1].score = 1850;
    room.players[1].streak = 2;
    room.players[1].stats = {
      triviaCorrect: 1,
      triviaTotal: 2,
      mathCorrect: 1,
      mathTotal: 1,
      memoryPerfectCount: 0,
      fastestReactionMs: 290,
      highestStreak: 2,
    };

    const lobbyUpdatedPromise = waitForEvent<RoomState>(player2, 'room_state_updated', 4000);

    // Host triggers return_to_lobby
    const returnRes = await new Promise<{ success: boolean }>((resolve) => {
      host.emit('return_to_lobby', resolve);
    });
    expect(returnRes.success).toBe(true);

    const updatedRoom = await lobbyUpdatedPromise;

    // VERIFY ROSTER IS PRESERVED
    expect(updatedRoom.players).toHaveLength(2);
    expect(updatedRoom.players.map((p) => p.nickname)).toContain('RematchHost');
    expect(updatedRoom.players.map((p) => p.nickname)).toContain('RematchChallenger');

    // VERIFY ALL MATCH STATE & TIMERS ARE CLEANLY RESET
    expect(updatedRoom.status).toBe('LOBBY');
    expect(updatedRoom.currentRound).toBe(1);
    expect(updatedRoom.roundId).toBeNull();
    expect(updatedRoom.roundStartTime).toBeNull();
    expect(updatedRoom.roundEndTime).toBeNull();
    expect(updatedRoom.activeMode).toBeNull();

    // Scores & streaks reset to 0
    expect(updatedRoom.players[0].score).toBe(0);
    expect(updatedRoom.players[0].streak).toBe(0);
    expect(updatedRoom.players[1].score).toBe(0);
    expect(updatedRoom.players[1].streak).toBe(0);

    // Stats reset to 0 for a clean new clash
    expect(updatedRoom.players[0].stats.triviaCorrect).toBe(0);
    expect(updatedRoom.players[0].stats.fastestReactionMs).toBeNull();
    expect(updatedRoom.players[0].stats.highestStreak).toBe(0);
    expect(updatedRoom.players[1].stats.triviaCorrect).toBe(0);
    expect(updatedRoom.players[1].stats.fastestReactionMs).toBeNull();

    // Test play_again from host triggers same clean reset
    updatedRoom.players[0].score = 500;
    const playAgainRes = await new Promise<{ success: boolean }>((resolve) => {
      host.emit('play_again', resolve);
    });
    expect(playAgainRes.success).toBe(true);
    expect(room.players[0].score).toBe(0);
    expect(room.status).toBe('LOBBY');
  });

  it('5. Randomized Mode Rotation: fair distribution across selected modes', () => {
    const engine = getGameEngine()!;
    const selectedModes = ['trivia', 'math', 'memory', 'reaction'] as const;

    const schedule = engine.generateModeSchedule(15, [...selectedModes]);
    expect(schedule).toHaveLength(15);

    // Check that all selected modes appear
    for (const m of selectedModes) {
      expect(schedule.filter((x) => x === m).length).toBeGreaterThanOrEqual(3);
    }

    // Check single mode selection returns uniform array
    const singleSchedule = engine.generateModeSchedule(10, ['trivia']);
    expect(singleSchedule).toHaveLength(10);
    expect(singleSchedule.every((m) => m === 'trivia')).toBe(true);
  });
});
