import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Player,
  RoomState,
  ActiveChallengeClient,
  RoundRecapData,
  GameOverPodiumData,
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
  // Demo / local preview state setters
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

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
      setSocketId(socket.id || null);
    }

    function onDisconnect() {
      setIsConnected(false);
      setSocketId(null);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const toggleSound = () => {
    const muted = sounds.toggleMute();
    setIsMuted(muted);
    if (!muted) sounds.playClick();
  };

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
      {
        id: 'p-4',
        sessionToken: 'token-4',
        nickname: 'ChronoZero',
        avatar: 'void-ninja',
        score: 850,
        streak: 1,
        isHost: false,
        isConnected: false,
        disconnectedAt: Date.now() - 15000,
        stats: {
          triviaCorrect: 1,
          triviaTotal: 2,
          mathCorrect: 0,
          mathTotal: 1,
          memoryPerfectCount: 0,
          fastestReactionMs: 412,
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
