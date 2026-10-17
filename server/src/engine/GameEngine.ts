import crypto from 'crypto';
import { Server } from 'socket.io';
import {
  RoomState,
  GameMode,
  ActiveChallengeClient,
  TriviaQuestionServer,
  MathQuestionServer,
  MemoryChallengeServer,
  ReactionChallengeServer,
  PlayerRoundResult,
  RoundRecapData,
  GameOverPodiumData,
  FinalGameAccolade,
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
  SCORING,
  GAME_START_COUNTDOWN_MS,
  ROUND_RECAP_DURATION_MS,
  NETWORK_LATENCY_BUFFER_MS,
  DEFAULT_QUESTION_DURATION_MS,
  deterministicPlayerSort,
  RareAnswerChallengeServer,
  RareAnswerSubmissionResult,
  RARE_ANSWER_ROUND_DURATION_MS,
} from '@mind-clash/shared';
import { generateMathQuestion } from '../modes/mathGenerator.js';
import { generateMemoryChallenge } from '../modes/memoryGenerator.js';
import { generateReactionChallenge } from '../modes/reactionGenerator.js';
import { aiGenerator } from '../services/aiGenerator.js';
import { duplicatePrevention } from '../services/duplicatePrevention.js';
import { logger } from '../utils/logger.js';

export interface PlayerSubmission {
  playerId: string;
  roundId: string;
  receivedAt: number;
  answer?: number; // Trivia option index, Math answer, or Reaction trigger click
  selectedIndices?: number[]; // Memory tiles
  sequence?: string[]; // Memory symbol sequence
  textAnswer?: string; // Rare Answer text submission
  falseStart?: boolean;
}

type SecretChallenge =
  | { mode: 'trivia'; serverChallenge: TriviaQuestionServer }
  | { mode: 'math'; serverChallenge: MathQuestionServer }
  | { mode: 'memory'; serverChallenge: MemoryChallengeServer }
  | { mode: 'reaction'; serverChallenge: ReactionChallengeServer }
  | { mode: 'rare_answer'; serverChallenge: RareAnswerChallengeServer };

export class GameEngine {
  private io: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
  private activeTimers = new Map<string, NodeJS.Timeout>(); // roomCode -> active timer
  private secretChallenges = new Map<string, SecretChallenge>(); // roomCode -> secret challenge
  private submissions = new Map<string, Map<string, PlayerSubmission>>(); // roomCode -> (playerId -> submission)
  private previousRanks = new Map<string, Map<string, number>>(); // roomCode -> (playerId -> rank)
  private usedTriviaIds = new Map<string, Set<string>>(); // roomCode -> used question ids
  private usedRareIds = new Map<string, Set<string>>(); // roomCode -> used rare answer ids
  private modeSchedules = new Map<string, GameMode[]>(); // roomCode -> planned mode rotation
  private clientChallenges = new Map<string, ActiveChallengeClient>(); // roomCode -> current client challenge
  private lastRecaps = new Map<string, RoundRecapData>(); // roomCode -> latest round recap
  private lastPodiums = new Map<string, GameOverPodiumData>(); // roomCode -> latest podium
  private preparedTriviaBatches = new Map<string, TriviaQuestionServer[]>(); // roomCode -> batch
  private preparedRareBatches = new Map<string, RareAnswerChallengeServer[]>(); // roomCode -> batch
  private voidReplacementsCount = new Map<string, number>(); // roomCode -> void count
  private batchAbortControllers = new Map<string, AbortController>(); // roomCode -> abort controller

  constructor(
    io: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>
  ) {
    this.io = io;
  }

  public setSocketServer(
    io: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>
  ) {
    this.io = io;
  }

