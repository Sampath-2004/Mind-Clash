import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Player,
  RoomState,
  ActiveChallengeClient,
  RoundRecapData,
  GameOverPodiumData,
  RoomSettings,
} from '@mind-clash/shared';
import { socket } from '../socket';
import { sounds } from '../audio/soundEffects';

export interface GameContextValue {
  isConnected: boolean;
  isReconnecting: boolean;
  serverRestartNotice: string | null;
  clearServerRestartNotice: () => void;
  socketId: string | null;
  currentRoom: RoomState | null;
  currentPlayer: Player | null;
  activeChallenge: ActiveChallengeClient | null;
  roundRecap: RoundRecapData | null;
  podiumData: GameOverPodiumData | null;
  isMuted: boolean;
  toggleSound: () => void;
  // Real Multiplayer Actions
  createRoom: (nickname: string, avatar: string) => Promise<{ success: boolean; error?: string }>;
  joinRoom: (roomCode: string, nickname: string, avatar: string) => Promise<{ success: boolean; error?: string }>;
  reconnect: () => Promise<{ success: boolean; error?: string }>;
  leaveRoom: () => void;
  startGame: () => Promise<{ success: boolean; error?: string }>;
  kickPlayer: (targetPlayerId: string) => Promise<{ success: boolean; error?: string }>;
  updateSettings: (settings: Partial<RoomSettings>) => Promise<{ success: boolean; error?: string }>;
  submitTrivia: (answerIndex: number) => Promise<{ success: boolean; error?: string }>;
  submitMath: (answer: number) => Promise<{ success: boolean; error?: string }>;
  submitMemory: (input: number[] | string[]) => Promise<{ success: boolean; error?: string }>;
  submitReaction: () => Promise<{ success: boolean; error?: string }>;
  submitRareAnswer: (answer: string) => Promise<{ success: boolean; error?: string }>;
  playAgain: () => Promise<{ success: boolean; error?: string }>;
  returnToLobby: () => Promise<{ success: boolean; error?: string }>;
  retryAiGeneration: () => Promise<{ success: boolean; error?: string }>;
  useOfflineQuestions: () => Promise<{ success: boolean; error?: string }>;
  cancelMatch: () => Promise<{ success: boolean; error?: string }>;
  preparingInfo: { count: number; provider: string; notice?: string } | null;
  preparationError: { error: string; canRetry: boolean; canUseOffline: boolean } | null;
  clockOffsetMs: number;
  submittedPlayerIds: Set<string>;
  isJudging: boolean;
  voidNotice: string | null;
  clearVoidNotice: () => void;
  mySubmittedAnswer: string | null;
  setMySubmittedAnswer: (answer: string | null) => void;
  // Demo State Setters (for UI isolated testing)
  setCurrentRoom: React.Dispatch<React.SetStateAction<RoomState | null>>;
  setCurrentPlayer: React.Dispatch<React.SetStateAction<Player | null>>;
  setActiveChallenge: React.Dispatch<React.SetStateAction<ActiveChallengeClient | null>>;
  setRoundRecap: React.Dispatch<React.SetStateAction<RoundRecapData | null>>;
  setPodiumData: React.Dispatch<React.SetStateAction<GameOverPodiumData | null>>;
  loadSampleRoom: () => void;
}

const GameStateContext = createContext<GameContextValue | undefined>(undefined);

export const AVATAR_OPTIONS = [
  { id: 'cyber-brain', label: 'Neural', emoji: '🧠', color: 'from-cyan-500 to-blue-600' },
  { id: 'plasma-dragon', label: 'Dragon', emoji: '🐲', color: 'from-purple-500 to-indigo-600' },
  { id: 'astro-bot', label: 'Cyborg', emoji: '🤖', color: 'from-amber-400 to-orange-600' },
  { id: 'solar-phoenix', label: 'Phoenix', emoji: '🦅', color: 'from-rose-500 to-red-600' },
  { id: 'quantum-cat', label: 'Quantum', emoji: '🐱', color: 'from-emerald-400 to-teal-600' },
  { id: 'void-ninja', label: 'Shadow', emoji: '🥷', color: 'from-violet-600 to-purple-900' },
  { id: 'cosmic-alien', label: 'Cosmic', emoji: '👾', color: 'from-fuchsia-500 to-pink-600' },
  { id: 'hyper-fox', label: 'Kitsune', emoji: '🦊', color: 'from-amber-500 to-rose-500' },
];

