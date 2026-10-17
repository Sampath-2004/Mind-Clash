import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { httpServer } from '../src/index.js';
import { io as Client, Socket } from 'socket.io-client';
import { AddressInfo } from 'net';
import { roomManager } from '../src/managers/RoomManager.js';
import { getGameEngine } from '../src/socket/roomHandlers.js';
import {
  aiGenerator,
  triviaAiItemSchema,
  triviaBatchAiSchema,
} from '../src/services/aiGenerator.js';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  ServerResponseAck,
  ActiveChallengeClient,
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

describe('AI Question Generation, Structured Validation, and Failover Tests', () => {
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
    getGameEngine()?.clearAll();
    aiGenerator.setGeminiClient(null);
    aiGenerator.setOpenAiClient(null);
    aiGenerator.setFetch(fetch);
    aiGenerator.setForceProvider(null);
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  beforeEach(() => {
    roomManager.clearAll();
    getGameEngine()?.clearAll();
    aiGenerator.setGeminiClient(null);
    aiGenerator.setOpenAiClient(null);
    aiGenerator.setFetch(fetch);
    aiGenerator.setForceProvider(null);
  });

  // ==========================================
  // Section 1: Runtime Schema Validation Tests
  // ==========================================
  describe('1. Runtime Schema and Option Validation', () => {
    it('Validates structured item with exactly 4 distinct options and 1 correct answer', () => {
      const validItem = {
        category: 'Science',
        question: 'Which element has the chemical symbol Fe?',
        correctAnswer: 'Iron',
        incorrectAnswers: ['Gold', 'Silver', 'Copper'],
        explanation: 'Fe is derived from the Latin word ferrum, meaning iron.',
        difficulty: 'medium' as const,
      };

      const parsed = triviaAiItemSchema.safeParse(validItem);
      expect(parsed.success).toBe(true);
    });

    it('Rejects questions with duplicate options', () => {
      const duplicateOptionItem = {
        category: 'Science',
        question: 'Which planet is known as the Red Planet?',
        correctAnswer: 'Mars',
        incorrectAnswers: ['Venus', 'mars', 'Jupiter'], // 'mars' is duplicate of 'Mars'
        explanation: 'Mars appears red due to iron oxide on its surface.',
        difficulty: 'easy' as const,
      };

      const parsed = triviaAiItemSchema.safeParse(duplicateOptionItem);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toContain('4 distinct options');
      }
    });

    it('Rejects malformed questions with fewer than 3 incorrect answers', () => {
      const malformedItem = {
        category: 'History',
        question: 'In which year did the Apollo 11 moon landing take place?',
        correctAnswer: '1969',
        incorrectAnswers: ['1972', '1965'], // only 2 incorrect answers
        explanation: 'Apollo 11 landed on July 20, 1969.',
      };

      const parsed = triviaAiItemSchema.safeParse(malformedItem);
      expect(parsed.success).toBe(false);
    });

    it('Parses both { questions: [...] } envelope and direct array batches', () => {
      const batchObject = {
        questions: [
          {
            category: 'Geography',
            question: 'What is the capital city of Australia?',
            correctAnswer: 'Canberra',
            incorrectAnswers: ['Sydney', 'Melbourne', 'Brisbane'],
            explanation: 'Canberra was selected as the compromise capital between Sydney and Melbourne.',
          },
        ],
      };

      const parsedObj = triviaBatchAiSchema.safeParse(batchObject);
      expect(parsedObj.success).toBe(true);

      const parsedArr = triviaBatchAiSchema.safeParse(batchObject.questions);
      expect(parsedArr.success).toBe(true);
    });
  });

  // ==========================================
  // Section 2: Mocked Gemini Primary Success Flow
  // ==========================================
  describe('2. Primary Provider (Gemini) Successful Batch Generation', () => {
    it('Generates batch via Gemini, broadcasts PREPARING_QUESTIONS, and transitions to COUNTDOWN', async () => {
      const mockGemini = {
        getGenerativeModel: () => ({
          generateContent: async () => ({
            response: {
              text: () =>
                JSON.stringify({
                  questions: [
                    {
                      category: 'Science',
                      question: 'What is the chemical formula for water?',
                      correctAnswer: 'H2O',
                      incorrectAnswers: ['CO2', 'NaCl', 'CH4'],
                      explanation: 'Water consists of two hydrogen atoms bonded to one oxygen atom.',
                      difficulty: 'easy',
                    },
                    {
                      category: 'Technology',
                      question: 'Who is recognized as the principal creator of the World Wide Web?',
                      correctAnswer: 'Tim Berners-Lee',
                      incorrectAnswers: ['Bill Gates', 'Alan Turing', 'Steve Jobs'],
                      explanation: 'Tim Berners-Lee invented the World Wide Web in 1989 at CERN.',
                      difficulty: 'easy',
                    },
                    {
                      category: 'General Knowledge',
                      question: 'How many days are there in a standard leap year?',
                      correctAnswer: '366',
                      incorrectAnswers: ['365', '364', '360'],
                      explanation: 'A leap year contains 366 days instead of the usual 365 days.',
                      difficulty: 'easy',
                    },
                  ],
                }),
            },
          }),
        }),
      };

      aiGenerator.setGeminiClient(mockGemini);

      const host = createClientSocket();
      const p2 = createClientSocket();
      await Promise.all([ensureConnected(host), ensureConnected(p2)]);

      let roomCode = '';
      await new Promise<void>((res) => {
        host.emit('create_room', { nickname: 'HostCaptain', avatar: 'cyber-brain' }, (r) => {
          roomCode = r.data!.roomCode;
          res();
        });
      });

      await new Promise<void>((res) => {
        p2.emit('join_room', { roomCode, nickname: 'PlayerTwo', avatar: 'plasma-dragon' }, () => res());
      });

      // Update room to only 2 rounds of trivia for fast test
      await new Promise<void>((res) => {
        host.emit(
          'update_settings',
          { settings: { roundCount: 2, selectedModes: ['trivia'], difficulty: 'easy' } },
          () => res()
        );
      });

      const preparingPromise = waitForEvent<{ count: number; provider: string }>(
        p2,
        'questions_preparing'
      );
      const startingPromise = waitForEvent<{ countdownMs: number; serverTime: number }>(
        p2,
        'game_starting'
      );

      // Start match
      await new Promise<void>((res) => {
        host.emit('start_game', (resp) => {
          expect(resp.success).toBe(true);
          res();
        });
      });

      // Both players see preparing event
      const prepData = await preparingPromise;
      expect(prepData.count).toBe(2);
      expect(prepData.provider).toContain('Gemini');

      // Room transitions to COUNTDOWN once validated batch is ready
      const startingData = await startingPromise;
      expect(startingData.countdownMs).toBeGreaterThan(0);

      // Await Round 1 challenge
      const round1Data = await waitForEvent<{
        round: number;
        activeChallenge: ActiveChallengeClient;
      }>(host, 'round_started', 6000);

      expect(round1Data.round).toBe(1);
      expect(round1Data.activeChallenge.mode).toBe('trivia');
      if (round1Data.activeChallenge.mode === 'trivia') {
        const q = round1Data.activeChallenge.challenge;
        expect(q.options.length).toBe(4);
        expect(new Set(q.options).size).toBe(4);
        // Sensitive server fields NOT exposed to client
        expect((q as any).correctIndex).toBeUndefined();
        expect((q as any).explanation).toBeUndefined();
      }

      // Check stats: Gemini was used
      const stats = aiGenerator.getStats();
      expect(stats.gemini.requests).toBeGreaterThan(0);
      expect(stats.gemini.successes).toBeGreaterThan(0);
    }, 15000);
  });

  // ==========================================
  // Section 3: Gemini Quota/Failure -> OpenAI Fallback
  // ==========================================
  describe('3. Gemini Failure and Automatic OpenAI Fallback Chain', () => {
    it('Automatically falls back to OpenAI when Gemini throws quota exhaustion (HTTP 429)', async () => {
      // Mock Gemini to fail
      const mockGeminiFail = {
        getGenerativeModel: () => ({
          generateContent: async () => {
            throw new Error('Gemini quota exceeded (HTTP 429 RESOURCE_EXHAUSTED)');
          },
        }),
      };

      // Mock OpenAI to succeed
      const mockOpenAiSuccess = {
        chat: {
          completions: {
            create: async () => ({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      questions: [
                        {
                          category: 'History',
                          question: 'In which year did World War II end?',
                          correctAnswer: '1945',
                          incorrectAnswers: ['1939', '1944', '1950'],
                          explanation: 'World War II formally ended with the surrender of Japan in September 1945.',
                          difficulty: 'medium',
                        },
                        {
                          category: 'Science',
                          question: 'What is the chemical symbol for gold?',
                          correctAnswer: 'Au',
                          incorrectAnswers: ['Ag', 'Pt', 'Cu'],
                          explanation: 'Au is derived from the Latin word aurum, meaning gold.',
                          difficulty: 'medium',
                        },
                        {
                          category: 'Geography',
                          question: 'Which is the largest ocean on Earth?',
                          correctAnswer: 'Pacific Ocean',
                          incorrectAnswers: ['Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean'],
                          explanation: 'The Pacific Ocean is the largest and deepest ocean basin on Earth.',
                          difficulty: 'medium',
                        },
                      ],
                    }),
                  },
                },
              ],
            }),
          },
        },
      };

      aiGenerator.setGeminiClient(mockGeminiFail);
      aiGenerator.setOpenAiClient(mockOpenAiSuccess);

      const host = createClientSocket();
      const p2 = createClientSocket();
      await Promise.all([ensureConnected(host), ensureConnected(p2)]);

      let roomCode = '';
      await new Promise<void>((res) => {
        host.emit('create_room', { nickname: 'HostCaptain', avatar: 'cyber-brain' }, (r) => {
          roomCode = r.data!.roomCode;
          res();
        });
      });

      await new Promise<void>((res) => {
        p2.emit('join_room', { roomCode, nickname: 'PlayerTwo', avatar: 'plasma-dragon' }, () => res());
      });

      await new Promise<void>((res) => {
        host.emit(
          'update_settings',
          { settings: { roundCount: 1, selectedModes: ['trivia'], difficulty: 'medium' } },
          () => res()
        );
      });

      const startingPromise = waitForEvent(p2, 'game_starting');

      await new Promise<void>((res) => {
        host.emit('start_game', (resp) => {
          expect(resp.success).toBe(true);
          res();
        });
      });

      // Match successfully started via fallback
      await startingPromise;

      const round1 = await waitForEvent<{ activeChallenge: ActiveChallengeClient }>(
        host,
        'round_started',
        6000
      );
      if (round1.activeChallenge.mode === 'trivia') {
        expect(round1.activeChallenge.challenge.question).toContain('World War II');
      }

      // Check stats: Gemini failed, OpenAI succeeded
      const stats = aiGenerator.getStats();
      expect(stats.gemini.failures).toBeGreaterThan(0);
      expect(stats.openai.successes).toBeGreaterThan(0);
    }, 15000);

    it('Uses single configured provider when only OpenAI is available', async () => {
      const mockOpenAiOnly = {
        chat: {
          completions: {
            create: async () => ({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      questions: [
                        {
                          category: 'Science',
                          question: 'What is the speed of light in vacuum approximately?',
                          correctAnswer: '300,000 km/s',
                          incorrectAnswers: ['150,000 km/s', '3,000 km/s', '1,000,000 km/s'],
                          explanation: 'Light travels at approximately 299,792 kilometers per second in a vacuum.',
                          difficulty: 'medium',
                        },
                      ],
                    }),
                  },
                },
              ],
            }),
          },
        },
      };

      aiGenerator.setGeminiClient(null); // Gemini unconfigured
      aiGenerator.setOpenAiClient(mockOpenAiOnly);

      const batch = await aiGenerator.generateTriviaBatch({ count: 1, difficulty: 'medium' });
      expect(batch.length).toBe(1);
      expect(batch[0].question).toContain('speed of light');
    });
  });

  // ==========================================
  // Section 4: Dual Provider Failure & Interactive Host Choices
  // ==========================================
  describe('4. Both Providers Failing, No Silent Offline Fallback, and Explicit Host Options', () => {
    it('Halts in PREPARATION_FAILED when both providers fail, and never starts silently', async () => {
      // Mock both to fail
      const mockGeminiFail = {
        getGenerativeModel: () => ({
          generateContent: async () => {
            throw new Error('Gemini service unavailable');
          },
        }),
      };

      const mockOpenAiFail = {
        chat: {
          completions: {
            create: async () => {
              throw new Error('OpenAI rate limit exceeded');
            },
          },
        },
      };

      aiGenerator.setGeminiClient(mockGeminiFail);
      aiGenerator.setOpenAiClient(mockOpenAiFail);

      const host = createClientSocket();
      const p2 = createClientSocket();
      await Promise.all([ensureConnected(host), ensureConnected(p2)]);

      let roomCode = '';
      await new Promise<void>((res) => {
        host.emit('create_room', { nickname: 'HostCaptain', avatar: 'cyber-brain' }, (r) => {
          roomCode = r.data!.roomCode;
          res();
        });
      });

      await new Promise<void>((res) => {
        p2.emit('join_room', { roomCode, nickname: 'PlayerTwo', avatar: 'plasma-dragon' }, () => res());
      });

      await new Promise<void>((res) => {
        host.emit(
          'update_settings',
          { settings: { roundCount: 2, selectedModes: ['trivia'] } },
          () => res()
        );
      });

      const failedPromise = waitForEvent<{
        error: string;
        canRetry: boolean;
        canUseOffline: boolean;
      }>(p2, 'questions_preparation_failed');

      await new Promise<void>((res) => {
        host.emit('start_game', (resp) => {
          expect(resp.success).toBe(true);
          res();
        });
      });

      const failEvent = await failedPromise;
      expect(failEvent.canRetry).toBe(true);
      expect(failEvent.canUseOffline).toBe(true);
      expect(failEvent.error).toContain('failed across all providers');

      // Verify room status is PREPARATION_FAILED (did NOT silently start countdown)
      const room = roomManager.getRoom(roomCode);
      expect(room?.status).toBe('PREPARATION_FAILED');

      // Test Host Option: Play Offline Questions
      const offlineCountdownPromise = waitForEvent(p2, 'game_starting');

      await new Promise<void>((res) => {
        host.emit('use_offline_questions', (ack) => {
          expect(ack?.success).toBe(true);
          res();
        });
      });

      await offlineCountdownPromise;
      const startedRoom = roomManager.getRoom(roomCode);
      expect(startedRoom?.status).toBe('COUNTDOWN');
    }, 15000);

    it('Permits host to Retry AI Generation after failure once provider recovers', async () => {
      let geminiCallCount = 0;
      const mockGeminiRecover = {
        getGenerativeModel: () => ({
          generateContent: async () => {
            geminiCallCount++;
            if (geminiCallCount <= 2) {
              throw new Error('Temporary 503 Backend Error');
            }
            return {
              response: {
                text: () =>
                  JSON.stringify({
                    questions: [
                      {
                        category: 'Science',
                        question: 'What is the powerhouse of the cell?',
                        correctAnswer: 'Mitochondria',
                        incorrectAnswers: ['Ribosome', 'Nucleus', 'Endoplasmic Reticulum'],
                        explanation: 'Mitochondria generate most of the chemical energy needed by the cell.',
                        difficulty: 'easy',
                      },
                      {
                        category: 'Geography',
                        question: 'Which continent has the largest land area?',
                        correctAnswer: 'Asia',
                        incorrectAnswers: ['Africa', 'North America', 'Europe'],
                        explanation: 'Asia is Earth largest continent by land area and population.',
                        difficulty: 'easy',
                      },
                      {
                        category: 'History',
                        question: 'Who was the first President of the United States?',
                        correctAnswer: 'George Washington',
                        incorrectAnswers: ['Thomas Jefferson', 'John Adams', 'Benjamin Franklin'],
                        explanation: 'George Washington served as the first U.S. President from 1789 to 1797.',
                        difficulty: 'easy',
                      },
                    ],
                  }),
              },
            };
          },
        }),
      };

      aiGenerator.setGeminiClient(mockGeminiRecover);
      aiGenerator.setOpenAiClient({
        chat: { completions: { create: async () => { throw new Error('OpenAI unavailable'); } } },
      });

      const host = createClientSocket();
      const p2 = createClientSocket();
      await Promise.all([ensureConnected(host), ensureConnected(p2)]);

      let roomCode = '';
      await new Promise<void>((res) => {
        host.emit('create_room', { nickname: 'HostCaptain', avatar: 'cyber-brain' }, (r) => {
          roomCode = r.data!.roomCode;
          res();
        });
      });

      await new Promise<void>((res) => {
        p2.emit('join_room', { roomCode, nickname: 'PlayerTwo', avatar: 'plasma-dragon' }, () => res());
      });

      await new Promise<void>((res) => {
        host.emit(
          'update_settings',
          { settings: { roundCount: 1, selectedModes: ['trivia'], difficulty: 'easy' } },
          () => res()
        );
      });

      // Initial start will fail
      const failedPromise = waitForEvent(p2, 'questions_preparation_failed');
      host.emit('start_game');
      await failedPromise;

      // Host triggers retry_ai_generation
      const countdownPromise = waitForEvent(p2, 'game_starting');
      await new Promise<void>((res) => {
        host.emit('retry_ai_generation', (ack) => {
          expect(ack?.success).toBe(true);
          res();
        });
      });

      await countdownPromise;
      const room = roomManager.getRoom(roomCode);
      expect(room?.status).toBe('COUNTDOWN');
    }, 15000);
  });

  // ==========================================
  // Section 5: Stale Request Cancellation & Concurrency Throttling
  // ==========================================
  describe('5. Stale Request Cancellation & Concurrency Limits', () => {
    it('Cancels pending batch and returns to lobby when host calls cancel_match', async () => {
      // Mock Gemini with long delay
      const mockGeminiSlow = {
        getGenerativeModel: () => ({
          generateContent: async () => {
            await new Promise((r) => setTimeout(r, 2000));
            return {
              response: {
                text: () => JSON.stringify({ questions: [] }),
              },
            };
          },
        }),
      };

      aiGenerator.setGeminiClient(mockGeminiSlow);

      const host = createClientSocket();
      const p2 = createClientSocket();
      await Promise.all([ensureConnected(host), ensureConnected(p2)]);

      let roomCode = '';
      await new Promise<void>((res) => {
        host.emit('create_room', { nickname: 'HostCaptain', avatar: 'cyber-brain' }, (r) => {
          roomCode = r.data!.roomCode;
          res();
        });
      });

      await new Promise<void>((res) => {
        p2.emit('join_room', { roomCode, nickname: 'PlayerTwo', avatar: 'plasma-dragon' }, () => res());
      });

      // Start match
      host.emit('start_game');
      await waitForEvent(p2, 'questions_preparing');

      // Host cancels match
      await new Promise<void>((res) => {
        host.emit('cancel_match', (ack) => {
          expect(ack?.success).toBe(true);
          res();
        });
      });

      const room = roomManager.getRoom(roomCode);
      expect(room?.status).toBe('LOBBY');
    });

    it('Rejects duplicate start calls while room is currently preparing questions', async () => {
      const mockGeminiSlow = {
        getGenerativeModel: () => ({
          generateContent: async () => {
            await new Promise((r) => setTimeout(r, 2000));
            return { response: { text: () => JSON.stringify({ questions: [] }) } };
          },
        }),
      };

      aiGenerator.setGeminiClient(mockGeminiSlow);

      const host = createClientSocket();
      const p2 = createClientSocket();
      await Promise.all([ensureConnected(host), ensureConnected(p2)]);

      let roomCode = '';
      await new Promise<void>((res) => {
        host.emit('create_room', { nickname: 'HostCaptain', avatar: 'cyber-brain' }, (r) => {
          roomCode = r.data!.roomCode;
          res();
        });
      });

      await new Promise<void>((res) => {
        p2.emit('join_room', { roomCode, nickname: 'PlayerTwo', avatar: 'plasma-dragon' }, () => res());
      });

      // First start
      host.emit('start_game');
      await waitForEvent(p2, 'questions_preparing');

      // Immediate second start call should be rejected
      let duplicateResult: ServerResponseAck | undefined;
      await new Promise<void>((res) => {
        host.emit('start_game', (resp) => {
          duplicateResult = resp;
          res();
        });
      });

      expect(duplicateResult?.success).toBe(false);
      expect(duplicateResult?.error).toContain('PREPARING_QUESTIONS');
    });
  });
});