  /**
   * Generates a randomized mode rotation schedule for the match.
   * Ensures every selected mode appears fairly without rigid predictable ordering.
   */
  public generateModeSchedule(totalRounds: number, selectedModes: GameMode[]): GameMode[] {
    if (!selectedModes || selectedModes.length === 0) {
      return Array(totalRounds).fill('trivia');
    }
    if (selectedModes.length === 1) {
      return Array(totalRounds).fill(selectedModes[0]);
    }

    const schedule: GameMode[] = [selectedModes[0]];
    while (schedule.length < totalRounds) {
      const bag = [...selectedModes];
      // Fisher-Yates shuffle
      for (let i = bag.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      // If bag's first element matches last element in schedule, swap to avoid consecutive repeats
      if (schedule.length > 0 && bag[0] === schedule[schedule.length - 1] && bag.length > 1) {
        [bag[0], bag[1]] = [bag[1], bag[0]];
      }
      schedule.push(...bag);
    }
    return schedule.slice(0, totalRounds);
  }

  /**
   * Starts a game from the lobby.
  /**
   * Starts a game from the lobby or after preparation failure.
   */
  public async startGame(room: RoomState): Promise<void> {
    if (room.status !== 'LOBBY' && room.status !== 'PREPARATION_FAILED') {
      throw new Error(`Cannot start match: Room is currently in ${room.status} status`);
    }

    const connectedPlayers = room.players.filter((p) => p.isConnected);
    if (connectedPlayers.length < 2) {
      throw new Error('Need at least 2 connected players to start the match');
    }

    // Cancel any previous pending batch generation
    this.cancelPendingBatch(room.roomCode);

    // Initialize/reset match state
    room.totalRounds = room.totalRounds || room.settings.roundCount || 5;
    room.currentRound = 1;
    this.submissions.set(room.roomCode, new Map());
    this.previousRanks.set(room.roomCode, new Map());
    if (!this.usedTriviaIds.has(room.roomCode)) {
      this.usedTriviaIds.set(room.roomCode, new Set());
    }
    if (!this.usedRareIds.has(room.roomCode)) {
      this.usedRareIds.set(room.roomCode, new Set());
    }

    // Generate randomized mode schedule for the match
    const schedule = this.generateModeSchedule(room.totalRounds, room.settings.selectedModes);
    this.modeSchedules.set(room.roomCode, schedule);

    // Reset scores, streaks, and match stats
    room.players.forEach((p) => {
      p.score = 0;
      p.streak = 0;
      p.stats = {
        triviaCorrect: 0,
        triviaTotal: 0,
        mathCorrect: 0,
        mathTotal: 0,
        memoryPerfectCount: 0,
        fastestReactionMs: null,
        rareAnswerCorrect: 0,
        rareAnswerTotal: 0,
        highestStreak: 0,
      };
    });

    const triviaRoundsCount = schedule.filter((m) => m === 'trivia').length;
    const rareRoundsCount = schedule.filter((m) => m === 'rare_answer').length;

    if (triviaRoundsCount === 0 && rareRoundsCount === 0) {
      this.beginCountdown(room);
      return;
    }

    // Question generation required: Enter PREPARING_QUESTIONS state
    room.status = 'PREPARING_QUESTIONS';
    const primaryProviderName = aiGenerator.getPrimaryProviderName();

    this.io.to(room.roomCode).emit('room_state_updated', this.sanitizeRoom(room));
    this.io.to(room.roomCode).emit('questions_preparing', {
      count: triviaRoundsCount + rareRoundsCount,
      provider: primaryProviderName,
    });

    // Run batch preparation asynchronously
    this.executeBatchPreparation(room, triviaRoundsCount, rareRoundsCount);
  }

  private async executeBatchPreparation(
    room: RoomState,
    triviaCount: number,
    rareCount: number
  ): Promise<void> {
    const controller = new AbortController();
    this.batchAbortControllers.set(room.roomCode, controller);

    try {
      if (triviaCount > 0) {
        const batch = await aiGenerator.generateTriviaBatch({
          count: triviaCount,
          difficulty: room.settings.difficulty || 'medium',
          signal: controller.signal,
          usedIds: this.usedTriviaIds.get(room.roomCode),
          roomCode: room.roomCode,
        });
        this.preparedTriviaBatches.set(room.roomCode, batch);
      }

      if (rareCount > 0) {
        const rareBatch = await aiGenerator.generateRareAnswerBatch({
          count: rareCount,
          difficulty: room.settings.difficulty || 'medium',
          signal: controller.signal,
          usedIds: this.usedRareIds.get(room.roomCode),
          roomCode: room.roomCode,
        });
        this.preparedRareBatches.set(room.roomCode, rareBatch);
      }

      // Ignore if aborted or room status transitioned away from PREPARING_QUESTIONS
      if (controller.signal.aborted || room.status !== 'PREPARING_QUESTIONS') {
        await aiGenerator.releaseBatchReservation(room.roomCode);
        return;
      }

      // Check if enough players remain connected
      const connected = room.players.filter((p) => p.isConnected);
      if (connected.length < 2) {
        this.returnToLobby(room);
        this.io.to(room.roomCode).emit('error_message', {
          message: 'Match start cancelled: Fewer than 2 players remain connected.',
        });
        return;
      }

      this.batchAbortControllers.delete(room.roomCode);

      // Begin countdown only after complete, validated batches are ready
      this.beginCountdown(room);
    } catch (err: unknown) {
      await aiGenerator.releaseBatchReservation(room.roomCode);
      if (controller.signal.aborted || room.status !== 'PREPARING_QUESTIONS') {
        return;
      }

      this.batchAbortControllers.delete(room.roomCode);
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`[GameEngine] Failed to prepare AI batch for room ${room.roomCode}`, {
        error: message,
      });

      room.status = 'PREPARATION_FAILED';
      this.io.to(room.roomCode).emit('room_state_updated', this.sanitizeRoom(room));
      this.io.to(room.roomCode).emit('questions_preparation_failed', {
        error: message,
        canRetry: true,
        canUseOffline: true,
      });
    }
  }

  /**
   * Retries AI question batch generation after failure.
   */
  public async retryAiGeneration(room: RoomState): Promise<void> {
    if (room.status !== 'PREPARATION_FAILED') {
      throw new Error(`Cannot retry question generation: Room is in ${room.status} status`);
    }

    const connectedPlayers = room.players.filter((p) => p.isConnected);
    if (connectedPlayers.length < 2) {
      throw new Error('Need at least 2 connected players to start the match');
    }

    const schedule = this.modeSchedules.get(room.roomCode) || [];
    const triviaCount = schedule.filter((m) => m === 'trivia').length;
    const rareCount = schedule.filter((m) => m === 'rare_answer').length;

    room.status = 'PREPARING_QUESTIONS';
    const primaryProviderName = aiGenerator.getPrimaryProviderName();

    this.io.to(room.roomCode).emit('room_state_updated', this.sanitizeRoom(room));
    this.io.to(room.roomCode).emit('questions_preparing', {
      count: triviaCount + rareCount,
      provider: primaryProviderName,
    });

    this.executeBatchPreparation(room, triviaCount, rareCount);
  }

