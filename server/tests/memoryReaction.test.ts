import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { httpServer, io } from '../src/index.js';
import { io as Client, Socket } from 'socket.io-client';
import { AddressInfo } from 'net';
import { roomManager } from '../src/managers/RoomManager.js';
import { getGameEngine } from '../src/socket/roomHandlers.js';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  ActiveChallengeClient,
  RoundRecapData,
  RoomState,
  SCORING,
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
  timeoutMs = 10000
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

describe('Phase 6: Memory Match and Reaction Rush Multi-Client Integration Tests', () => {
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

  it('1. Memory Match: 3 simulated players, premature submission rejected, sequence accuracy scoring, repeated input rejection', async () => {
    const player1 = createClientSocket();
    const player2 = createClientSocket();
    const player3 = createClientSocket();

    await Promise.all([
      ensureConnected(player1),
      ensureConnected(player2),
      ensureConnected(player3),
    ]);

    // Create room with Host (Player 1)
    const createRes = await new Promise<{
      success: boolean;
      data?: { roomCode: string };
    }>((resolve) => {
      player1.emit('create_room', { nickname: 'MemoryMaster', avatar: 'cyber-brain' }, resolve);
    });
    expect(createRes.success).toBe(true);
    const roomCode = createRes.data!.roomCode;

    // Player 2 and Player 3 join
    await new Promise<{ success: boolean }>((resolve) => {
      player2.emit('join_room', { roomCode, nickname: 'RecallPro', avatar: 'plasma-dragon' }, resolve);
    });
    await new Promise<{ success: boolean }>((resolve) => {
      player3.emit('join_room', { roomCode, nickname: 'NovicePlayer', avatar: 'astro-bot' }, resolve);
    });

    const room = roomManager.getRoom(roomCode)!;
    expect(room.players).toHaveLength(3);
    room.settings.selectedModes = ['memory'];

    // Start match
    const roundStartedPromise = waitForEvent<{
      round: number;
      roundId: string;
      activeChallenge: ActiveChallengeClient;
    }>(player1, 'round_started', 8000);

    await new Promise<{ success: boolean }>((resolve) => {
      player1.emit('start_game', resolve);
    });

    const roundData = await roundStartedPromise;
    expect(roundData.activeChallenge.mode).toBe('memory');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const memChallenge = roundData.activeChallenge.challenge as any;
    expect(memChallenge.sequence).toBeDefined();
    expect(memChallenge.sequence.length).toBeGreaterThanOrEqual(4);
    expect(memChallenge.viewingDurationMs).toBeGreaterThan(0);
    expect(memChallenge.viewingEndTime).toBeDefined();

    // Verify secret solution is NOT leaked to clients
    expect(memChallenge.solutionSequence).toBeUndefined();

    // TEST PREMATURE INPUT: Attempt submission while viewing period is active
    const prematureRes = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      player1.emit(
        'submit_memory_tiles',
        {
          sequence: memChallenge.sequence,
          clientTimeMs: Date.now(),
        },
        resolve
      );
    });
    expect(prematureRes.success).toBe(false);
    expect(prematureRes.error).toContain('Premature submission rejected: viewing period is still active');

    // Wait until viewing period ends
    const waitTimeMs = Math.max(0, memChallenge.viewingEndTime - Date.now()) + 50;
    await new Promise((r) => setTimeout(r, waitTimeMs));

    // Player 1 submits 100% correct sequence
    const p1SubmitRes = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      player1.emit(
        'submit_memory_tiles',
        {
          sequence: memChallenge.sequence,
          clientTimeMs: Date.now(),
        },
        resolve
      );
    });
    expect(p1SubmitRes.success).toBe(true);

    // TEST REPEATED INPUT: Player 1 attempts to submit again in the same round
    const repeatedRes = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      player1.emit(
        'submit_memory_tiles',
        {
          sequence: memChallenge.sequence,
          clientTimeMs: Date.now(),
        },
        resolve
      );
    });
    expect(repeatedRes.success).toBe(false);
    expect(repeatedRes.error).toContain('Answer already submitted for this round');

    // Player 2 submits partially correct sequence (first 2 match, remaining wrong)
    const partialSequence = [
      memChallenge.sequence[0],
      memChallenge.sequence[1],
      'nonexistent_symbol_x',
      'nonexistent_symbol_y',
    ];
    const p2SubmitRes = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      player2.emit(
        'submit_memory_tiles',
        {
          sequence: partialSequence,
          clientTimeMs: Date.now(),
        },
        resolve
      );
    });
    expect(p2SubmitRes.success).toBe(true);

    // Player 3 submits entirely incorrect sequence
    const recapPromise = waitForEvent<RoundRecapData>(player1, 'round_recap', 6000);
    const p3SubmitRes = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      player3.emit(
        'submit_memory_tiles',
        {
          sequence: ['wrong1', 'wrong2', 'wrong3', 'wrong4'],
          clientTimeMs: Date.now(),
        },
        resolve
      );
    });
    expect(p3SubmitRes.success).toBe(true);

    // Round ends immediately after all 3 players submitted
    const recap = await recapPromise;
    expect(recap.mode).toBe('memory');
    expect(recap.memorySequence).toEqual(memChallenge.sequence);

    const p1Result = recap.results.find((r) => r.nickname === 'MemoryMaster')!;
    const p2Result = recap.results.find((r) => r.nickname === 'RecallPro')!;
    const p3Result = recap.results.find((r) => r.nickname === 'NovicePlayer')!;

    // Player 1: Perfect accuracy = 100 base + speed bonus (> 100)
    expect(p1Result.isCorrect).toBe(true);
    expect(p1Result.pointsEarned).toBeGreaterThanOrEqual(100);
    expect(p1Result.pointsEarned).toBeLessThanOrEqual(150);

    // Player 2: 2 correct matches * 15 pts = 30 pts, isCorrect = false
    expect(p2Result.isCorrect).toBe(false);
    expect(p2Result.pointsEarned).toBe(30);

    // Player 3: 0 correct matches = 0 pts
    expect(p3Result.isCorrect).toBe(false);
    expect(p3Result.pointsEarned).toBe(0);
  }, 15000);

  it('2. Reaction Rush: 3 simulated players, false start penalty, latency disclosure, reconnection, and reflex scoring', async () => {
    const player1 = createClientSocket();
    const player2 = createClientSocket();
    const player3 = createClientSocket();

    await Promise.all([
      ensureConnected(player1),
      ensureConnected(player2),
      ensureConnected(player3),
    ]);

    const createRes = await new Promise<{
      success: boolean;
      data?: { roomCode: string; sessionToken: string };
    }>((resolve) => {
      player1.emit('create_room', { nickname: 'FastReflexHost', avatar: 'hyper-fox' }, resolve);
    });
    const roomCode = createRes.data!.roomCode;

    await new Promise<{ success: boolean }>((resolve) => {
      player2.emit('join_room', { roomCode, nickname: 'PatientPlayer', avatar: 'plasma-dragon' }, resolve);
    });

    const p3JoinRes = await new Promise<{
      success: boolean;
      data?: { sessionToken: string };
    }>((resolve) => {
      player3.emit('join_room', { roomCode, nickname: 'ReconnectRebel', avatar: 'cosmic-alien' }, resolve);
    });
    const sessionTokenP3 = p3JoinRes.data!.sessionToken;

    const room = roomManager.getRoom(roomCode)!;
    room.settings.selectedModes = ['reaction'];

    const roundStartedPromise = waitForEvent<{
      round: number;
      roundId: string;
      activeChallenge: ActiveChallengeClient;
    }>(player1, 'round_started', 8000);

    await new Promise<{ success: boolean }>((resolve) => {
      player1.emit('start_game', resolve);
    });

    const roundData = await roundStartedPromise;
    expect(roundData.activeChallenge.mode).toBe('reaction');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rxChallenge = roundData.activeChallenge.challenge as any;
    expect(rxChallenge.targetActivationTime).toBeDefined();
    expect(rxChallenge.networkNotice).toBeDefined();
    expect(rxChallenge.networkNotice).toContain('network latency');

    // TEST PREMATURE INPUT (False Start): Player 1 taps before targetActivationTime
    const nowBeforeActivation = Date.now();
    expect(nowBeforeActivation).toBeLessThan(rxChallenge.targetActivationTime);

    const falseStartRes = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      player1.emit('submit_reaction_click', { clientTimeMs: nowBeforeActivation }, resolve);
    });
    expect(falseStartRes.success).toBe(true);

    // TEST REPEATED INPUT: Player 1 taps again after false start
    const repeatedTapRes = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      player1.emit('submit_reaction_click', { clientTimeMs: Date.now() }, resolve);
    });
    expect(repeatedTapRes.success).toBe(false);
    expect(repeatedTapRes.error).toContain('Answer already submitted for this round');

    // TEST RECONNECTION: Player 3 disconnects during active round
    const disconnectNotified = waitForEvent<string>(player1, 'player_disconnected', 4000);
    player3.disconnect();
    await disconnectNotified;

    // Player 3 reconnects with a fresh socket
    const reconnectedClient = createClientSocket();
    await ensureConnected(reconnectedClient);

    const reconRes = await new Promise<{
      success: boolean;
      data?: { room: RoomState };
    }>((resolve) => {
      reconnectedClient.emit(
        'reconnect_player',
        { roomCode, sessionToken: sessionTokenP3 },
        resolve
      );
    });
    expect(reconRes.success).toBe(true);
    expect(reconRes.data?.room.roomCode).toBe(roomCode);

    // Wait until targetActivationTime is reached
    const waitToActivateMs = Math.max(0, rxChallenge.targetActivationTime - Date.now()) + 50;
    await new Promise((r) => setTimeout(r, waitToActivateMs));

    // Player 2 taps after target activation
    const p2TapRes = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      player2.emit('submit_reaction_click', { clientTimeMs: Date.now() }, resolve);
    });
    expect(p2TapRes.success).toBe(true);

    // Player 3 (reconnected) taps after target activation
    const recapPromise = waitForEvent<RoundRecapData>(player1, 'round_recap', 6000);
    const p3TapRes = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      reconnectedClient.emit('submit_reaction_click', { clientTimeMs: Date.now() }, resolve);
    });
    expect(p3TapRes.success).toBe(true);

    // Recap arrives
    const recap = await recapPromise;
    expect(recap.mode).toBe('reaction');
    expect(recap.networkNotice).toBeDefined();
    expect(recap.networkNotice).toContain('network latency');
    expect(recap.reactionFastestMs).toBeDefined();
    expect(recap.reactionFastestMs!).toBeGreaterThanOrEqual(15);

    const p1Result = recap.results.find((r) => r.nickname === 'FastReflexHost')!;
    const p2Result = recap.results.find((r) => r.nickname === 'PatientPlayer')!;
    const p3Result = recap.results.find((r) => r.nickname === 'ReconnectRebel')!;

    // Player 1 had a false start: -200 pts penalty
    expect(p1Result.falseStart).toBe(true);
    expect(p1Result.isCorrect).toBe(false);
    expect(p1Result.pointsEarned).toBe(SCORING.REACTION.FALSE_START_PENALTY);

    // Player 2 tapped on time: 100 base + speed bonus
    expect(p2Result.falseStart).toBeFalsy();
    expect(p2Result.isCorrect).toBe(true);
    expect(p2Result.pointsEarned).toBeGreaterThanOrEqual(100);
    expect(p2Result.pointsEarned).toBeLessThanOrEqual(150);

    // Player 3 (reconnected) successfully scored on time
    expect(p3Result.falseStart).toBeFalsy();
    expect(p3Result.isCorrect).toBe(true);
    expect(p3Result.pointsEarned).toBeGreaterThanOrEqual(100);
  }, 18000);

  it('3. Delayed input: Rejects submission after round has ended', async () => {
    const player1 = createClientSocket();
    const player2 = createClientSocket();
    await Promise.all([ensureConnected(player1), ensureConnected(player2)]);

    const createRes = await new Promise<{
      success: boolean;
      data?: { roomCode: string };
    }>((resolve) => {
      player1.emit('create_room', { nickname: 'LateHost', avatar: 'astro-bot' }, resolve);
    });
    const roomCode = createRes.data!.roomCode;

    await new Promise<{ success: boolean }>((resolve) => {
      player2.emit('join_room', { roomCode, nickname: 'LatePlayer2', avatar: 'quantum-cat' }, resolve);
    });

    const room = roomManager.getRoom(roomCode)!;
    room.settings.selectedModes = ['memory'];

    const roundStarted = waitForEvent<{ round: number }>(player1, 'round_started', 8000);
    await new Promise<{ success: boolean }>((resolve) => {
      player1.emit('start_game', resolve);
    });
    await roundStarted;

    // Simulate round ending
    const engine = getGameEngine()!;
    engine.endRound(room, room.roundId || '');
    expect(room.status).toBe('ROUND_RECAP');

    // Attempting delayed submission during recap or after round ended
    const lateSubmit = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      player1.emit(
        'submit_memory_tiles',
        { sequence: ['star', 'bolt'], clientTimeMs: Date.now() },
        resolve
      );
    });

    expect(lateSubmit.success).toBe(false);
    expect(lateSubmit.error).toMatch(/No active round in progress|Submission received after round ended/);
  });
});
