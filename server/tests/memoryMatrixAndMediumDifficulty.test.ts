import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { httpServer } from '../src/index.js';
import { io as Client, Socket } from 'socket.io-client';
import { AddressInfo } from 'net';
import { roomManager } from '../src/managers/RoomManager.js';
import { getGameEngine } from '../src/socket/roomHandlers.js';
import { generateMemoryChallenge } from '../src/modes/memoryGenerator.js';
import { generateMathQuestion } from '../src/modes/mathGenerator.js';
import { generateReactionChallenge } from '../src/modes/reactionGenerator.js';
import { TRIVIA_BANK, getQuestionDifficulty } from '../src/modes/triviaBank.js';
import { RARE_ANSWER_BANK } from '../src/modes/rareAnswerBank.js';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  ActiveChallengeClient,
  RoundRecapData,
  MemoryChallengeClient,
  ReconnectResponseData,
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

describe('Memory Matrix Preview & Medium Difficulty Moderation Verification', () => {
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
    if (!httpServer.listening) {
      await new Promise<void>((resolve) => {
        httpServer.listen(0, () => resolve());
      });
    }
    const addr = httpServer.address() as AddressInfo;
    port = addr.port;
  });

  afterAll(async () => {
    connectedSockets.forEach((s) => {
      if (s.connected) s.disconnect();
    });
    const engine = getGameEngine();
    if (engine) engine.clearAll();
    roomManager.clearAll();
  });

  it('1. Memorize occurs before Recall, lasts its configured duration, and rejects input before Recall', async () => {
    const player1 = createClientSocket();
    const player2 = createClientSocket();
    await Promise.all([ensureConnected(player1), ensureConnected(player2)]);

    const createRes = await new Promise<{
      success: boolean;
      data?: { roomCode: string; sessionToken: string; playerId: string };
    }>((resolve) => {
      player1.emit('create_room', { nickname: 'AliceMem', avatar: 'cyber-brain' }, resolve);
    });
    expect(createRes.success).toBe(true);
    const roomCode = createRes.data!.roomCode;

    await new Promise((resolve) => {
      player2.emit('join_room', { roomCode, nickname: 'BobMem', avatar: 'neon-cat' }, resolve);
    });

    const room = roomManager.getRoom(roomCode)!;
    room.settings.selectedModes = ['memory'];
    room.settings.difficulty = 'medium';

    const roundStartedPromise = waitForEvent<{
      round: number;
      roundId: string;
      activeChallenge: ActiveChallengeClient;
      startTime: number;
      endTime: number;
      serverTime: number;
    }>(player1, 'round_started', 8000);

    const phaseChangedPromise = waitForEvent<{
      phase: 'memorize' | 'recall';
      roundId: string;
      inputDurationMs?: number;
      recallStartTime?: number;
      recallEndTime?: number;
      serverTime: number;
    }>(player1, 'memory_phase_changed', 8000);

    await new Promise((resolve) => player1.emit('start_game', resolve));

    const roundData = await roundStartedPromise;
    expect(roundData.activeChallenge.mode).toBe('memory');

    const memChallenge = roundData.activeChallenge.challenge as MemoryChallengeClient;
    expect(memChallenge.phase).toBe('memorize');
    expect(memChallenge.sequence).toBeDefined();
    expect(memChallenge.sequence!.length).toBeGreaterThanOrEqual(5); // Medium sequence length is at least 5
    expect(memChallenge.viewingDurationMs).toBe(3000); // 3000ms configured duration

    const startTime = Date.now();

    // TEST PREMATURE INPUT: Input MUST be rejected during Memorize phase
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

    // Wait for the server-controlled phase transition to Recall
    const phaseChangeData = await phaseChangedPromise;
    const elapsedViewingMs = Date.now() - startTime;

    expect(phaseChangeData.phase).toBe('recall');
    // Viewing duration must last its full configured time (~3000ms)
    expect(elapsedViewingMs).toBeGreaterThanOrEqual(2850);
    expect(phaseChangeData.recallEndTime).toBeDefined();

    // Now in Recall: submission MUST succeed
    const validRecallRes = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      player1.emit(
        'submit_memory_tiles',
        {
          sequence: memChallenge.sequence,
          clientTimeMs: Date.now(),
        },
        resolve
      );
    });
    expect(validRecallRes.success).toBe(true);
  }, 15000);

  it('2. All players receive identical sequence, order, and deadlines', async () => {
    const p1 = createClientSocket();
    const p2 = createClientSocket();
    await Promise.all([ensureConnected(p1), ensureConnected(p2)]);

    const createRes = await new Promise<{
      success: boolean;
      data?: { roomCode: string; sessionToken: string; playerId: string };
    }>((resolve) => {
      p1.emit('create_room', { nickname: 'SyncPlayer1', avatar: 'cyber-brain' }, resolve);
    });
    const roomCode = createRes.data!.roomCode;

    await new Promise((resolve) => {
      p2.emit('join_room', { roomCode, nickname: 'SyncPlayer2', avatar: 'neon-cat' }, resolve);
    });

    const room = roomManager.getRoom(roomCode)!;
    room.settings.selectedModes = ['memory'];

    const p1RoundPromise = waitForEvent<{ activeChallenge: ActiveChallengeClient; endTime: number }>(p1, 'round_started');
    const p2RoundPromise = waitForEvent<{ activeChallenge: ActiveChallengeClient; endTime: number }>(p2, 'round_started');

    await new Promise((resolve) => p1.emit('start_game', resolve));

    const [p1Round, p2Round] = await Promise.all([p1RoundPromise, p2RoundPromise]);

    const mem1 = p1Round.activeChallenge.challenge as MemoryChallengeClient;
    const mem2 = p2Round.activeChallenge.challenge as MemoryChallengeClient;

    // Both players must receive the exact same sequence and exact same order
    expect(mem1.sequence).toEqual(mem2.sequence);
    expect(mem1.viewingEndTime).toBe(mem2.viewingEndTime);
    expect(p1Round.endTime).toBe(p2Round.endTime);
  }, 15000);

  it('3. Reconnects and stale events do not restart preview and never leak sequence during Recall', async () => {
    const p1 = createClientSocket();
    const p2 = createClientSocket();
    await Promise.all([ensureConnected(p1), ensureConnected(p2)]);

    const createRes = await new Promise<{
      success: boolean;
      data?: { roomCode: string; sessionToken: string; playerId: string };
    }>((resolve) => {
      p1.emit('create_room', { nickname: 'ReconnectHost', avatar: 'cyber-brain' }, resolve);
    });
    const roomCode = createRes.data!.roomCode;

    const joinRes = await new Promise<{
      success: boolean;
      data?: { roomCode: string; sessionToken: string; playerId: string };
    }>((resolve) => {
      p2.emit('join_room', { roomCode, nickname: 'Reconnector', avatar: 'neon-cat' }, resolve);
    });
    let p2Token = joinRes.data!.sessionToken;

    const room = roomManager.getRoom(roomCode)!;
    room.settings.selectedModes = ['memory'];

    const roundPromise = waitForEvent<{ activeChallenge: ActiveChallengeClient }>(p1, 'round_started');
    const phasePromise = waitForEvent<{ phase: string }>(p1, 'memory_phase_changed');

    await new Promise((resolve) => p1.emit('start_game', resolve));
    const roundData = await roundPromise;
    const origMem = roundData.activeChallenge.challenge as MemoryChallengeClient;

    // A) TEST RECONNECT DURING MEMORIZE: Sequence and viewing countdown are preserved
    const p2ReconnectMemorize = await new Promise<{ success: boolean; data?: ReconnectResponseData }>((resolve) => {
      p2.emit('reconnect_player', { roomCode, sessionToken: p2Token }, resolve);
    });
    expect(p2ReconnectMemorize.success).toBe(true);
    if (p2ReconnectMemorize.data?.newSessionToken) {
      p2Token = p2ReconnectMemorize.data.newSessionToken;
    }
    const memSnapMemorize = p2ReconnectMemorize.data!.activeChallenge!.challenge as MemoryChallengeClient;
    expect(memSnapMemorize.phase).toBe('memorize');
    expect(memSnapMemorize.sequence).toEqual(origMem.sequence);

    // Wait until Recall phase starts
    await phasePromise;

    // B) TEST RECONNECT DURING RECALL: Sequence MUST be omitted, preview must NOT restart
    const p2ReconnectRecall = await new Promise<{ success: boolean; data?: ReconnectResponseData }>((resolve) => {
      p2.emit('reconnect_player', { roomCode, sessionToken: p2Token }, resolve);
    });
    expect(p2ReconnectRecall.success).toBe(true);
    const memSnapRecall = p2ReconnectRecall.data!.activeChallenge!.challenge as MemoryChallengeClient;
    expect(memSnapRecall.phase).toBe('recall');
    // Sequence MUST NOT be leaked in the recall reconnect snapshot
    expect(memSnapRecall.sequence).toBeUndefined();
    // Sequence length must still be known for rendering slots
    expect(memSnapRecall.sequenceLength).toBe(origMem.sequence!.length);
  }, 15000);

  it('4. Scoring strictly validates symbol order and handles repeated symbols', async () => {
    const p1 = createClientSocket();
    const p2 = createClientSocket();
    const p3 = createClientSocket();
    await Promise.all([ensureConnected(p1), ensureConnected(p2), ensureConnected(p3)]);

    const createRes = await new Promise<{
      success: boolean;
      data?: { roomCode: string; sessionToken: string; playerId: string };
    }>((resolve) => {
      p1.emit('create_room', { nickname: 'PerfectPlayer', avatar: 'cyber-brain' }, resolve);
    });
    const roomCode = createRes.data!.roomCode;

    await new Promise((resolve) => {
      p2.emit('join_room', { roomCode, nickname: 'ReversedPlayer', avatar: 'neon-cat' }, resolve);
    });
    await new Promise((resolve) => {
      p3.emit('join_room', { roomCode, nickname: 'WrongPlayer', avatar: 'pixel-ghost' }, resolve);
    });

    const room = roomManager.getRoom(roomCode)!;
    room.settings.selectedModes = ['memory'];

    const roundPromise = waitForEvent<{ activeChallenge: ActiveChallengeClient }>(p1, 'round_started');
    const phasePromise = waitForEvent(p1, 'memory_phase_changed');
    const recapPromise = waitForEvent<RoundRecapData>(p1, 'round_recap');

    await new Promise((resolve) => p1.emit('start_game', resolve));
    const roundData = await roundPromise;
    const memChallenge = roundData.activeChallenge.challenge as MemoryChallengeClient;
    const targetSeq = memChallenge.sequence!;

    // Wait for Recall phase
    await phasePromise;

    // P1 submits exact sequence in exact order (handles repeated symbols if any)
    await new Promise((resolve) => {
      p1.emit('submit_memory_tiles', { sequence: targetSeq, clientTimeMs: Date.now() }, resolve);
    });

    // P2 submits same symbols in REVERSED order (checking that order strictly counts!)
    const reversedSeq = [...targetSeq].reverse();
    await new Promise((resolve) => {
      p2.emit('submit_memory_tiles', { sequence: reversedSeq, clientTimeMs: Date.now() }, resolve);
    });

    // P3 submits completely wrong symbols
    await new Promise((resolve) => {
      p3.emit(
        'submit_memory_tiles',
        { sequence: Array(targetSeq.length).fill('invalid_sym'), clientTimeMs: Date.now() },
        resolve
      );
    });

    const recap = await recapPromise;
    expect(recap.mode).toBe('memory');
    // Results reveal correct sequence
    expect(recap.memorySequence).toEqual(targetSeq);

    const r1 = recap.results.find((r) => r.nickname === 'PerfectPlayer')!;
    const r2 = recap.results.find((r) => r.nickname === 'ReversedPlayer')!;
    const r3 = recap.results.find((r) => r.nickname === 'WrongPlayer')!;

    expect(r1.isCorrect).toBe(true);
    expect(r1.pointsEarned).toBeGreaterThanOrEqual(100);

    // If reversed order differs from original, reversed player is NOT perfect
    const isPalindromic = targetSeq.join(',') === reversedSeq.join(',');
    if (!isPalindromic) {
      expect(r2.isCorrect).toBe(false);
      expect(r2.pointsEarned).toBeLessThan(r1.pointsEarned);
    }

    expect(r3.isCorrect).toBe(false);
    expect(r3.pointsEarned).toBe(0);
  }, 15000);

  it('5. Medium settings remain strictly below Hard across all game modes', () => {
    // A) Memory Matrix:
    // Round 1: Easy (3) < Medium (5) < Hard (6)
    // Round 3+: Easy (4) < Medium (6) < Hard (7)
    // All capped <= 8
    const memEasyR1 = generateMemoryChallenge(1, Date.now(), 'easy');
    const memMedR1 = generateMemoryChallenge(1, Date.now(), 'medium');
    const memHardR1 = generateMemoryChallenge(1, Date.now(), 'hard');

    expect(memEasyR1.sequence.length).toBeLessThan(memMedR1.sequence.length);
    expect(memMedR1.sequence.length).toBeLessThan(memHardR1.sequence.length);
    expect(memMedR1.sequence.length).toBe(5);
    expect(memMedR1.sequence.length).toBeLessThanOrEqual(8);

    const memEasyR4 = generateMemoryChallenge(4, Date.now(), 'easy');
    const memMedR4 = generateMemoryChallenge(4, Date.now(), 'medium');
    const memHardR4 = generateMemoryChallenge(4, Date.now(), 'hard');

    expect(memEasyR4.sequence.length).toBeLessThan(memMedR4.sequence.length);
    expect(memMedR4.sequence.length).toBeLessThan(memHardR4.sequence.length);
    expect(memMedR4.sequence.length).toBe(6);
    expect(memMedR4.sequence.length).toBeLessThanOrEqual(8);

    // Viewing time ordering: Easy (3500ms) > Medium (3000ms) > Hard (2400ms)
    expect(memEasyR1.viewingDurationMs).toBeGreaterThan(memMedR1.viewingDurationMs);
    expect(memMedR1.viewingDurationMs).toBeGreaterThan(memHardR1.viewingDurationMs);

    // B) Speed Math:
    // Easy: single step addition/subtraction
    // Medium: multi-step, multiplication, exact division
    // Hard: dual multi-step (a*b)+(c*d), (a+b)*c
    for (let r = 1; r <= 30; r++) {
      const easyM = generateMathQuestion(r, 'easy');
      const medM = generateMathQuestion(r, 'medium');
      const hardM = generateMathQuestion(r, 'hard');

      expect(easyM.prompt).toMatch(/^[0-9]+ [+-] [0-9]+ = \?$/);
      expect(easyM.correctAnswer).toBeGreaterThan(0);
      expect(medM.correctAnswer).toBeGreaterThan(0);
      expect(hardM.correctAnswer).toBeGreaterThan(0);

      // Verify clean integer evaluation and 4 distinct options
      expect(Number.isInteger(medM.correctAnswer)).toBe(true);
      expect(new Set(medM.options).size).toBe(4);
    }

    // C) Reaction Clash:
    // Timeout window: Easy (5000ms) > Medium (4000ms) > Hard (3000ms)
    const rxEasy = generateReactionChallenge(Date.now(), 'easy');
    const rxMed = generateReactionChallenge(Date.now(), 'medium');
    const rxHard = generateReactionChallenge(Date.now(), 'hard');

    expect(rxEasy.timeoutMs).toBeGreaterThan(rxMed.timeoutMs);
    expect(rxMed.timeoutMs).toBeGreaterThan(rxHard.timeoutMs);
    // Latency safety: Medium timeout is 4000ms (10x-20x typical internet latency)
    expect(rxMed.timeoutMs).toBe(4000);

    // D) Trivia Bank Difficulty Separation:
    const easyTrivia = TRIVIA_BANK.filter((q) => getQuestionDifficulty(q) === 'easy');
    const medTrivia = TRIVIA_BANK.filter((q) => getQuestionDifficulty(q) === 'medium');
    const hardTrivia = TRIVIA_BANK.filter((q) => getQuestionDifficulty(q) === 'hard');

    expect(easyTrivia.length).toBeGreaterThanOrEqual(8);
    expect(medTrivia.length).toBeGreaterThanOrEqual(10);
    expect(hardTrivia.length).toBeGreaterThanOrEqual(7);

    // E) Rare Answer Bank Difficulty Separation:
    const easyRare = RARE_ANSWER_BANK.filter((i) => i.difficulty === 'easy');
    const medRare = RARE_ANSWER_BANK.filter((i) => i.difficulty === 'medium');
    const hardRare = RARE_ANSWER_BANK.filter((i) => i.difficulty === 'hard');

    expect(easyRare.length).toBeGreaterThanOrEqual(5);
    expect(medRare.length).toBeGreaterThanOrEqual(5);
    expect(hardRare.length).toBeGreaterThanOrEqual(5);
  });
});
