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
  const [socketId, setSocketId] = useState<string | null>(socket.id || null);
  const [currentRoom, setCurrentRoom] = useState<RoomState | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [activeChallenge, setActiveChallenge] = useState<ActiveChallengeClient | null>(null);
  const [roundRecap, setRoundRecap] = useState<RoundRecapData | null>(null);
  const [podiumData, setPodiumData] = useState<GameOverPodiumData | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(sounds.getMuted());

  // Socket Lifecycle Listeners
  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
      setSocketId(socket.id || null);

      // Attempt automatic session recovery if stored in localStorage
      const savedCode = localStorage.getItem('mind_clash_room_code');
      const savedToken = localStorage.getItem('mind_clash_session_token');
      if (savedCode && savedToken) {
        socket.emit('reconnect_player', { roomCode: savedCode, sessionToken: savedToken }, (res) => {
          if (res.success && res.data) {
            setCurrentRoom(res.data.room);
            const myPlayer = res.data.room.players.find((p) => p.id === socket.id);
            if (myPlayer) setCurrentPlayer(myPlayer);
          } else {
            // Expired or invalid session
            localStorage.removeItem('mind_clash_room_code');
            localStorage.removeItem('mind_clash_session_token');
          }
        });
      }
    }

    function onDisconnect() {
      setIsConnected(false);
      setSocketId(null);
    }

    function onRoomStateUpdated(updatedRoom: RoomState) {
      setCurrentRoom(updatedRoom);
      // Synchronize current player instance
      const myToken = localStorage.getItem('mind_clash_session_token');
      const me = updatedRoom.players.find((p) => p.id === socket.id || (myToken && p.sessionToken === myToken));
      if (me) {
        setCurrentPlayer(me);
      }
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

    function onKicked(data: { reason: string }) {
      sounds.playError();
      localStorage.removeItem('mind_clash_room_code');
      localStorage.removeItem('mind_clash_session_token');
      setCurrentRoom(null);
      setCurrentPlayer(null);
      window.location.href = `/error?type=kicked&reason=${encodeURIComponent(data.reason)}`;
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room_state_updated', onRoomStateUpdated);
    socket.on('player_joined', onPlayerJoined);
    socket.on('player_left', onPlayerLeft);
    socket.on('player_reconnected', onPlayerReconnected);
    socket.on('kicked', onKicked);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room_state_updated', onRoomStateUpdated);
      socket.off('player_joined', onPlayerJoined);
      socket.off('player_left', onPlayerLeft);
      socket.off('player_reconnected', onPlayerReconnected);
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
            localStorage.setItem('mind_clash_room_code', res.data.roomCode);
            localStorage.setItem('mind_clash_session_token', res.data.sessionToken);

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
            localStorage.setItem('mind_clash_room_code', res.data.roomCode);
            localStorage.setItem('mind_clash_session_token', res.data.sessionToken);

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
      const code = localStorage.getItem('mind_clash_room_code');
      const token = localStorage.getItem('mind_clash_session_token');

      if (!code || !token) {
        return resolve({ success: false, error: 'No active session saved' });
      }

      socket.emit('reconnect_player', { roomCode: code, sessionToken: token }, (res) => {
        if (res.success && res.data) {
          setCurrentRoom(res.data.room);
          const me = res.data.room.players.find((p) => p.id === socket.id || p.sessionToken === token);
          if (me) setCurrentPlayer(me);
          resolve({ success: true });
        } else {
          resolve({ success: false, error: res.error || 'Reconnection failed' });
        }
      });
    });
  }, []);

  // Leave room
  const leaveRoom = useCallback(() => {
    socket.emit('leave_room');
    localStorage.removeItem('mind_clash_room_code');
    localStorage.removeItem('mind_clash_session_token');
    setCurrentRoom(null);
    setCurrentPlayer(null);
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
        selectedModes: ['trivia', 'math', 'memory', 'reaction'],
      },
    };

    setCurrentPlayer(samplePlayer);
    setCurrentRoom(sampleRoom);
  };

  return (
    <GameStateContext.Provider
      value={{
        isConnected,
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
