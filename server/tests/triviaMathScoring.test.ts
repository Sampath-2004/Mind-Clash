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

describe('Phase 5: Trivia & Quick Math Scoring and Multi-client Integration Tests', () => {
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

  it('1. Scoring constants adhere to Phase 5 specifications', () => {
    expect(SCORING.TRIVIA.BASE_POINTS).toBe(100);
    expect(SCORING.TRIVIA.MAX_SPEED_BONUS).toBe(50);
    expect(SCORING.MATH.BASE_POINTS).toBe(100);
    expect(SCORING.MATH.MAX_SPEED_BONUS).toBe(50);
  });

  it('2. Trivia Round: Obfuscation, Scoring (100 base + speed bonus vs 0 for wrong), and Explanation Reveal', async () => {
    const host = createClientSocket();
    const player2 = createClientSocket();
    await Promise.all([ensureConnected(host), ensureConnected(player2)]);

    // Create room with trivia mode
    const createRes = await new Promise<{
      success: boolean;
      data?: { roomCode: string };
    }>((resolve) => {
      host.emit('create_room', { nickname: 'QuizMaster', avatar: 'cyber-brain' }, resolve);
    });
    const roomCode = createRes.data!.roomCode;

    await new Promise<{ success: boolean }>((resolve) => {
      player2.emit('join_room', { roomCode, nickname: 'Contender', avatar: 'plasma-dragon' }, resolve);
    });

    const room = roomManager.getRoom(roomCode)!;
    room.settings.selectedModes = ['trivia'];

    // Start match
    const round1StartedPromise = waitForEvent<{
      round: number;
      roundId: string;
      activeChallenge: ActiveChallengeClient;
    }>(host, 'round_started', 8000);

    await new Promise<{ success: boolean }>((resolve) => {
      host.emit('start_game', resolve);
    });

    const round1 = await round1StartedPromise;
    expect(round1.activeChallenge.mode).toBe('trivia');

    // SECURITY CHECK: Client must not receive correctIndex or correctAnswer during active round
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const challengeClient = round1.activeChallenge.challenge as any;
    expect(challengeClient.correctIndex).toBeUndefined();
    expect(challengeClient.correctAnswer).toBeUndefined();
    expect(challengeClient.options).toHaveLength(4);

    // Host submits answer index 0 immediately (fast submission)
    const recapPromise = waitForEvent<RoundRecapData>(host, 'round_recap', 6000);

    const now = Date.now();
    const hostSub = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      host.emit('submit_trivia_answer', { answerIndex: 0, clientTimeMs: now }, resolve);
    });
    expect(hostSub.success).toBe(true);

    // Player 2 submits answer index 1 slightly later
    const p2Sub = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      player2.emit('submit_trivia_answer', { answerIndex: 1, clientTimeMs: now + 300 }, resolve);
    });
    expect(p2Sub.success).toBe(true);

    // Round recap received
    const recap = await recapPromise;
    expect(recap.mode).toBe('trivia');
    expect(typeof recap.triviaRevealIndex).toBe('number');
    expect(recap.triviaRevealIndex).toBeGreaterThanOrEqual(0);
    expect(recap.triviaRevealIndex).toBeLessThanOrEqual(3);
    expect(recap.triviaCorrectText).toBeDefined();
    expect(recap.explanation).toBeDefined();

    // Verify scoring logic
    const hostResult = recap.results.find((r) => r.nickname === 'QuizMaster')!;
    const p2Result = recap.results.find((r) => r.nickname === 'Contender')!;

    if (hostResult.isCorrect) {
      // 100 base + speed bonus (between 100 and 150)
      expect(hostResult.pointsEarned).toBeGreaterThanOrEqual(100);
      expect(hostResult.pointsEarned).toBeLessThanOrEqual(150);
    } else {
      // Wrong answer gives 0 points
      expect(hostResult.pointsEarned).toBe(0);
    }

    if (p2Result.isCorrect) {
      expect(p2Result.pointsEarned).toBeGreaterThanOrEqual(100);
      expect(p2Result.pointsEarned).toBeLessThanOrEqual(150);
    } else {
      expect(p2Result.pointsEarned).toBe(0);
    }
  }, 12000);

  it('3. Duplicate Submission Rejection: Exactly one scored answer per player per round', async () => {
    const host = createClientSocket();
    const player2 = createClientSocket();
    await Promise.all([ensureConnected(host), ensureConnected(player2)]);

    const createRes = await new Promise<{
      success: boolean;
      data?: { roomCode: string };
    }>((resolve) => {
      host.emit('create_room', { nickname: 'SingleAnswerHost', avatar: 'astro-bot' }, resolve);
    });
    const roomCode = createRes.data!.roomCode;

    await new Promise<{ success: boolean }>((resolve) => {
      player2.emit('join_room', { roomCode, nickname: 'SingleAnswerP2', avatar: 'quantum-cat' }, resolve);
    });

    const room = roomManager.getRoom(roomCode)!;
    room.settings.selectedModes = ['math'];

    const roundStarted = waitForEvent<{ round: number }>(host, 'round_started', 8000);
    await new Promise<{ success: boolean }>((resolve) => {
      host.emit('start_game', resolve);
    });
    await roundStarted;

    // First submission succeeds
    const firstAttempt = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      host.emit('submit_math_answer', { answer: 42, clientTimeMs: Date.now() }, resolve);
    });
    expect(firstAttempt.success).toBe(true);

    // Second submission in same round is strictly rejected
    const secondAttempt = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      host.emit('submit_math_answer', { answer: 42, clientTimeMs: Date.now() }, resolve);
    });
    expect(secondAttempt.success).toBe(false);
    expect(secondAttempt.error).toBe('Answer already submitted for this round');
  }, 12000);

  it('4. Math Round: Arithmetic challenges with clean integer evaluation and no-answer scoring', async () => {
    const host = createClientSocket();
    const player2 = createClientSocket();
    await Promise.all([ensureConnected(host), ensureConnected(player2)]);

    const createRes = await new Promise<{
      success: boolean;
      data?: { roomCode: string };
    }>((resolve) => {
      host.emit('create_room', { nickname: 'MathGenius', avatar: 'void-ninja' }, resolve);
    });
    const roomCode = createRes.data!.roomCode;

    await new Promise<{ success: boolean }>((resolve) => {
      player2.emit('join_room', { roomCode, nickname: 'PassivePlayer', avatar: 'cosmic-alien' }, resolve);
    });

    const room = roomManager.getRoom(roomCode)!;
    room.settings.selectedModes = ['math'];

    const roundStartedPromise = waitForEvent<{
      round: number;
      activeChallenge: ActiveChallengeClient;
    }>(host, 'round_started', 8000);

    await new Promise<{ success: boolean }>((resolve) => {
      host.emit('start_game', resolve);
    });

    const roundData = await roundStartedPromise;
    expect(roundData.activeChallenge.mode).toBe('math');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mathClient = roundData.activeChallenge.challenge as any;
    expect(mathClient.correctAnswer).toBeUndefined();
    expect(mathClient.prompt).toContain('= ?');
    expect(mathClient.options).toHaveLength(4);

    // Host submits choice
    await new Promise<{ success: boolean }>((resolve) => {
      host.emit('submit_math_answer', { answer: mathClient.options[0], clientTimeMs: Date.now() }, resolve);
    });

    // Player 2 does not answer. Conclude round.
    const engine = getGameEngine();
    const recapPromise = waitForEvent<RoundRecapData>(host, 'round_recap', 6000);
    engine.endRound(room, room.roundId!);

    const recap = await recapPromise;
    expect(recap.mode).toBe('math');
    expect(typeof recap.mathCorrectAnswer).toBe('number');

    // Passive player who didn't answer receives exactly 0 points
    const passiveResult = recap.results.find((r) => r.nickname === 'PassivePlayer')!;
    expect(passiveResult.pointsEarned).toBe(0);
    expect(passiveResult.isCorrect).toBe(false);
  }, 12000);
});
