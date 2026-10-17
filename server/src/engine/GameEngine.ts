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
} from '@mind-clash/shared';
import { getRandomTriviaQuestion } from '../modes/triviaBank.js';
import { generateMathQuestion } from '../modes/mathGenerator.js';
import { generateMemoryChallenge } from '../modes/memoryGenerator.js';
import { generateReactionChallenge } from '../modes/reactionGenerator.js';

export interface PlayerSubmission {
  playerId: string;
  roundId: string;
  receivedAt: number;
  answer?: number; // Trivia option index, Math answer, or Reaction trigger click
  selectedIndices?: number[]; // Memory tiles
  sequence?: string[]; // Memory symbol sequence
  falseStart?: boolean;
}

type SecretChallenge =
  | { mode: 'trivia'; serverChallenge: TriviaQuestionServer }
  | { mode: 'math'; serverChallenge: MathQuestionServer }
  | { mode: 'memory'; serverChallenge: MemoryChallengeServer }
  | { mode: 'reaction'; serverChallenge: ReactionChallengeServer };

export class GameEngine {
  private io: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
  private activeTimers = new Map<string, NodeJS.Timeout>(); // roomCode -> active timer
  private secretChallenges = new Map<string, SecretChallenge>(); // roomCode -> secret challenge
  private submissions = new Map<string, Map<string, PlayerSubmission>>(); // roomCode -> (playerId -> submission)
  private previousRanks = new Map<string, Map<string, number>>(); // roomCode -> (playerId -> rank)
  private usedTriviaIds = new Map<string, Set<string>>(); // roomCode -> used question ids
  private modeSchedules = new Map<string, GameMode[]>(); // roomCode -> planned mode rotation
  private clientChallenges = new Map<string, ActiveChallengeClient>(); // roomCode -> current client challenge
  private lastRecaps = new Map<string, RoundRecapData>(); // roomCode -> latest round recap
  private lastPodiums = new Map<string, GameOverPodiumData>(); // roomCode -> latest podium

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
   */
  public startGame(room: RoomState): void {
    if (room.status !== 'LOBBY') {
      throw new Error(`Cannot start match: Room is currently in ${room.status} status`);
    }

    const connectedPlayers = room.players.filter((p) => p.isConnected);
    if (connectedPlayers.length < 2) {
      throw new Error('Need at least 2 connected players to start the match');
    }

    // Initialize/reset match state
    room.status = 'COUNTDOWN';
    room.totalRounds = room.totalRounds || room.settings.roundCount || 5;
    room.currentRound = 1;
    this.submissions.set(room.roomCode, new Map());
    this.previousRanks.set(room.roomCode, new Map());
    this.usedTriviaIds.set(room.roomCode, new Set());

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
        highestStreak: 0,
      };
    });

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

  /**
   * Initiates a synchronized round.
   */
  public startRound(room: RoomState, roundNumber: number): void {
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
    let durationMs: number;

    let secretChallenge: SecretChallenge;
    let clientChallenge: ActiveChallengeClient;

    if (mode === 'trivia') {
      const used = this.usedTriviaIds.get(room.roomCode) || new Set();
      const question = getRandomTriviaQuestion(used);
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
        },
      };
    } else if (mode === 'math') {
      const math = generateMathQuestion(roundNumber);
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
      const memory = generateMemoryChallenge(roundNumber, startTime);
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
    } else {
      // Reaction
      const rx = generateReactionChallenge(startTime);
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

    // Check idempotency (prevent multiple submissions for the same round)
    const roomSubmissions = this.submissions.get(room.roomCode) || new Map();
    if (roomSubmissions.has(playerId)) {
      return { success: false, error: 'Answer already submitted for this round' };
    }

    const secret = this.secretChallenges.get(room.roomCode);

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
    room.status = 'ROUND_RECAP';

    const secret = this.secretChallenges.get(room.roomCode);
    const roomSubmissions = this.submissions.get(room.roomCode) || new Map();
    const prevRanks = this.previousRanks.get(room.roomCode) || new Map();

    const roundDuration = (room.roundEndTime || Date.now()) - (room.roundStartTime || Date.now());
    const results: PlayerRoundResult[] = [];
    const pointsEarnedMap = new Map<string, number>();
    const isCorrectMap = new Map<string, boolean>();
    const timeSpentMap = new Map<string, number | undefined>();

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
        highestStreak: 0,
      };
    });

    this.submissions.delete(room.roomCode);
    this.secretChallenges.delete(room.roomCode);
    this.previousRanks.delete(room.roomCode);
    this.usedTriviaIds.delete(room.roomCode);
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
   */
  public getReconnectionSnapshot(room: RoomState): {
    activeChallenge?: ActiveChallengeClient;
    remainingMs?: number;
    roundRecap?: RoundRecapData;
    podiumData?: GameOverPodiumData;
  } {
    const now = Date.now();
    let remainingMs: number | undefined;
    if (room.status === 'ROUND_ACTIVE' && room.roundEndTime) {
      remainingMs = Math.max(0, room.roundEndTime - now);
    }

    return {
      activeChallenge:
        room.status === 'ROUND_ACTIVE' ? this.clientChallenges.get(room.roomCode) : undefined,
      remainingMs,
      roundRecap:
        room.status === 'ROUND_RECAP' ? this.lastRecaps.get(room.roomCode) : undefined,
      podiumData:
        room.status === 'GAME_OVER' ? this.lastPodiums.get(room.roomCode) : undefined,
    };
  }

  /**
   * Retrieves recorded player submissions for an active round.
   */
  public getSubmissions(roomCode: string): Map<string, PlayerSubmission> | undefined {
    return this.submissions.get(roomCode);
  }

  /**
   * Cleans all in-memory resources associated with an ended or purged room.
   */
  public cleanRoom(roomCode: string): void {
    this.clearTimer(roomCode);
    this.secretChallenges.delete(roomCode);
    this.submissions.delete(roomCode);
    this.previousRanks.delete(roomCode);
    this.usedTriviaIds.delete(roomCode);
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