export const GameStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean>(socket.connected);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [serverRestartNotice, setServerRestartNotice] = useState<string | null>(null);
  const [socketId, setSocketId] = useState<string | null>(socket.id || null);
  const [currentRoom, setCurrentRoom] = useState<RoomState | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [activeChallenge, setActiveChallenge] = useState<ActiveChallengeClient | null>(null);
  const [roundRecap, setRoundRecap] = useState<RoundRecapData | null>(null);
  const [podiumData, setPodiumData] = useState<GameOverPodiumData | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(sounds.getMuted());
  const [clockOffsetMs, setClockOffsetMs] = useState<number>(0);
  const [preparingInfo, setPreparingInfo] = useState<{ count: number; provider: string; notice?: string } | null>(null);
  const [preparationError, setPreparationError] = useState<{
    error: string;
    canRetry: boolean;
    canUseOffline: boolean;
  } | null>(null);
  const [submittedPlayerIds, setSubmittedPlayerIds] = useState<Set<string>>(new Set());
  const [isJudging, setIsJudging] = useState<boolean>(false);
  const [voidNotice, setVoidNotice] = useState<string | null>(null);
  const [mySubmittedAnswer, setMySubmittedAnswer] = useState<string | null>(null);

  const clearServerRestartNotice = useCallback(() => {
    setServerRestartNotice(null);
  }, []);

  const clearVoidNotice = useCallback(() => {
    setVoidNotice(null);
  }, []);

  // Socket Lifecycle Listeners
  useEffect(() => {
    // Clean up any legacy localStorage items
    localStorage.removeItem('mind_clash_room_code');
    localStorage.removeItem('mind_clash_session_token');
    localStorage.removeItem('mind_clash_player_id');

    function onConnect() {
      setIsConnected(true);
      setIsReconnecting(false);
      setSocketId(socket.id || null);

      // Ping clock for offset estimation
      const t0 = Date.now();
      socket.emit('ping_clock', t0, (data) => {
        const t1 = Date.now();
        const rtt = t1 - t0;
        const estimatedServerTime = data.serverTime + rtt / 2;
        setClockOffsetMs(estimatedServerTime - t1);
      });

      // Attempt automatic session recovery if stored in sessionStorage
      const savedCode = sessionStorage.getItem('mind_clash_room_code');
      const savedToken = sessionStorage.getItem('mind_clash_session_token');
      if (savedCode && savedToken) {
        setIsReconnecting(true);
        socket.emit('reconnect_player', { roomCode: savedCode, sessionToken: savedToken }, (res) => {
          setIsReconnecting(false);
          if (res.success && res.data) {
            if (res.data.newSessionToken) {
              sessionStorage.setItem('mind_clash_session_token', res.data.newSessionToken);
            }
            sessionStorage.setItem('mind_clash_player_id', res.data.playerId);
            setCurrentRoom(res.data.room);
            const myPlayer = res.data.room.players.find(
              (p) => p.id === res.data!.playerId || p.id === socket.id
            );
            if (myPlayer) setCurrentPlayer(myPlayer);

            // Hydrate complete current-state snapshot
            if (res.data.activeChallenge) {
              setActiveChallenge(res.data.activeChallenge);
            }
            if (res.data.roundRecap) {
              setRoundRecap(res.data.roundRecap);
            }
            if (res.data.podiumData) {
              setPodiumData(res.data.podiumData);
            }
            if (res.data.submittedPlayerIds) {
              setSubmittedPlayerIds(new Set(res.data.submittedPlayerIds));
            }
            if (res.data.isJudging !== undefined) {
              setIsJudging(res.data.isJudging);
            }
            if (res.data.mySubmittedAnswer !== undefined) {
              setMySubmittedAnswer(res.data.mySubmittedAnswer);
            }
          } else {
            // Expired, invalid session, or server restart
            sessionStorage.removeItem('mind_clash_room_code');
            sessionStorage.removeItem('mind_clash_session_token');
            sessionStorage.removeItem('mind_clash_player_id');

            if (res.error?.includes('server was restarted') || res.error?.includes('does not exist')) {
              setServerRestartNotice(
                'The active clash session could not be recovered. The server process was restarted or the room expired, clearing in-memory rooms. Please start or join a new clash.'
              );
            }
          }
        });
      }
    }

    function onDisconnect() {
      setIsConnected(false);
      setSocketId(null);
      const savedToken = sessionStorage.getItem('mind_clash_session_token');
      if (savedToken) {
        setIsReconnecting(true);
      }
    }

    function onRoomStateUpdated(updatedRoom: RoomState) {
      setCurrentRoom(updatedRoom);
      if (updatedRoom.status !== 'PREPARING_QUESTIONS') {
        setPreparingInfo(null);
      }
      if (updatedRoom.status !== 'PREPARATION_FAILED') {
        setPreparationError(null);
      }
      if (updatedRoom.status === 'LOBBY') {
        setActiveChallenge(null);
        setRoundRecap(null);
        setPodiumData(null);
        setSubmittedPlayerIds(new Set());
        setIsJudging(false);
        setVoidNotice(null);
        setMySubmittedAnswer(null);
      }
      if (updatedRoom.status === 'ROUND_ACTIVE') {
        setIsJudging(false);
      }
      const savedPlayerId = sessionStorage.getItem('mind_clash_player_id');
      const me = updatedRoom.players.find(
        (p) => p.id === socket.id || (savedPlayerId && p.id === savedPlayerId)
      );
      if (me) {
        setCurrentPlayer(me);
      }
    }

    function onQuestionsPreparing(data: { count: number; provider: string; notice?: string }) {
      setPreparingInfo(data);
      setPreparationError(null);
    }

    function onQuestionsPreparationFailed(data: {
      error: string;
      canRetry: boolean;
      canUseOffline: boolean;
    }) {
      setPreparationError(data);
    }

    function onPlayerJoined(_player: Player) {
      sounds.playClick();
    }

    function onPlayerLeft(_data: { playerId: string; newHostId?: string }) {
      sounds.playClick();
    }

    function onPlayerReconnected(_player: Player) {
      sounds.playSuccess();
    }

    function onSubmissionAcknowledged(data: { playerId: string }) {
      setSubmittedPlayerIds((prev) => new Set(prev).add(data.playerId));
      sounds.playClick();
    }

    function onRareAnswerJudging(_data: { prompt: string; roundNumber: number }) {
      setIsJudging(true);
      sounds.playClick();
    }

    function onRoundVoided(data: { reason: string; replacementOffered: boolean }) {
      setIsJudging(false);
      setVoidNotice(data.reason || 'Round was voided and a replacement round has been offered.');
      sounds.playError();
    }

    function onRoundStarted(data: {
      round: number;
      totalRounds: number;
      roundId: string;
      activeChallenge: ActiveChallengeClient;
      startTime: number;
      endTime: number;
      serverTime: number;
    }) {
      setActiveChallenge(data.activeChallenge);
      setRoundRecap(null);
      setPreparingInfo(null);
      setPreparationError(null);
      setSubmittedPlayerIds(new Set());
      setIsJudging(false);
      setVoidNotice(null);
      setMySubmittedAnswer(null);
      sounds.playClick();
      const clientNow = Date.now();
      setClockOffsetMs(data.serverTime - clientNow);
    }

    function onMemoryPhaseChanged(data: {
      phase: 'memorize' | 'recall';
      roundId: string;
      inputDurationMs?: number;
      recallStartTime?: number;
      recallEndTime?: number;
      serverTime: number;
    }) {
      setActiveChallenge((prev) => {
        if (!prev || prev.mode !== 'memory') return prev;
        return {
          ...prev,
          challenge: {
            ...prev.challenge,
            phase: data.phase,
            recallStartTime: data.recallStartTime,
            recallEndTime: data.recallEndTime,
            sequence: data.phase === 'recall' ? undefined : prev.challenge.sequence,
          },
        };
      });
      if (data.recallEndTime) {
        setCurrentRoom((prev) => (prev ? { ...prev, roundEndTime: data.recallEndTime } : prev));
      }
      sounds.playTick(700);
    }

    function onRoundRecap(recap: RoundRecapData) {
      setRoundRecap(recap);
      setIsJudging(false);
      sounds.playSuccess();
    }

    function onGameOver(podium: GameOverPodiumData) {
      setPodiumData(podium);
      sounds.playVictoryFanfare();
    }

    function onKicked(data: { reason: string }) {
      sounds.playError();
      sessionStorage.removeItem('mind_clash_room_code');
      sessionStorage.removeItem('mind_clash_session_token');
      sessionStorage.removeItem('mind_clash_player_id');
      setCurrentRoom(null);
      setCurrentPlayer(null);
      window.location.href = `/error?type=kicked&reason=${encodeURIComponent(data.reason)}`;
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room_state_updated', onRoomStateUpdated);
    socket.on('questions_preparing', onQuestionsPreparing);
    socket.on('questions_preparation_failed', onQuestionsPreparationFailed);
    socket.on('player_joined', onPlayerJoined);
    socket.on('player_left', onPlayerLeft);
    socket.on('player_reconnected', onPlayerReconnected);
    socket.on('submission_acknowledged', onSubmissionAcknowledged);
    socket.on('rare_answer_judging', onRareAnswerJudging);
    socket.on('round_voided', onRoundVoided);
    socket.on('round_started', onRoundStarted);
    socket.on('memory_phase_changed', onMemoryPhaseChanged);
    socket.on('round_recap', onRoundRecap);
    socket.on('game_over', onGameOver);
    socket.on('kicked', onKicked);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room_state_updated', onRoomStateUpdated);
      socket.off('questions_preparing', onQuestionsPreparing);
      socket.off('questions_preparation_failed', onQuestionsPreparationFailed);
      socket.off('player_joined', onPlayerJoined);
      socket.off('player_left', onPlayerLeft);
      socket.off('player_reconnected', onPlayerReconnected);
      socket.off('submission_acknowledged', onSubmissionAcknowledged);
      socket.off('rare_answer_judging', onRareAnswerJudging);
      socket.off('round_voided', onRoundVoided);
      socket.off('round_started', onRoundStarted);
      socket.off('memory_phase_changed', onMemoryPhaseChanged);
      socket.off('round_recap', onRoundRecap);
      socket.off('game_over', onGameOver);
      socket.off('kicked', onKicked);
    };
  }, []);

  const toggleSound = () => {
    const muted = sounds.toggleMute();
    setIsMuted(muted);
    if (!muted) sounds.playClick();
  };

  // Real backend create room
  const createRoom = useCallback(
    (nickname: string, avatar: string): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        if (!socket.connected) {
          socket.connect();
        }

        socket.emit('create_room', { nickname, avatar }, (res) => {
          if (res.success && res.data) {
            sessionStorage.setItem('mind_clash_room_code', res.data.roomCode);
            sessionStorage.setItem('mind_clash_session_token', res.data.sessionToken);
            sessionStorage.setItem('mind_clash_player_id', res.data.playerId);

            const hostPlayer: Player = {
              id: res.data.playerId,
              sessionToken: res.data.sessionToken,
              nickname,
              avatar,
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
                rareAnswerCorrect: 0,
                rareAnswerTotal: 0,
              },
            };

            setCurrentPlayer(hostPlayer);
            resolve({ success: true });
          } else {
            resolve({ success: false, error: res.error || 'Failed to create room' });
          }
        });
      });
    },
    []
  );

  // Real backend join room
  const joinRoom = useCallback(
    (roomCode: string, nickname: string, avatar: string): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        if (!socket.connected) {
          socket.connect();
        }

        socket.emit('join_room', { roomCode, nickname, avatar }, (res) => {
          if (res.success && res.data) {
            sessionStorage.setItem('mind_clash_room_code', res.data.roomCode);
            sessionStorage.setItem('mind_clash_session_token', res.data.sessionToken);
            sessionStorage.setItem('mind_clash_player_id', res.data.playerId);

            const joinedPlayer: Player = {
              id: res.data.playerId,
              sessionToken: res.data.sessionToken,
              nickname,
              avatar,
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
                rareAnswerCorrect: 0,
                rareAnswerTotal: 0,
              },
            };

            setCurrentPlayer(joinedPlayer);
            resolve({ success: true });
          } else {
            resolve({ success: false, error: res.error || 'Failed to join room' });
          }
        });
      });
    },
    []
  );

  // Real backend reconnect
  const reconnect = useCallback((): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const code = sessionStorage.getItem('mind_clash_room_code');
      const token = sessionStorage.getItem('mind_clash_session_token');

      if (!code || !token) {
        return resolve({ success: false, error: 'No active session saved' });
      }

      setIsReconnecting(true);
      socket.emit('reconnect_player', { roomCode: code, sessionToken: token }, (res) => {
        setIsReconnecting(false);
        if (res.success && res.data) {
          if (res.data.newSessionToken) {
            sessionStorage.setItem('mind_clash_session_token', res.data.newSessionToken);
          }
          sessionStorage.setItem('mind_clash_player_id', res.data.playerId);
          setCurrentRoom(res.data.room);
          const me = res.data.room.players.find(
            (p) => p.id === socket.id || p.id === res.data!.playerId
          );
          if (me) setCurrentPlayer(me);

          if (res.data.activeChallenge) {
            setActiveChallenge(res.data.activeChallenge);
          }
          if (res.data.roundRecap) {
            setRoundRecap(res.data.roundRecap);
          }
          if (res.data.podiumData) {
            setPodiumData(res.data.podiumData);
          }
          if (res.data.submittedPlayerIds) {
            setSubmittedPlayerIds(new Set(res.data.submittedPlayerIds));
          }
          if (res.data.isJudging !== undefined) {
            setIsJudging(res.data.isJudging);
          }
          if (res.data.mySubmittedAnswer !== undefined) {
            setMySubmittedAnswer(res.data.mySubmittedAnswer);
          }
          resolve({ success: true });
        } else {
          sessionStorage.removeItem('mind_clash_room_code');
          sessionStorage.removeItem('mind_clash_session_token');
          sessionStorage.removeItem('mind_clash_player_id');

          if (res.error?.includes('server was restarted') || res.error?.includes('does not exist')) {
            setServerRestartNotice(
              'The active clash session could not be recovered. The server process was restarted or the room expired, clearing in-memory rooms. Please start or join a new clash.'
            );
          }
          resolve({ success: false, error: res.error || 'Reconnection failed' });
        }
      });
    });
  }, []);

  // Leave room
  const leaveRoom = useCallback(() => {
    socket.emit('leave_room');
    sessionStorage.removeItem('mind_clash_room_code');
    sessionStorage.removeItem('mind_clash_session_token');
    sessionStorage.removeItem('mind_clash_player_id');
    setCurrentRoom(null);
    setCurrentPlayer(null);
    setActiveChallenge(null);
    setRoundRecap(null);
    setPodiumData(null);
  }, []);

  // Start game (Host only)
  const startGame = useCallback((): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      socket.emit('start_game', (res) => {
        if (res.success) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: res.error || 'Could not start game' });
        }
      });
    });
  }, []);

  // Kick player (Host only)
  const kickPlayer = useCallback(
    (targetPlayerId: string): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        socket.emit('kick_player', { targetPlayerId }, (res) => {
          if (res.success) {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: res.error || 'Could not kick player' });
          }
        });
      });
    },
    []
  );

  // Update room settings (Host only)
  const updateSettings = useCallback(
    (settings: Partial<RoomSettings>): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        socket.emit('update_settings', { settings }, (res) => {
          if (res.success) {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: res.error || 'Could not update settings' });
          }
        });
      });
    },
    []
  );

  // Submit Trivia Answer
  const submitTrivia = useCallback(
    (answerIndex: number): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        socket.emit('submit_trivia_answer', { answerIndex, clientTimeMs: Date.now() }, (res) => {
          resolve({ success: !!res?.success, error: res?.error });
        });
      });
    },
    []
  );

  // Submit Math Answer
  const submitMath = useCallback(
    (answer: number): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        socket.emit('submit_math_answer', { answer, clientTimeMs: Date.now() }, (res) => {
          resolve({ success: !!res?.success, error: res?.error });
        });
      });
    },
    []
  );

  // Submit Memory Sequence or Tiles
  const submitMemory = useCallback(
    (input: number[] | string[]): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        const payload =
          input.length > 0 && typeof input[0] === 'string'
            ? { sequence: input as string[], clientTimeMs: Date.now() }
            : { selectedIndices: input as number[], clientTimeMs: Date.now() };
        socket.emit('submit_memory_tiles', payload, (res) => {
          resolve({ success: !!res?.success, error: res?.error });
        });
      });
    },
    []
  );

  // Submit Reaction Click
  const submitReaction = useCallback((): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      socket.emit('submit_reaction_click', { clientTimeMs: Date.now() }, (res) => {
        resolve({ success: !!res?.success, error: res?.error });
      });
    });
  }, []);

  // Submit Rare Answer
  const submitRareAnswer = useCallback(
    (answer: string): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        socket.emit('submit_rare_answer', { answer, clientTimeMs: Date.now() }, (res) => {
          if (res?.success) {
            setMySubmittedAnswer(answer);
          }
          resolve({ success: !!res?.success, error: res?.error });
        });
      });
    },
    []
  );

  // Play Again (Rematch)
  const playAgain = useCallback((): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      socket.emit('play_again', (res) => {
        resolve({ success: !!res?.success, error: res?.error });
      });
    });
  }, []);

  // Return to Lobby (Host only)
  const returnToLobby = useCallback((): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      socket.emit('return_to_lobby', (res) => {
        resolve({ success: !!res?.success, error: res?.error });
      });
    });
  }, []);

  // Retry AI Generation (Host only)
  const retryAiGeneration = useCallback((): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      socket.emit('retry_ai_generation', (res) => {
        resolve({ success: !!res?.success, error: res?.error });
      });
    });
  }, []);

  // Use Offline Questions Choice (Host only)
  const useOfflineQuestions = useCallback((): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      socket.emit('use_offline_questions', (res) => {
        resolve({ success: !!res?.success, error: res?.error });
      });
    });
  }, []);

  // Cancel Match Preparation (Host only)
  const cancelMatch = useCallback((): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      socket.emit('cancel_match', (res) => {
        resolve({ success: !!res?.success, error: res?.error });
      });
    });
  }, []);

  // Sample room loader for UI demo purposes
  const loadSampleRoom = () => {
    const samplePlayer: Player = {
      id: socket.id || 'p-you',
      sessionToken: 'sample-session-1234',
      nickname: 'NeoGamer',
      avatar: 'cyber-brain',
      score: 1850,
      streak: 3,
      isHost: true,
      isConnected: true,
      stats: {
        triviaCorrect: 2,
        triviaTotal: 2,
        mathCorrect: 1,
        mathTotal: 1,
        memoryPerfectCount: 1,
        fastestReactionMs: 238,
        highestStreak: 3,
        rareAnswerCorrect: 1,
        rareAnswerTotal: 1,
      },
    };

    const mockPlayers: Player[] = [
      samplePlayer,
      {
        id: 'p-2',
        sessionToken: 'token-2',
        nickname: 'Valkyrie',
        avatar: 'plasma-dragon',
        score: 1620,
        streak: 2,
        isHost: false,
        isConnected: true,
        stats: {
          triviaCorrect: 2,
          triviaTotal: 2,
          mathCorrect: 1,
          mathTotal: 1,
          memoryPerfectCount: 0,
          fastestReactionMs: 254,
          highestStreak: 2,
          rareAnswerCorrect: 1,
          rareAnswerTotal: 1,
        },
      },
      {
        id: 'p-3',
        sessionToken: 'token-3',
        nickname: 'PixelPulse',
        avatar: 'astro-bot',
        score: 1100,
        streak: 0,
        isHost: false,
        isConnected: true,
        stats: {
          triviaCorrect: 1,
          triviaTotal: 2,
          mathCorrect: 0,
          mathTotal: 1,
          memoryPerfectCount: 1,
          fastestReactionMs: 310,
          highestStreak: 1,
          rareAnswerCorrect: 0,
          rareAnswerTotal: 1,
        },
      },
    ];

    const sampleRoom: RoomState = {
      roomCode: 'CLASH7',
      hostId: samplePlayer.id,
      players: mockPlayers,
      status: 'LOBBY',
      currentRound: 1,
      totalRounds: 5,
      activeMode: 'trivia',
      settings: {
        roundCount: 5,
        selectedModes: ['trivia', 'math', 'memory', 'reaction', 'rare_answer'],
        difficulty: 'medium',
      },
    };

    setCurrentPlayer(samplePlayer);
    setCurrentRoom(sampleRoom);
  };

  return (
    <GameStateContext.Provider
      value={{
        isConnected,
        isReconnecting,
        serverRestartNotice,
        clearServerRestartNotice,
        socketId,
        currentRoom,
        currentPlayer,
        activeChallenge,
        roundRecap,
        podiumData,
        isMuted,
        toggleSound,
        createRoom,
        joinRoom,
        reconnect,
        leaveRoom,
        startGame,
        kickPlayer,
        updateSettings,
        submitTrivia,
        submitMath,
        submitMemory,
        submitReaction,
        submitRareAnswer,
        playAgain,
        returnToLobby,
        retryAiGeneration,
        useOfflineQuestions,
        cancelMatch,
        preparingInfo,
        preparationError,
        clockOffsetMs,
        submittedPlayerIds,
        isJudging,
        voidNotice,
        clearVoidNotice,
        mySubmittedAnswer,
        setMySubmittedAnswer,
        setCurrentRoom,
        setCurrentPlayer,
        setActiveChallenge,
        setRoundRecap,
        setPodiumData,
        loadSampleRoom,
      }}
    >
      {children}
    </GameStateContext.Provider>
  );
};

export function useGame() {
  const context = useContext(GameStateContext);
  if (!context) {
    throw new Error('useGame must be used within GameStateProvider');
  }
  return context;
}