  /**
   * Host explicit choice: Play offline questions when AI generation fails.
   */
  public async useOfflineQuestions(room: RoomState): Promise<void> {
    if (room.status !== 'PREPARATION_FAILED') {
      throw new Error(`Cannot choose offline questions: Room is in ${room.status} status`);
    }

    const connectedPlayers = room.players.filter((p) => p.isConnected);
    if (connectedPlayers.length < 2) {
      throw new Error('Need at least 2 connected players to start the match');
    }

    const schedule = this.modeSchedules.get(room.roomCode) || [];
    const triviaCount = schedule.filter((m) => m === 'trivia').length;
    const rareCount = schedule.filter((m) => m === 'rare_answer').length;

    try {
      if (triviaCount > 0) {
        const used = this.usedTriviaIds.get(room.roomCode) || new Set();
        const batch = await aiGenerator.generateOfflineBatch(
          triviaCount,
          room.settings.difficulty || 'medium',
          used,
          room.roomCode
        );
        this.preparedTriviaBatches.set(room.roomCode, batch);
      }

      if (rareCount > 0) {
        const usedRare = this.usedRareIds.get(room.roomCode) || new Set();
        const rareBatch = await aiGenerator.generateOfflineRareBatch(
          rareCount,
          room.settings.difficulty || 'medium',
          usedRare,
          room.roomCode
        );
        this.preparedRareBatches.set(room.roomCode, rareBatch);
      }

      this.beginCountdown(room);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`[GameEngine] Failed to prepare offline batches for room ${room.roomCode}`, {
        error: message,
      });

      room.status = 'PREPARATION_FAILED';
      this.io.to(room.roomCode).emit('room_state_updated', this.sanitizeRoom(room));
      this.io.to(room.roomCode).emit('questions_preparation_failed', {
        error: message,
        canRetry: true,
        canUseOffline: false,
      });
    }
  }

  /**
   * Host explicit choice: Cancel match preparation and return to lobby.
   */
  public cancelMatch(room: RoomState): void {
    if (room.status !== 'PREPARING_QUESTIONS' && room.status !== 'PREPARATION_FAILED') {
      throw new Error(`Cannot cancel match: Room is in ${room.status} status`);
    }
    this.cancelPendingBatch(room.roomCode);
    this.returnToLobby(room);
  }

  private beginCountdown(room: RoomState): void {
    aiGenerator.commitBatchReservation(room.roomCode).catch((err) => {
      logger.warn(`[GameEngine] Failed to commit reservation for room ${room.roomCode}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    });
    room.status = 'COUNTDOWN';
    const now = Date.now();
    this.io.to(room.roomCode).emit('game_starting', {
      countdownMs: GAME_START_COUNTDOWN_MS,
      serverTime: now,
    });
    this.io.to(room.roomCode).emit('room_state_updated', this.sanitizeRoom(room));

    // Schedule transition to Round 1 after synchronized countdown
    this.scheduleTimer(room.roomCode, GAME_START_COUNTDOWN_MS, () => {
      this.startRound(room, 1);
    });
  }

  private cancelPendingBatch(roomCode: string): void {
    const existing = this.batchAbortControllers.get(roomCode);
    if (existing) {
      existing.abort();
      this.batchAbortControllers.delete(roomCode);
    }
    this.preparedTriviaBatches.delete(roomCode);
    this.preparedRareBatches.delete(roomCode);
    aiGenerator.releaseBatchReservation(roomCode).catch(() => {});
  }

  /**
   * Initiates a synchronized round.
   */
  public async startRound(room: RoomState, roundNumber: number): Promise<void> {
    room.status = 'ROUND_ACTIVE';
    room.currentRound = roundNumber;

    // Pick mode based on randomized mode rotation schedule
    let schedule = this.modeSchedules.get(room.roomCode);
    if (!schedule || schedule.length !== room.totalRounds) {
      schedule = this.generateModeSchedule(room.totalRounds, room.settings.selectedModes);
      this.modeSchedules.set(room.roomCode, schedule);
    }
    const mode: GameMode =
      schedule[roundNumber - 1] ||
      room.settings.selectedModes[(roundNumber - 1) % room.settings.selectedModes.length];
    room.activeMode = mode;

    const roundId = `r-${roundNumber}-${crypto.randomUUID().slice(0, 8)}`;
    room.roundId = roundId;

    const startTime = Date.now();
    const difficulty = room.settings.difficulty || 'medium';
    let durationMs: number;

    let secretChallenge: SecretChallenge;
    let clientChallenge: ActiveChallengeClient;

    if (mode === 'trivia') {
      let question: TriviaQuestionServer | undefined;
      const batch = this.preparedTriviaBatches.get(room.roomCode);
      if (batch && batch.length > 0) {
        question = batch.shift();
      }

      // Safety fallback if batch was empty
      if (!question) {
        const used = this.usedTriviaIds.get(room.roomCode) || new Set();
        question = await aiGenerator.generateTriviaQuestion(difficulty, used, room.roomCode);
      }

      const used = this.usedTriviaIds.get(room.roomCode) || new Set();
      used.add(question.id);
      this.usedTriviaIds.set(room.roomCode, used);

      secretChallenge = { mode: 'trivia', serverChallenge: question };
      durationMs = question.durationMs || DEFAULT_QUESTION_DURATION_MS;

      clientChallenge = {
        mode: 'trivia',
        challenge: {
          id: question.id,
          category: question.category,
          question: question.question,
          options: question.options,
          durationMs,
          difficulty: question.difficulty,
        },
      };
    } else if (mode === 'math') {
      const math = generateMathQuestion(roundNumber, difficulty);
      secretChallenge = { mode: 'math', serverChallenge: math };
      durationMs = math.durationMs || DEFAULT_QUESTION_DURATION_MS;

      clientChallenge = {
        mode: 'math',
        challenge: {
          id: math.id,
          prompt: math.prompt,
          options: math.options,
          durationMs,
        },
      };
    } else if (mode === 'memory') {
      const memory = generateMemoryChallenge(roundNumber, startTime, difficulty);
      secretChallenge = { mode: 'memory', serverChallenge: memory };
      durationMs = memory.viewingDurationMs + memory.inputDurationMs;

      clientChallenge = {
        mode: 'memory',
        challenge: {
          id: memory.id,
          symbols: memory.symbols,
          sequence: memory.sequence,
          viewingDurationMs: memory.viewingDurationMs,
          inputDurationMs: memory.inputDurationMs,
          viewingEndTime: memory.viewingEndTime,
          gridSize: memory.gridSize,
          pattern: memory.pattern,
          revealDurationMs: memory.revealDurationMs,
        },
      };
    } else if (mode === 'rare_answer') {
      const used = this.usedRareIds.get(room.roomCode) || new Set();
      let rare: RareAnswerChallengeServer;
      const preparedBatch = this.preparedRareBatches.get(room.roomCode);
      if (preparedBatch && preparedBatch.length > 0) {
        rare = preparedBatch.shift()!;
      } else {
        rare = await aiGenerator.generateRareAnswerChallenge(difficulty, used, room.roomCode);
      }
      used.add(rare.id);
      this.usedRareIds.set(room.roomCode, used);

      secretChallenge = { mode: 'rare_answer', serverChallenge: rare };
      durationMs = rare.durationMs || RARE_ANSWER_ROUND_DURATION_MS;

      clientChallenge = {
        mode: 'rare_answer',
        challenge: {
          id: rare.id,
          category: rare.category,
          prompt: rare.prompt,
          difficulty: rare.difficulty,
          durationMs,
        },
      };
    } else {
      // Reaction
      const rx = generateReactionChallenge(startTime, difficulty);
      secretChallenge = { mode: 'reaction', serverChallenge: rx };
      durationMs = rx.waitDelayMs + rx.timeoutMs;

      clientChallenge = {
        mode: 'reaction',
        challenge: {
          id: rx.id,
          waitDelayMs: rx.waitDelayMs,
          targetActivationTime: rx.targetActivationTime,
          timeoutMs: rx.timeoutMs,
          networkNotice: rx.networkNotice,
        },
      };
    }

    const endTime = startTime + durationMs;
    room.roundStartTime = startTime;
    room.roundEndTime = endTime;

    this.secretChallenges.set(room.roomCode, secretChallenge);
    this.clientChallenges.set(room.roomCode, clientChallenge);
    this.submissions.set(room.roomCode, new Map());

    // Record previous ranks before this round's scoring using deterministic player sort
    const rankMap = new Map<string, number>();
    const sorted = [...room.players].sort(deterministicPlayerSort);
    sorted.forEach((p, idx) => rankMap.set(p.id, idx + 1));
    this.previousRanks.set(room.roomCode, rankMap);

    const now = Date.now();
    this.io.to(room.roomCode).emit('round_started', {
      round: roundNumber,
      totalRounds: room.totalRounds,
      roundId,
      activeChallenge: clientChallenge,
      startTime,
      endTime,
      serverTime: now,
    });
    this.io.to(room.roomCode).emit('room_state_updated', this.sanitizeRoom(room));

    // Schedule authoritative round timer with network latency buffer
    this.scheduleTimer(room.roomCode, durationMs + NETWORK_LATENCY_BUFFER_MS, () => {
      this.endRound(room, roundId);
    });
  }

  /**
   * Accepts and validates player round submission.
   */
  public submitAnswer(
    room: RoomState,
    playerId: string,
    submission: {
      answer?: number;
      selectedIndices?: number[];
      sequence?: string[];
      textAnswer?: string;
      clientTimeMs: number;
    }
  ): { success: boolean; error?: string } {
    if (room.status !== 'ROUND_ACTIVE') {
      return { success: false, error: 'No active round in progress' };
    }

    const now = Date.now();
    const startTime = room.roundStartTime || 0;
    const endTime = (room.roundEndTime || 0) + NETWORK_LATENCY_BUFFER_MS;

    // Disallow premature or expired answers
    if (now < startTime) {
      return { success: false, error: 'Submission received before round started' };
    }
    if (now > endTime) {
      return { success: false, error: 'Submission received after round ended' };
    }

    const secret = this.secretChallenges.get(room.roomCode);

    // In Rare Answer, allow edits until the server deadline
    if (secret?.mode === 'rare_answer' || room.activeMode === 'rare_answer') {
      const roomSubmissions = this.submissions.get(room.roomCode) || new Map();
      const playerSub: PlayerSubmission = {
        playerId,
        roundId: room.roundId || '',
        receivedAt: now,
        textAnswer: submission.textAnswer?.trim(),
        falseStart: false,
      };
      roomSubmissions.set(playerId, playerSub);
      this.submissions.set(room.roomCode, roomSubmissions);

      // Acknowledge submission to all players without revealing the answer
      this.io.to(room.roomCode).emit('submission_acknowledged', { playerId });

      // Edits allowed until deadline: do NOT conclude round early
      return { success: true };
    }

    // Check idempotency (prevent multiple submissions for non-editable rounds)
    const roomSubmissions = this.submissions.get(room.roomCode) || new Map();
    if (roomSubmissions.has(playerId)) {
      return { success: false, error: 'Answer already submitted for this round' };
    }

    // Prevent early submission and replay exploits in Memory mode
    if (secret?.mode === 'memory' && secret.serverChallenge.viewingEndTime) {
      if (now < secret.serverChallenge.viewingEndTime) {
        return {
          success: false,
          error: 'Premature submission rejected: viewing period is still active',
        };
      }
    }

    // Special check for reaction false start (clicking before synchronized activation)
    let falseStart = false;
    if (secret?.mode === 'reaction') {
      if (now < secret.serverChallenge.triggerTimestamp) {
        falseStart = true;
      }
    }

    const playerSub: PlayerSubmission = {
      playerId,
      roundId: room.roundId || '',
      receivedAt: now,
      answer: submission.answer,
      selectedIndices: submission.selectedIndices,
      sequence: submission.sequence,
      textAnswer: submission.textAnswer?.trim(),
      falseStart,
    };

    roomSubmissions.set(playerId, playerSub);
    this.submissions.set(room.roomCode, roomSubmissions);

    // Acknowledge submission to all players without revealing the answer
    this.io.to(room.roomCode).emit('submission_acknowledged', { playerId });

    // If all currently connected players have submitted, conclude round early
    const connectedPlayers = room.players.filter((p) => p.isConnected);
    if (connectedPlayers.every((p) => roomSubmissions.has(p.id))) {
      this.clearTimer(room.roomCode);
      this.endRound(room, room.roundId || '');
    }

    return { success: true };
  }

  /**
   * Evaluates scores, resolves round recap, and transitions to intermission.
   */
  public endRound(room: RoomState, roundId: string): void {
    // Prevent duplicate round end transitions
    if (room.status !== 'ROUND_ACTIVE' || room.roundId !== roundId) {
      return;
    }

    this.clearTimer(room.roomCode);
    const secret = this.secretChallenges.get(room.roomCode);

    if (secret?.mode === 'rare_answer') {
      this.handleRareAnswerRoundEnd(room, roundId, secret.serverChallenge);
      return;
    }

    room.status = 'ROUND_RECAP';
    this.resolveRoundRecap(room, roundId, secret);
  }

  private resolveRoundRecap(room: RoomState, roundId: string, secret?: SecretChallenge): void {
    const roomSubmissions = this.submissions.get(room.roomCode) || new Map();
    const prevRanks = this.previousRanks.get(room.roomCode) || new Map();

    const roundDuration = (room.roundEndTime || Date.now()) - (room.roundStartTime || Date.now());
    const results: PlayerRoundResult[] = [];
    const pointsEarnedMap = new Map<string, number>();
    const isCorrectMap = new Map<string, boolean>();
    const timeSpentMap = new Map<string, number | undefined>();
    const rarityCountMap = new Map<string, number | undefined>();

    // Calculate score for each player
    room.players.forEach((player) => {
      const sub = roomSubmissions.get(player.id);
      let isCorrect = false;
      let pointsEarned = 0;
      let timeSpentMs: number | undefined;

      if (sub) {
        timeSpentMs = Math.max(0, sub.receivedAt - (room.roundStartTime || 0));
        const remainingRatio = Math.max(
          0,
          Math.min(1, ((room.roundEndTime || 0) - sub.receivedAt) / roundDuration)
        );

        if (secret?.mode === 'trivia') {
          player.stats.triviaTotal++;
          if (sub.answer === secret.serverChallenge.correctIndex) {
            isCorrect = true;
            player.stats.triviaCorrect++;
            const speedBonus = Math.floor(SCORING.TRIVIA.MAX_SPEED_BONUS * remainingRatio);
            pointsEarned = SCORING.TRIVIA.BASE_POINTS + speedBonus;
          }
        } else if (secret?.mode === 'math') {
          player.stats.mathTotal++;
          if (sub.answer === secret.serverChallenge.correctAnswer) {
            isCorrect = true;
            player.stats.mathCorrect++;
            const speedBonus = Math.floor(SCORING.MATH.MAX_SPEED_BONUS * remainingRatio);
            pointsEarned = SCORING.MATH.BASE_POINTS + speedBonus;
          }
        } else if (secret?.mode === 'memory') {
          // Symbol sequence reproduction check
          if (sub.sequence && secret.serverChallenge.solutionSequence) {
            const solutionSeq = secret.serverChallenge.solutionSequence;
            const submittedSeq = sub.sequence;

            let exactOrderMatches = 0;
            const checkLen = Math.min(solutionSeq.length, submittedSeq.length);
            for (let i = 0; i < checkLen; i++) {
              if (solutionSeq[i] === submittedSeq[i]) {
                exactOrderMatches++;
              }
            }

            const isPerfect =
              exactOrderMatches === solutionSeq.length && submittedSeq.length === solutionSeq.length;

            if (isPerfect) {
              isCorrect = true;
              player.stats.memoryPerfectCount++;
              const speedBonus = Math.floor(50 * remainingRatio);
              pointsEarned = 100 + speedBonus;
            } else {
              isCorrect = false;
              // Partial accuracy points: 15 pts per correctly positioned symbol
              pointsEarned = exactOrderMatches * 15;
            }
          } else {
            // Tile pattern fallback
            const solution = secret.serverChallenge.solution;
            const chosen = sub.selectedIndices || [];

            let correctHits = 0;
            let wrongHits = 0;
            chosen.forEach((idx: number) => {
              if (solution.includes(idx)) correctHits++;
              else wrongHits++;
            });

            if (correctHits === solution.length && wrongHits === 0) {
              isCorrect = true;
              player.stats.memoryPerfectCount++;
              pointsEarned =
                SCORING.MEMORY.BASE_POINTS +
                correctHits * SCORING.MEMORY.PER_CORRECT_TILE +
                SCORING.MEMORY.ALL_CORRECT_BONUS;
            } else {
              pointsEarned = Math.max(
                0,
                correctHits * SCORING.MEMORY.PER_CORRECT_TILE -
                  wrongHits * SCORING.MEMORY.PER_WRONG_TILE_PENALTY
              );
            }
          }
        } else if (secret?.mode === 'reaction') {
          if (sub.falseStart) {
            pointsEarned = SCORING.REACTION.FALSE_START_PENALTY;
            isCorrect = false;
          } else {
            isCorrect = true;
            // Latency-aware reflex timing
            const rawReflexMs = Math.max(0, sub.receivedAt - secret.serverChallenge.triggerTimestamp);
            const reflexMs = Math.max(15, rawReflexMs);
            if (!player.stats.fastestReactionMs || reflexMs < player.stats.fastestReactionMs) {
              player.stats.fastestReactionMs = reflexMs;
            }
            // Latency-aware scoring: 100 base + speed bonus up to 50 pts
            const speedBonus = Math.max(
              0,
              Math.min(50, Math.floor(50 * (1 - (reflexMs - 150) / 850)))
            );
            pointsEarned = 100 + speedBonus;
            timeSpentMs = reflexMs;
          }
        }
      }

      // Update streaks
      if (isCorrect) {
        player.streak++;
        player.stats.highestStreak = Math.max(player.stats.highestStreak, player.streak);
      } else {
        player.streak = 0;
      }

      player.score += pointsEarned;
      pointsEarnedMap.set(player.id, pointsEarned);
      isCorrectMap.set(player.id, isCorrect);
      timeSpentMap.set(player.id, timeSpentMs);
    });

    // Compute updated ranks and rank deltas using deterministic player sort
    const sortedPlayers = [...room.players].sort(deterministicPlayerSort);
    sortedPlayers.forEach((player, idx) => {
      const currentRank = idx + 1;
      const prevRank = prevRanks.get(player.id) || currentRank;
      const rankDelta = prevRank - currentRank; // positive = moved up in rank

      const sub = roomSubmissions.get(player.id);
      results.push({
        playerId: player.id,
        nickname: player.nickname,
        avatar: player.avatar,
        pointsEarned: pointsEarnedMap.get(player.id) || 0,
        totalScore: player.score,
        rank: currentRank,
        rankDelta,
        isCorrect: isCorrectMap.get(player.id) || false,
        timeSpentMs: timeSpentMap.get(player.id),
        falseStart: sub?.falseStart,
        submittedAnswerText: sub?.textAnswer,
        rarityCount: rarityCountMap.get(player.id),
      });
    });

    const reactionSubs = Array.from(roomSubmissions.values()).filter((s) => !s.falseStart);
    const fastestReaction =
      secret?.mode === 'reaction' && reactionSubs.length > 0
        ? Math.min(...reactionSubs.map((s) => Math.max(15, s.receivedAt - secret.serverChallenge.triggerTimestamp)))
        : undefined;

    // Formulate round recap with revealed solutions
    const recapData: RoundRecapData = {
      roundNumber: room.currentRound,
      totalRounds: room.totalRounds,
      mode: room.activeMode || 'trivia',
      difficulty: room.settings.difficulty,
      results,
      triviaRevealIndex:
        secret?.mode === 'trivia' ? secret.serverChallenge.correctIndex : undefined,
      triviaCorrectText:
        secret?.mode === 'trivia'
          ? secret.serverChallenge.options[secret.serverChallenge.correctIndex]
          : undefined,
      mathCorrectAnswer:
        secret?.mode === 'math' ? secret.serverChallenge.correctAnswer : undefined,
      memorySolution:
        secret?.mode === 'memory' ? secret.serverChallenge.solution : undefined,
      memorySequence:
        secret?.mode === 'memory' ? secret.serverChallenge.solutionSequence : undefined,
      reactionFastestMs: fastestReaction,
      rareAnswerPrompt:
        secret?.mode === 'rare_answer' ? secret.serverChallenge.prompt : undefined,
      rareAnswerAcceptedList:
        secret?.mode === 'rare_answer' ? secret.serverChallenge.acceptableAnswers.slice(0, 15) : undefined,
      networkNotice:
        secret?.mode === 'reaction'
          ? secret.serverChallenge.networkNotice
          : undefined,
      explanation:
        secret?.mode === 'trivia'
          ? secret.serverChallenge.explanation
          : secret?.mode === 'math'
          ? `Verified solution: ${secret.serverChallenge.correctAnswer}`
          : secret?.mode === 'memory'
          ? `Target sequence: ${secret.serverChallenge.solutionSequence?.join(' → ')}`
          : secret?.mode === 'rare_answer'
          ? `Category: ${secret.serverChallenge.category} — Rarer answers earn higher bonuses.`
          : 'Internet reaction rankings are calibrated for casual play; physical ping latency can affect reaction times.',
    };

    this.lastRecaps.set(room.roomCode, recapData);
    this.clientChallenges.delete(room.roomCode);

    this.io.to(room.roomCode).emit('round_recap', recapData);
    this.io.to(room.roomCode).emit('room_state_updated', this.sanitizeRoom(room));

    // Schedule next round or game over
    this.scheduleTimer(room.roomCode, ROUND_RECAP_DURATION_MS, () => {
      if (room.currentRound < room.totalRounds) {
        this.startRound(room, room.currentRound + 1);
      } else {
        this.endGame(room);
      }
    });
  }

  /**
   * Handles asynchronous batch judging and uniqueness scoring for Rare Answer rounds.
   */
  private async handleRareAnswerRoundEnd(
    room: RoomState,
    roundId: string,
    challenge: RareAnswerChallengeServer
  ): Promise<void> {
    room.status = 'JUDGING_ANSWERS';
    this.io.to(room.roomCode).emit('room_state_updated', this.sanitizeRoom(room));
    this.io.to(room.roomCode).emit('rare_answer_judging', {
      prompt: challenge.prompt,
      roundNumber: room.currentRound,
    });

    const roomSubmissions = this.submissions.get(room.roomCode) || new Map();
    const submissionsList = room.players.map((p) => ({
      playerId: p.id,
      text: roomSubmissions.get(p.id)?.textAnswer,
    }));

    try {
      const judgingResult = await aiGenerator.judgeRareAnswerBatch({
        prompt: challenge.prompt,
        category: challenge.category,
        difficulty: challenge.difficulty,
        acceptableAnswers: challenge.acceptableAnswers,
        submissions: submissionsList,
      });

      if (judgingResult.isVoided) {
        const voidCount = (this.voidReplacementsCount.get(room.roomCode) || 0) + 1;
        this.voidReplacementsCount.set(room.roomCode, voidCount);

        if (voidCount <= 2) {
          this.io.to(room.roomCode).emit('round_voided', {
            reason: judgingResult.voidReason || 'Round could not be judged fairly',
            replacementOffered: true,
          });

          // Queue replacement challenge for current round
          setTimeout(() => {
            this.startRound(room, room.currentRound);
          }, 2500);
          return;
        } else {
          this.io.to(room.roomCode).emit('round_voided', {
            reason: judgingResult.voidReason || 'Round voided: maximum replacements reached',
            replacementOffered: false,
          });
        }
      }

      // Update player scores, stats, and streaks
      const results: PlayerRoundResult[] = [];
      const prevRanks = this.previousRanks.get(room.roomCode) || new Map();
      const rareAnswerSubmissions: RareAnswerSubmissionResult[] = [];

      for (const sub of judgingResult.judgedSubmissions) {
        const player = room.players.find((p) => p.id === sub.playerId);
        if (!player) continue;

        player.score += sub.pointsEarned;
        player.stats.rareAnswerTotal++;
        if (sub.isValid) {
          player.stats.rareAnswerCorrect++;
          player.streak++;
          player.stats.highestStreak = Math.max(player.stats.highestStreak, player.streak);
        } else {
          player.streak = 0;
        }

        rareAnswerSubmissions.push({
          playerId: sub.playerId,
          nickname: player.nickname,
          avatar: player.avatar,
          answer: sub.rawAnswer,
          isValid: sub.isValid,
          canonicalAnswer: sub.canonicalAnswer,
          duplicateCount: sub.duplicateCount,
          pointsEarned: sub.pointsEarned,
          explanation: sub.explanation,
        });
      }

      // Compute updated ranks using deterministicPlayerSort
      const sortedPlayers = [...room.players].sort(deterministicPlayerSort);
      const currentRanks = new Map<string, number>();
      sortedPlayers.forEach((p, idx) => currentRanks.set(p.id, idx + 1));

      sortedPlayers.forEach((player) => {
        const sub = judgingResult.judgedSubmissions.find((j) => j.playerId === player.id);
        const curRank = currentRanks.get(player.id) || 1;
        const prevRank = prevRanks.get(player.id) || curRank;
        const rankDelta = prevRank - curRank;

        results.push({
          playerId: player.id,
          nickname: player.nickname,
          avatar: player.avatar,
          pointsEarned: sub?.pointsEarned || 0,
          totalScore: player.score,
          rank: curRank,
          rankDelta,
          isCorrect: Boolean(sub?.isValid),
          submittedAnswerText: sub?.rawAnswer,
          rarityCount: sub?.duplicateCount,
        });
      });

      this.previousRanks.set(room.roomCode, currentRanks);

      room.status = 'ROUND_RECAP';
      const recapData: RoundRecapData = {
        roundNumber: room.currentRound,
        totalRounds: room.totalRounds,
        mode: 'rare_answer',
        difficulty: challenge.difficulty,
        results,
        rareAnswerPrompt: challenge.prompt,
        rareAnswerAcceptedList: challenge.acceptableAnswers.slice(0, 15),
        rareAnswerSubmissions,
        explanation: 'Scoring: Math.round(100 / countOfEquivalentAnswers). Solo = 100 pts, 2 matches = 50 pts, 3 matches = 33 pts. 0 pts for invalid or blank.',
      };

      this.lastRecaps.set(room.roomCode, recapData);
      this.io.to(room.roomCode).emit('round_recap', recapData);
      this.io.to(room.roomCode).emit('room_state_updated', this.sanitizeRoom(room));

      this.scheduleTimer(room.roomCode, ROUND_RECAP_DURATION_MS, () => {
        if (room.currentRound < room.totalRounds) {
          this.startRound(room, room.currentRound + 1);
        } else {
          this.endGame(room);
        }
      });
    } catch (err: unknown) {
      logger.error(`[GameEngine] Rare Answer judging crashed:`, { error: err });
      this.io.to(room.roomCode).emit('round_voided', {
        reason: 'Internal judging error occurred. Round voided.',
        replacementOffered: false,
      });
      this.scheduleTimer(room.roomCode, 2000, () => {
        if (room.currentRound < room.totalRounds) {
          this.startRound(room, room.currentRound + 1);
        } else {
          this.endGame(room);
        }
      });
    }
  }

  /**
   * Finalizes match, computes accolades and podium.
   */
  public endGame(room: RoomState): void {
    room.status = 'GAME_OVER';

    const sorted = [...room.players].sort(deterministicPlayerSort);
    const accolades: FinalGameAccolade[] = [];

    // 1. Fastest Reaction Accolade
    const reactionPlayer = [...room.players]
      .filter((p) => p.stats.fastestReactionMs !== null)
      .sort((a, b) => (a.stats.fastestReactionMs || 9999) - (b.stats.fastestReactionMs || 9999))[0];

    if (reactionPlayer && reactionPlayer.stats.fastestReactionMs) {
      accolades.push({
        title: 'Lightning Reflexes',
        description: 'Fastest reaction time in the clash',
        playerId: reactionPlayer.id,
        nickname: reactionPlayer.nickname,
        avatar: reactionPlayer.avatar,
        value: `${reactionPlayer.stats.fastestReactionMs} ms`,
      });
    }

    // 2. Highest Streak Accolade
    const streakPlayer = [...room.players].sort(
      (a, b) => b.stats.highestStreak - a.stats.highestStreak
    )[0];
    if (streakPlayer && streakPlayer.stats.highestStreak > 1) {
      accolades.push({
        title: 'Unstoppable Flame',
        description: 'Highest consecutive correct streak',
        playerId: streakPlayer.id,
        nickname: streakPlayer.nickname,
        avatar: streakPlayer.avatar,
        value: `${streakPlayer.stats.highestStreak}x Streak`,
      });
    }

    // 3. Trivia/Math Accuracy Accolade
    const accuracyPlayer = [...room.players].sort(
      (a, b) =>
        b.stats.triviaCorrect +
        b.stats.mathCorrect -
        (a.stats.triviaCorrect + a.stats.mathCorrect)
    )[0];
    if (accuracyPlayer) {
      accolades.push({
        title: 'Precision Master',
        description: 'Highest combined accuracy in trivia and math',
        playerId: accuracyPlayer.id,
        nickname: accuracyPlayer.nickname,
        avatar: accuracyPlayer.avatar,
        value: `${accuracyPlayer.stats.triviaCorrect + accuracyPlayer.stats.mathCorrect} Solved`,
      });
    }

    const podiumData: GameOverPodiumData = {
      leaderboard: sorted,
      accolades,
    };

    this.lastPodiums.set(room.roomCode, podiumData);
    this.clientChallenges.delete(room.roomCode);

    this.io.to(room.roomCode).emit('game_over', podiumData);
    this.io.to(room.roomCode).emit('room_state_updated', this.sanitizeRoom(room));
  }

  /**
   * Resets room to lobby for another game or adjustments.
   * Completely clears match state, scores, streaks, stats, timers, and submissions.
   */
  public returnToLobby(room: RoomState): void {
    this.clearTimer(room.roomCode);
    this.cancelPendingBatch(room.roomCode);
    this.preparedTriviaBatches.delete(room.roomCode);
    this.preparedRareBatches.delete(room.roomCode);
    room.status = 'LOBBY';
    room.currentRound = 1;
    room.roundId = null;
    room.roundStartTime = null;
    room.roundEndTime = null;
    room.activeMode = null;

    // Reset scores, streaks, and match stats while preserving player roster & room settings
    room.players.forEach((p) => {
      p.score = 0;
      p.streak = 0;
      p.stats = {
        triviaCorrect: 0,
        triviaTotal: 0,
        mathCorrect: 0,
        mathTotal: 0,
        memoryPerfectCount: 0,
        fastestReactionMs: null,
        rareAnswerCorrect: 0,
        rareAnswerTotal: 0,
        highestStreak: 0,
      };
    });

    this.submissions.delete(room.roomCode);
    this.secretChallenges.delete(room.roomCode);
    this.previousRanks.delete(room.roomCode);
    // Note: usedTriviaIds and usedRareIds are intentionally PRESERVED across rematches
    // so duplicate prevention maintains recent room history
    this.modeSchedules.delete(room.roomCode);
    this.clientChallenges.delete(room.roomCode);
    this.lastRecaps.delete(room.roomCode);
    this.lastPodiums.delete(room.roomCode);

    this.io.to(room.roomCode).emit('room_state_updated', this.sanitizeRoom(room));
  }

  /**
   * Rematch / Play Again flow.
   * Resets all match data and transitions room back to lobby.
   */
  public playAgain(room: RoomState): void {
    this.returnToLobby(room);
  }

  private scheduleTimer(roomCode: string, ms: number, callback: () => void) {
    this.clearTimer(roomCode);
    const timer = setTimeout(() => {
      this.activeTimers.delete(roomCode);
      callback();
    }, ms);
    this.activeTimers.set(roomCode, timer);
  }

  public clearTimer(roomCode: string) {
    const existing = this.activeTimers.get(roomCode);
    if (existing) {
      clearTimeout(existing);
      this.activeTimers.delete(roomCode);
    }
  }

  /**
   * Provides a full snapshot of the match state for a reconnecting player.
   * Prevents answer leakage by only revealing who submitted without exposing answers.
   */
  public getReconnectionSnapshot(room: RoomState, requestingPlayerId?: string): {
    activeChallenge?: ActiveChallengeClient;
    remainingMs?: number;
    roundRecap?: RoundRecapData;
    podiumData?: GameOverPodiumData;
    submittedPlayerIds?: string[];
    mySubmittedAnswer?: string;
    isJudging?: boolean;
  } {
    const now = Date.now();
    let remainingMs: number | undefined;
    if (room.status === 'ROUND_ACTIVE' && room.roundEndTime) {
      remainingMs = Math.max(0, room.roundEndTime - now);
    }

    const roomSubs = this.submissions.get(room.roomCode);
    const submittedPlayerIds = roomSubs ? Array.from(roomSubs.keys()) : [];
    const mySub = requestingPlayerId && roomSubs ? roomSubs.get(requestingPlayerId)?.textAnswer : undefined;

    return {
      activeChallenge:
        room.status === 'ROUND_ACTIVE' || room.status === 'JUDGING_ANSWERS'
          ? this.clientChallenges.get(room.roomCode)
          : undefined,
      remainingMs,
      roundRecap:
        room.status === 'ROUND_RECAP' ? this.lastRecaps.get(room.roomCode) : undefined,
      podiumData:
        room.status === 'GAME_OVER' ? this.lastPodiums.get(room.roomCode) : undefined,
      submittedPlayerIds:
        room.status === 'ROUND_ACTIVE' || room.status === 'JUDGING_ANSWERS' ? submittedPlayerIds : undefined,
      mySubmittedAnswer: mySub,
      isJudging: room.status === 'JUDGING_ANSWERS',
    };
  }

  /**
   * Retrieves secret server challenge for tests or internal inspection.
   */
  public getSecretChallenge(roomCode: string): SecretChallenge | undefined {
    return this.secretChallenges.get(roomCode);
  }

  /**
   * Retrieves recorded player submissions for an active round.
   */
  public getSubmissions(roomCode: string): Map<string, PlayerSubmission> | undefined {
    return this.submissions.get(roomCode);
  }

  /**
   * Retrieves count of voided round replacements for a room.
   */
  public getVoidReplacementsCount(roomCode: string): number {
    return this.voidReplacementsCount.get(roomCode) || 0;
  }

  /**
   * Cleans all in-memory resources associated with an ended or purged room.
   */
  public cleanRoom(roomCode: string): void {
    this.clearTimer(roomCode);
    this.cancelPendingBatch(roomCode);
    this.preparedTriviaBatches.delete(roomCode);
    this.preparedRareBatches.delete(roomCode);
    this.voidReplacementsCount.delete(roomCode);
    this.secretChallenges.delete(roomCode);
    this.submissions.delete(roomCode);
    this.previousRanks.delete(roomCode);
    this.usedTriviaIds.delete(roomCode);
    this.usedRareIds.delete(roomCode);
    duplicatePrevention.clearRoom(roomCode).catch(() => {});
    aiGenerator.releaseBatchReservation(roomCode).catch(() => {});
    this.modeSchedules.delete(roomCode);
    this.clientChallenges.delete(roomCode);
    this.lastRecaps.delete(roomCode);
    this.lastPodiums.delete(roomCode);
  }

  /**
   * Migrates submissions and rank records from old socket ID to new socket ID upon reconnect.
   * Prevents repeated answer submissions and preserves round ranking continuity.
   */
  public updatePlayerSocketId(roomCode: string, oldSocketId: string, newSocketId: string): void {
    const roomSubs = this.submissions.get(roomCode);
    if (roomSubs && roomSubs.has(oldSocketId)) {
      const sub = roomSubs.get(oldSocketId)!;
      sub.playerId = newSocketId;
      roomSubs.delete(oldSocketId);
      roomSubs.set(newSocketId, sub);
    }

    const ranks = this.previousRanks.get(roomCode);
    if (ranks && ranks.has(oldSocketId)) {
      const rank = ranks.get(oldSocketId)!;
      ranks.delete(oldSocketId);
      ranks.set(newSocketId, rank);
    }
  }

  private sanitizeRoom(room: RoomState): RoomState {
    return {
      ...room,
      players: room.players.map((p) => ({ ...p, sessionToken: '' })),
    };
  }

  public clearAll() {
    this.activeTimers.forEach((t) => clearTimeout(t));
    this.activeTimers.clear();
    this.batchAbortControllers.forEach((c) => c.abort());
    this.batchAbortControllers.clear();
    this.preparedTriviaBatches.clear();
    this.secretChallenges.clear();
    this.submissions.clear();
    this.previousRanks.clear();
    this.usedTriviaIds.clear();
    this.modeSchedules.clear();
    this.clientChallenges.clear();
    this.lastRecaps.clear();
    this.lastPodiums.clear();
  }
}
