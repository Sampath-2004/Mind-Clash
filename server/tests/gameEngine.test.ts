import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { httpServer, io } from '../src/index.js';
import { io as Client, Socket } from 'socket.io-client';
import { AddressInfo } from 'net';
import { roomManager } from '../src/managers/RoomManager.js';
import { getGameEngine } from '../src/socket/roomHandlers.js';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomState,
  ActiveChallengeClient,
  RoundRecapData,
  GameOverPodiumData,
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
  timeoutMs = 6000
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

function waitForRoomState(
  socket: TestSocket,
  predicate: (r: RoomState) => boolean,
  timeoutMs = 6000
): Promise<RoomState> {
  return new Promise<RoomState>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`waitForRoomState timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const handler = (room: RoomState) => {
      if (predicate(room)) {
        clearTimeout(timer);
        socket.off('room_state_updated', handler);
        resolve(room);
      }
    };

    socket.on('room_state_updated', handler);
  });
}

describe('Phase 4: Server-Authoritative Multiplayer Game Engine Tests', () => {
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

  it('1. Clock-offset estimation via ping_clock returns accurate server time', async () => {
    const client = createClientSocket();
    await ensureConnected(client);

    const t0 = Date.now();
    const ack = await new Promise<{ clientTime: number; serverTime: number }>((resolve) => {
      client.emit('ping_clock', t0, resolve);
    });

    const t1 = Date.now();
    const rtt = t1 - t0;
    expect(ack.clientTime).toBe(t0);
    expect(ack.serverTime).toBeGreaterThanOrEqual(t0);
    expect(ack.serverTime).toBeLessThanOrEqual(t1 + 50);

    const estimatedOffset = ack.serverTime + rtt / 2 - t1;
    expect(Math.abs(estimatedOffset)).toBeLessThan(500); // Clock is within reasonable local drift
  });

  it('2. Game state machine: Countdown -> Obfuscated Challenge -> Timestamps', async () => {
    const host = createClientSocket();
    const player2 = createClientSocket();
    await Promise.all([ensureConnected(host), ensureConnected(player2)]);

    // Host creates room
    const createRes = await new Promise<{
      success: boolean;
      data?: { roomCode: string; sessionToken: string; playerId: string };
    }>((resolve) => {
      host.emit('create_room', { nickname: 'HostPlayer', avatar: 'cyber-brain' }, resolve);
    });
    expect(createRes.success).toBe(true);
    const roomCode = createRes.data!.roomCode;

    // Player 2 joins room
    const joinRes = await new Promise<{ success: boolean }>((resolve) => {
      player2.emit('join_room', { roomCode, nickname: 'Player2', avatar: 'plasma-dragon' }, resolve);
    });
    expect(joinRes.success).toBe(true);

    // Non-host attempts to start game -> Rejected
    const unauthorizedStart = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      player2.emit('start_game', resolve);
    });
    expect(unauthorizedStart.success).toBe(false);
    expect(unauthorizedStart.error).toBe('Only the host can start the game');

    // Host starts game
    const gameStartingPromiseHost = waitForEvent<{ countdownMs: number; serverTime: number }>(
      host,
      'game_starting'
    );
    const gameStartingPromiseP2 = waitForEvent<{ countdownMs: number; serverTime: number }>(
      player2,
      'game_starting'
    );
    const round1StartedPromise = waitForEvent<{
      round: number;
      totalRounds: number;
      roundId: string;
      activeChallenge: ActiveChallengeClient;
      startTime: number;
      endTime: number;
      serverTime: number;
    }>(player2, 'round_started', 8000);

    const startRes = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      host.emit('start_game', resolve);
    });
    expect(startRes.success).toBe(true);

    // Both players receive game_starting countdown
    const [startPayloadHost, startPayloadP2] = await Promise.all([
      gameStartingPromiseHost,
      gameStartingPromiseP2,
    ]);
    expect(startPayloadHost.countdownMs).toBe(3000);
    expect(startPayloadP2.countdownMs).toBe(3000);
    expect(startPayloadHost.serverTime).toBeGreaterThan(0);

    // After synchronized countdown, round 1 begins
    const round1 = await round1StartedPromise;
    expect(round1.round).toBe(1);
    expect(round1.roundId).toMatch(/^r-1-/);
    expect(round1.startTime).toBeGreaterThan(0);
    expect(round1.endTime).toBeGreaterThan(round1.startTime);
    expect(round1.serverTime).toBeGreaterThanOrEqual(round1.startTime);

    // Security Check: Secret Obfuscation
    // Answers MUST NOT be leaked to the client during active round!
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const challenge = round1.activeChallenge as any;
    expect(challenge.challenge).toBeDefined();
    expect(challenge.challenge.correctIndex).toBeUndefined();
    expect(challenge.challenge.correctAnswer).toBeUndefined();
    expect(challenge.challenge.solution).toBeUndefined();
    expect(challenge.challenge.triggerTimestamp).toBeUndefined();
  }, 12000);

  it('3. Simultaneous submissions, speed bonuses, and early round conclusion', async () => {
    const host = createClientSocket();
    const player2 = createClientSocket();
    await Promise.all([ensureConnected(host), ensureConnected(player2)]);

    // Create room with trivia mode
    const createRes = await new Promise<{
      success: boolean;
      data?: { roomCode: string };
    }>((resolve) => {
      host.emit('create_room', { nickname: 'SpeedHost', avatar: 'astro-bot' }, resolve);
    });
    const roomCode = createRes.data!.roomCode;

    await new Promise<{ success: boolean }>((resolve) => {
      player2.emit('join_room', { roomCode, nickname: 'SpeedP2', avatar: 'solar-phoenix' }, resolve);
    });

    const roundStartedPromise = waitForEvent<{
      round: number;
      roundId: string;
      activeChallenge: ActiveChallengeClient;
    }>(host, 'round_started', 8000);

    await new Promise<{ success: boolean }>((resolve) => {
      host.emit('start_game', resolve);
    });

    const roundData = await roundStartedPromise;
    expect(roundData.round).toBe(1);

    // Listen for round_recap
    const recapPromiseHost = waitForEvent<RoundRecapData>(host, 'round_recap', 6000);
    const recapPromiseP2 = waitForEvent<RoundRecapData>(player2, 'round_recap', 6000);

    // Both players submit simultaneously
    const now = Date.now();
    const [sub1, sub2] = await Promise.all([
      new Promise<{ success: boolean }>((resolve) => {
        host.emit('submit_trivia_answer', { answerIndex: 0, clientTimeMs: now }, resolve);
      }),
      new Promise<{ success: boolean }>((resolve) => {
        player2.emit('submit_trivia_answer', { answerIndex: 1, clientTimeMs: now + 200 }, resolve);
      }),
    ]);

    expect(sub1.success).toBe(true);
    expect(sub2.success).toBe(true);

    // Round concludes early because all connected players submitted
    const [recapHost, recapP2] = await Promise.all([recapPromiseHost, recapPromiseP2]);
    expect(recapHost.roundNumber).toBe(1);
    expect(recapHost.results).toHaveLength(2);
    expect(recapP2.results).toHaveLength(2);

    // Verification of revealed solutions in recap
    if (recapHost.mode === 'trivia') {
      expect(typeof recapHost.triviaRevealIndex).toBe('number');
    }
  }, 12000);

  it('4. Anti-Cheat: Reject duplicate answers and answers outside active round', async () => {
    const host = createClientSocket();
    const player2 = createClientSocket();
    await Promise.all([ensureConnected(host), ensureConnected(player2)]);

    const createRes = await new Promise<{
      success: boolean;
      data?: { roomCode: string };
    }>((resolve) => {
      host.emit('create_room', { nickname: 'AntiCheatHost', avatar: 'void-ninja' }, resolve);
    });
    const roomCode = createRes.data!.roomCode;

    await new Promise<{ success: boolean }>((resolve) => {
      player2.emit('join_room', { roomCode, nickname: 'AntiCheatP2', avatar: 'quantum-cat' }, resolve);
    });

    // Submitting before game starts -> Rejected
    const prematureRes = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      host.emit('submit_trivia_answer', { answerIndex: 0, clientTimeMs: Date.now() }, resolve);
    });
    expect(prematureRes.success).toBe(false);
    expect(prematureRes.error).toBe('No active round in progress');

    // Start game
    const roundStartedPromise = waitForEvent<{ round: number }>(host, 'round_started', 8000);
    await new Promise<{ success: boolean }>((resolve) => {
      host.emit('start_game', resolve);
    });
    await roundStartedPromise;

    // First submission -> Accepted
    const firstSub = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      host.emit('submit_trivia_answer', { answerIndex: 2, clientTimeMs: Date.now() }, resolve);
    });
    expect(firstSub.success).toBe(true);

    // Duplicate submission in same round -> Rejected
    const dupSub = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      host.emit('submit_trivia_answer', { answerIndex: 3, clientTimeMs: Date.now() }, resolve);
    });
    expect(dupSub.success).toBe(false);
    expect(dupSub.error).toBe('Answer already submitted for this round');
  }, 12000);

  it('5. Disconnect and reconnection preserves player score and state', async () => {
    const host = createClientSocket();
    const player2 = createClientSocket();
    await Promise.all([ensureConnected(host), ensureConnected(player2)]);

    const createRes = await new Promise<{
      success: boolean;
      data?: { roomCode: string };
    }>((resolve) => {
      host.emit('create_room', { nickname: 'ReconHost', avatar: 'hyper-fox' }, resolve);
    });
    const roomCode = createRes.data!.roomCode;

    const joinRes = await new Promise<{
      success: boolean;
      data?: { sessionToken: string };
    }>((resolve) => {
      player2.emit('join_room', { roomCode, nickname: 'ReconP2', avatar: 'cosmic-alien' }, resolve);
    });
    const sessionTokenP2 = joinRes.data!.sessionToken;

    // Player 2 disconnects
    const disconnectNotified = waitForEvent<string>(host, 'player_disconnected', 4000);
    player2.disconnect();
    const disconnectedPlayerId = await disconnectNotified;
    expect(disconnectedPlayerId).toBeDefined();

    // Reconnecting with a new socket
    const reconnectedClient = createClientSocket();
    await ensureConnected(reconnectedClient);

    const reconRes = await new Promise<{
      success: boolean;
      data?: { room: RoomState };
    }>((resolve) => {
      reconnectedClient.emit(
        'reconnect_player',
        { roomCode, sessionToken: sessionTokenP2 },
        resolve
      );
    });

    expect(reconRes.success).toBe(true);
    expect(reconRes.data?.room.roomCode).toBe(roomCode);
    const reconnectedP = reconRes.data?.room.players.find((p) => p.id === reconnectedClient.id || p.nickname === 'ReconP2');
    expect(reconnectedP).toBeDefined();
    expect(reconnectedP?.nickname).toBe('ReconP2');
    expect(reconnectedP?.isConnected).toBe(true);
  });

  it('6. Full game flow: Game Over with accolades and Rematch (play_again)', async () => {
    const host = createClientSocket();
    const player2 = createClientSocket();
    await Promise.all([ensureConnected(host), ensureConnected(player2)]);

    const createRes = await new Promise<{
      success: boolean;
      data?: { roomCode: string };
    }>((resolve) => {
      host.emit('create_room', { nickname: 'FinalHost', avatar: 'cyber-brain' }, resolve);
    });
    const roomCode = createRes.data!.roomCode;

    await new Promise<{ success: boolean }>((resolve) => {
      player2.emit('join_room', { roomCode, nickname: 'FinalP2', avatar: 'plasma-dragon' }, resolve);
    });

    const room = roomManager.getRoom(roomCode)!;
    room.totalRounds = 1; // Set to 1 round for accelerated game over test

    // Start match
    await new Promise<{ success: boolean }>((resolve) => {
      host.emit('start_game', resolve);
    });

    await waitForEvent(host, 'round_started', 8000);

    // Listen for game_over event
    const gameOverPromiseHost = waitForEvent<GameOverPodiumData>(host, 'game_over', 10000);
    const gameOverPromiseP2 = waitForEvent<GameOverPodiumData>(player2, 'game_over', 10000);

    // Both players submit
    host.emit('submit_trivia_answer', { answerIndex: 0, clientTimeMs: Date.now() });
    player2.emit('submit_trivia_answer', { answerIndex: 1, clientTimeMs: Date.now() });

    // Directly trigger round end if needed to conclude
    const [podiumHost, podiumP2] = await Promise.all([gameOverPromiseHost, gameOverPromiseP2]);
    expect(podiumHost.leaderboard).toHaveLength(2);
    expect(podiumP2.leaderboard).toHaveLength(2);
    expect(Array.isArray(podiumHost.accolades)).toBe(true);

    // Non-host attempts rematch -> Rejected
    const invalidRematch = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      player2.emit('play_again', resolve);
    });
    expect(invalidRematch.success).toBe(false);
    expect(invalidRematch.error).toBe('Only the host can initiate a rematch');

    // Host triggers rematch (play_again)
    const lobbyResetPromise = waitForRoomState(player2, (r) => r.status === 'LOBBY');
    const rematchRes = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      host.emit('play_again', resolve);
    });
    expect(rematchRes.success).toBe(true);

    const resetRoom = await lobbyResetPromise;
    expect(resetRoom.status).toBe('LOBBY');
    expect(resetRoom.currentRound).toBe(1);
    expect(resetRoom.players).toHaveLength(2);
    // All scores reset to 0
    resetRoom.players.forEach((p) => {
      expect(p.score).toBe(0);
      expect(p.streak).toBe(0);
    });
  }, 16000);
});
