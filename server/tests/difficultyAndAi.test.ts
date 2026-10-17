import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { httpServer } from '../src/index.js';
import { io as Client, Socket } from 'socket.io-client';
import { AddressInfo } from 'net';
import { roomManager } from '../src/managers/RoomManager.js';
import { getGameEngine } from '../src/socket/roomHandlers.js';
import { generateMathQuestion } from '../src/modes/mathGenerator.js';
import { generateMemoryChallenge } from '../src/modes/memoryGenerator.js';
import { generateReactionChallenge } from '../src/modes/reactionGenerator.js';
import { getRandomTriviaQuestion } from '../src/modes/triviaBank.js';
import { getRandomRareAnswer, isAnswerAcceptable, normalizeAnswer } from '../src/modes/rareAnswerBank.js';
import { aiGenerator } from '../src/services/aiGenerator.js';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  Difficulty,
  RoomState,
} from '@mind-clash/shared';

type TestSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

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

describe('Easy / Medium / Hard Difficulty and AI Integration Tests', () => {
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
    roomManager.clearAll();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  beforeEach(() => {
    roomManager.clearAll();
  });

  // ==========================================
  // Section 1: Challenge Generators Across Difficulties
  // ==========================================
  describe('1. Mode Generators across Easy, Medium, and Hard', () => {
    it('Speed Math generates strictly distinct arithmetic for Easy, Medium, and Hard', () => {
      const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];

      for (const diff of difficulties) {
        for (let i = 0; i < 20; i++) {
          const q = generateMathQuestion(1, diff);
          expect(Number.isInteger(q.correctAnswer)).toBe(true);
          expect(q.correctAnswer).toBeGreaterThan(0);
          expect(q.options.length).toBe(4);
          expect(new Set(q.options).size).toBe(4);
          expect(q.options).toContain(q.correctAnswer);
          expect(q.id).toContain(diff);

          if (diff === 'easy') {
            // Easy uses only + or -
            expect(q.prompt).toMatch(/^[0-9]+ [+-] [0-9]+ = \?$/);
          } else if (diff === 'hard') {
            // Hard uses multi-step expressions with parentheses
            expect(q.prompt).toContain('(');
          }
        }
      }
    });

    it('Memory Matrix scales sequence length, viewing window, and grid size achievable on mobile', () => {
      const easy = generateMemoryChallenge(1, Date.now(), 'easy');
      const med = generateMemoryChallenge(1, Date.now(), 'medium');
      const hard = generateMemoryChallenge(1, Date.now(), 'hard');

      // Easy: 3 symbols, 3500ms viewing
      expect(easy.sequence.length).toBeLessThanOrEqual(4);
      expect(easy.viewingDurationMs).toBe(3500);

      // Medium: 4-5 symbols, 3000ms viewing
      expect(med.sequence.length).toBeGreaterThanOrEqual(4);
      expect(med.viewingDurationMs).toBe(3000);

      // Hard: 6-7 symbols, 2400ms viewing (more recall, tighter window)
      expect(hard.sequence.length).toBeGreaterThanOrEqual(6);
      expect(hard.viewingDurationMs).toBe(2400);

      // Grid mode scales from 3 tiles (Easy) to 6 tiles (Hard)
      const easyGrid = generateMemoryChallenge(2, Date.now(), 'easy');
      const hardGrid = generateMemoryChallenge(2, Date.now(), 'hard');
      expect(easyGrid.solution.length).toBe(3);
      expect(hardGrid.solution.length).toBe(6);
      // Fits safely on mobile screen (<= 16 tiles total)
      expect(easyGrid.gridSize).toBeLessThanOrEqual(4);
      expect(hardGrid.gridSize).toBe(4);
    });

    it('Reaction Clash scales delays and timeouts without compromising latency safety', () => {
      const easy = generateReactionChallenge(Date.now(), 'easy');
      const med = generateReactionChallenge(Date.now(), 'medium');
      const hard = generateReactionChallenge(Date.now(), 'hard');

      // False-start delays are randomized and unpredictable
      expect(easy.waitDelayMs).toBeGreaterThanOrEqual(2000);
      expect(med.waitDelayMs).toBeGreaterThanOrEqual(2000);
      expect(hard.waitDelayMs).toBeGreaterThanOrEqual(1500);

      // Timeout windows: Easy (5000ms) > Medium (4000ms) > Hard (3000ms)
      expect(easy.timeoutMs).toBe(5000);
      expect(med.timeoutMs).toBe(4000);
      expect(hard.timeoutMs).toBe(3000); // 3000ms is well above normal network latency
    });

    it('Trivia Offline Bank strictly preserves requested difficulty without silent downgrading', () => {
      const easyQ = getRandomTriviaQuestion(new Set(), 'easy');
      const medQ = getRandomTriviaQuestion(new Set(), 'medium');
      const hardQ = getRandomTriviaQuestion(new Set(), 'hard');

      expect(easyQ).not.toBeNull();
      expect(medQ).not.toBeNull();
      expect(hardQ).not.toBeNull();

      expect(easyQ?.difficulty).toBe('easy');
      expect(medQ?.difficulty).toBe('medium');
      expect(hardQ?.difficulty).toBe('hard');
    });

    it('Rare Answer Bank accurately accepts and normalizes answers across all difficulties', () => {
      const easy = getRandomRareAnswer(new Set(), 'easy');
      const med = getRandomRareAnswer(new Set(), 'medium');
      const hard = getRandomRareAnswer(new Set(), 'hard');

      expect(easy.difficulty).toBe('easy');
      expect(med.difficulty).toBe('medium');
      expect(hard.difficulty).toBe('hard');

      // Normalization handles casing, punctuation, and trim
      expect(normalizeAnswer('  Neon! ')).toBe('neon');
      expect(normalizeAnswer('Saint Lucia')).toBe('saint lucia');

      // Acceptable checks
      expect(isAnswerAcceptable('france', ['France', 'Germany', 'Spain'])).toBe(true);
      expect(isAnswerAcceptable('FRANCE  ', ['France'])).toBe(true);
      expect(isAnswerAcceptable('atlantis', ['France', 'Germany'])).toBe(false);
    });
  });

  // ==========================================
  // Section 2: AI Generation and Failover
  // ==========================================
  describe('2. AI Generation, Validation, and Failover Chain', () => {
    afterAll(() => {
      aiGenerator.setFetch(fetch);
      aiGenerator.setForceProvider(null);
    });

    it('Preserves requested difficulty across Gemini, OpenAI fallback, and Bank fallback', async () => {
      // Test simulated Gemini failure -> OpenAI success
      const mockFetchOpenAiSuccess = (async (url: string) => {
        if (url.includes('generativelanguage.googleapis.com')) {
          throw new Error('Gemini API quota exhausted');
        }
        if (url.includes('api.openai.com')) {
          return {
            ok: true,
            json: async () => ({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      category: 'Science',
                      question: 'What is the hardest known natural material on Earth?',
                      correctAnswer: 'Diamond',
                      incorrectAnswers: ['Quartz', 'Granite', 'Corundum'],
                      explanation: 'Diamond consists of carbon atoms arranged in a crystal lattice.',
                    }),
                  },
                },
              ],
            }),
          };
        }
        throw new Error('Unexpected URL');
      }) as unknown as typeof fetch;

      aiGenerator.setFetch(mockFetchOpenAiSuccess);
      const qHard = await aiGenerator.generateTriviaQuestion('hard', new Set());
      expect(qHard.difficulty).toBe('hard');
      expect(qHard.options.length).toBe(4);
      expect(qHard.correctIndex).toBeGreaterThanOrEqual(0);

      // Test simulated both AI APIs failure -> strictly selects requested difficulty from Offline Bank
      const mockFetchBothFail = (async () => {
        throw new Error('Network offline');
      }) as unknown as typeof fetch;

      aiGenerator.setFetch(mockFetchBothFail);

      const fallbackEasy = await aiGenerator.generateTriviaQuestion('easy', new Set());
      expect(fallbackEasy.difficulty).toBe('easy');

      const fallbackHard = await aiGenerator.generateTriviaQuestion('hard', new Set());
      expect(fallbackHard.difficulty).toBe('hard');
    });

    it('Rare Answer AI generation fallback strictly preserves difficulty', async () => {
      const mockFetchFail = (async () => {
        throw new Error('AI Unavailable');
      }) as unknown as typeof fetch;

      aiGenerator.setFetch(mockFetchFail);

      const raEasy = await aiGenerator.generateRareAnswer('easy', new Set());
      expect(raEasy.difficulty).toBe('easy');
      expect(raEasy.acceptableAnswers.length).toBeGreaterThan(0);

      const raHard = await aiGenerator.generateRareAnswer('hard', new Set());
      expect(raHard.difficulty).toBe('hard');
    });
  });

  // ==========================================
  // Section 3: Room Settings, Synchronization, Host-Only Validation, and Rematches
  // ==========================================
  describe('3. Room Settings, Validation, Synchronization, Locking, and Rematch Preservation', () => {
    it('Defaults difficulty to medium, permits only host to update, and rejects invalid difficulties', async () => {
      const hostSocket = createClientSocket();
      const guestSocket = createClientSocket();

      // 1. Host creates room
      const createRes = await new Promise<any>((resolve) => {
        hostSocket.emit('create_room', { nickname: 'HostPlayer', avatar: 'cyber-brain' }, resolve);
      });
      expect(createRes.success).toBe(true);
      const roomCode = createRes.data.roomCode;

      // 2. Guest joins room
      const joinRes = await new Promise<any>((resolve) => {
        guestSocket.emit('join_room', { roomCode, nickname: 'GuestPlayer', avatar: 'plasma-dragon' }, resolve);
      });
      expect(joinRes.success).toBe(true);

      // Verify initial difficulty defaults to 'medium'
      const room = roomManager.getRoom(roomCode);
      expect(room?.settings.difficulty).toBe('medium');

      // 3. Guest tries to change difficulty -> Rejected
      const guestUpdateRes = await new Promise<any>((resolve) => {
        guestSocket.emit('update_settings', { settings: { difficulty: 'hard' } }, resolve);
      });
      expect(guestUpdateRes.success).toBe(false);
      expect(guestUpdateRes.error).toContain('Only the host can modify room settings');

      // 4. Host submits invalid difficulty -> Rejected by Zod validation
      const invalidUpdateRes = await new Promise<any>((resolve) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hostSocket.emit('update_settings', { settings: { difficulty: 'impossible' as any } }, resolve);
      });
      expect(invalidUpdateRes.success).toBe(false);

      // 5. Host updates difficulty to 'hard' -> Synchronized to guest
      const guestStatePromise = waitForEvent<RoomState>(guestSocket, 'room_state_updated');
      const hostUpdateRes = await new Promise<any>((resolve) => {
        hostSocket.emit('update_settings', { settings: { difficulty: 'hard' } }, resolve);
      });
      expect(hostUpdateRes.success).toBe(true);

      const guestState = await guestStatePromise;
      expect(guestState.settings.difficulty).toBe('hard');
      expect(roomManager.getRoom(roomCode)?.settings.difficulty).toBe('hard');
    });

    it('Locks difficulty during match and preserves it across rematches', async () => {
      const hostSocket = createClientSocket();
      const guestSocket = createClientSocket();

      const createRes = await new Promise<any>((resolve) => {
        hostSocket.emit('create_room', { nickname: 'HostPlayer', avatar: 'cyber-brain' }, resolve);
      });
      const roomCode = createRes.data.roomCode;

      await new Promise<any>((resolve) => {
        guestSocket.emit('join_room', { roomCode, nickname: 'GuestPlayer', avatar: 'plasma-dragon' }, resolve);
      });

      // Set difficulty to 'easy'
      const updateRes = await new Promise<any>((resolve) => {
        hostSocket.emit(
          'update_settings',
          { settings: { difficulty: 'easy', roundCount: 3, selectedModes: ['trivia'] } },
          resolve
        );
      });
      expect(updateRes.success).toBe(true);

      const room = roomManager.getRoom(roomCode)!;
      expect(room.settings.difficulty).toBe('easy');
      room.totalRounds = 1; // Accelerated for game over & rematch test

      // Start match
      const startRes = await new Promise<any>((resolve) => {
        hostSocket.emit('start_game', resolve);
      });
      expect(startRes.success).toBe(true);

      // Difficulty change during match -> Rejected (state is COUNTDOWN or ROUND_ACTIVE)
      const midGameUpdate = await new Promise<any>((resolve) => {
        hostSocket.emit('update_settings', { settings: { difficulty: 'hard' } }, resolve);
      });
      expect(midGameUpdate.success).toBe(false);
      expect(midGameUpdate.error).toContain('locked during an active match');

      // Wait for countdown to finish and round to start
      const roundStart = await waitForEvent<{ activeChallenge: any }>(hostSocket, 'round_started', 6000);
      expect(roundStart.activeChallenge).toBeDefined();

      const gameOverPromise = waitForEvent<any>(hostSocket, 'game_over', 10000);

      // Submit answers to conclude round
      hostSocket.emit('submit_trivia_answer', { answerIndex: 0, clientTimeMs: Date.now() });
      guestSocket.emit('submit_trivia_answer', { answerIndex: 0, clientTimeMs: Date.now() });

      // Wait for game over
      await gameOverPromise;

      // Play Again (Rematch)
      const playAgainRes = await new Promise<any>((resolve) => {
        hostSocket.emit('play_again', resolve);
      });
      expect(playAgainRes.success).toBe(true);

      // Rematch room must preserve difficulty: 'easy'
      const rematchedRoom = roomManager.getRoom(roomCode);
      expect(rematchedRoom?.settings.difficulty).toBe('easy');
    }, 16000);

    it('Preserves difficulty for reconnected players', async () => {
      const hostSocket = createClientSocket();

      const createRes = await new Promise<any>((resolve) => {
        hostSocket.emit('create_room', { nickname: 'Reconnector', avatar: 'quantum-cat' }, resolve);
      });
      const { roomCode, sessionToken } = createRes.data;

      // Set difficulty to 'hard'
      await new Promise<any>((resolve) => {
        hostSocket.emit('update_settings', { settings: { difficulty: 'hard' } }, resolve);
      });

      // Disconnect host
      hostSocket.disconnect();

      // New socket reconnects using sessionToken
      const reconnectSocket = createClientSocket();
      const reconnectRes = await new Promise<any>((resolve) => {
        reconnectSocket.emit('reconnect_player', { roomCode, sessionToken }, resolve);
      });

      expect(reconnectRes.success).toBe(true);
      expect(reconnectRes.data.room.settings.difficulty).toBe('hard');
    });
  });

  // ==========================================
  // Section 4: Rare Answer Uniqueness Scoring
  // ==========================================
  describe('4. Rare Answer Multiplayer Uniqueness Scoring Formula', () => {
    it(
      'Calculates uniqueness scoring: 100 bonus for unique answer, split bonus for duplicate, 0 for invalid',
      async () => {
        const hostSocket = createClientSocket();
        const player2Socket = createClientSocket();
        const player3Socket = createClientSocket();

        const createRes = await new Promise<any>((resolve) => {
          hostSocket.emit('create_room', { nickname: 'Alice', avatar: 'cyber-brain' }, resolve);
        });
        const roomCode = createRes.data.roomCode;

        await new Promise<any>((resolve) => {
          player2Socket.emit('join_room', { roomCode, nickname: 'Bob', avatar: 'astro-bot' }, resolve);
        });
        await new Promise<any>((resolve) => {
          player3Socket.emit('join_room', { roomCode, nickname: 'Charlie', avatar: 'plasma-dragon' }, resolve);
        });

        // Configure Rare Answer mode only
        const settingsRes = await new Promise<any>((resolve) => {
          hostSocket.emit(
            'update_settings',
            { settings: { roundCount: 3, selectedModes: ['rare_answer'], difficulty: 'medium' } },
            resolve
          );
        });
        expect(settingsRes.success).toBe(true);

        await new Promise<any>((resolve) => hostSocket.emit('start_game', resolve));

        // Wait for round started
        await waitForEvent<any>(hostSocket, 'round_started', 8000);

        // Inject known acceptable answers for this round via GameEngine
        const engine = getGameEngine();
        const secret = engine.getSecretChallenge(roomCode);
        expect(secret).toBeDefined();
        if (secret && secret.serverChallenge) {
          secret.serverChallenge.acceptableAnswers = ['helium', 'neon', 'argon', 'krypton'];
        }

        // Listen for round recap before emitting submissions
        const recapPromise = waitForEvent<any>(hostSocket, 'round_recap', 8000);

        // Alice and Bob both submit "Helium" (duplicate)
        // Charlie submits "Argon" (unique)
        await Promise.all([
          new Promise<any>((resolve) =>
            hostSocket.emit('submit_rare_answer', { answer: 'Helium', clientTimeMs: Date.now() }, resolve)
          ),
          new Promise<any>((resolve) =>
            player2Socket.emit('submit_rare_answer', { answer: 'helium', clientTimeMs: Date.now() }, resolve)
          ),
          new Promise<any>((resolve) =>
            player3Socket.emit('submit_rare_answer', { answer: 'Argon', clientTimeMs: Date.now() }, resolve)
          ),
        ]);

        // Simulate server deadline arrival for Rare Answer mode
        const room = roomManager.getRoom(roomCode);
        if (room) {
          engine.endRound(room, room.roundId || '');
        }

        const recap = await recapPromise;
        expect(recap.mode).toBe('rare_answer');

        const aliceResult = recap.results.find((r: any) => r.nickname === 'Alice');
        const bobResult = recap.results.find((r: any) => r.nickname === 'Bob');
        const charlieResult = recap.results.find((r: any) => r.nickname === 'Charlie');

        expect(aliceResult.isCorrect).toBe(true);
        expect(bobResult.isCorrect).toBe(true);
        expect(charlieResult.isCorrect).toBe(true);

        // Rarity counts: Alice and Bob matched (2), Charlie was unique (1)
        expect(aliceResult.rarityCount).toBe(2);
        expect(bobResult.rarityCount).toBe(2);
        expect(charlieResult.rarityCount).toBe(1);

        // Uniqueness scoring: Math.round(100 / countOfEquivalentAnswers), no speed bonus
        // Charlie (unique: count 1): Math.round(100 / 1) = 100
        // Alice & Bob (count 2): Math.round(100 / 2) = 50 each
        expect(charlieResult.pointsEarned).toBe(100);
        expect(aliceResult.pointsEarned).toBe(50);
        expect(bobResult.pointsEarned).toBe(50);
      },
      15000
    );
  });
});
