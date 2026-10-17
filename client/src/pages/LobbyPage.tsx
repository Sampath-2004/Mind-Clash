import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, UserPlus, LogOut, ShieldAlert } from 'lucide-react';
import { useGame, AVATAR_OPTIONS } from '../context/GameStateContext';
import { RoomCodeDisplay } from '../components/common/RoomCodeDisplay';
import { PlayerList } from '../components/lobby/PlayerList';
import { SettingsSummary } from '../components/lobby/SettingsSummary';
import { ShareModal } from '../components/lobby/ShareModal';
import { sounds } from '../audio/soundEffects';
import { useToast } from '../context/ToastContext';
import { MAX_PLAYERS_PER_ROOM } from '@mind-clash/shared';

export const LobbyPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentRoom, currentPlayer, setCurrentRoom } = useGame();
  const { showToast } = useToast();
  const [isShareOpen, setIsShareOpen] = useState(false);

  // If no room is currently loaded, initialize sample
  const room = currentRoom || {
    roomCode: 'CLASH7',
    hostId: 'p-host',
    players: [
      {
        id: 'p-host',
        sessionToken: 'token-1',
        nickname: 'VortexCommander',
        avatar: 'cyber-brain',
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
      },
      {
        id: 'p-2',
        sessionToken: 'token-2',
        nickname: 'NebulaStrike',
        avatar: 'plasma-dragon',
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
      },
    ],
    status: 'LOBBY' as const,
    currentRound: 1,
    totalRounds: 5,
    activeMode: 'trivia' as const,
    settings: {
      roundCount: 5,
      selectedModes: ['trivia', 'math', 'memory', 'reaction'] as const,
    },
  };

  const isHost = currentPlayer ? currentPlayer.isHost : true;

  const handleStartGame = () => {
    sounds.playClick();
    if (room.players.length < 2) {
      showToast('Need Players', 'A minimum of 2 players is required to start', 'warning');
      return;
    }
    showToast('Match Starting!', 'Entering synchronized battle arena...', 'info');
    navigate('/game');
  };

  const handleSimulateJoin = () => {
    sounds.playClick();
    if (room.players.length >= MAX_PLAYERS_PER_ROOM) {
      showToast('Lobby Full', `Maximum capacity is ${MAX_PLAYERS_PER_ROOM} players`, 'warning');
      return;
    }
    const names = ['ApexRogue', 'GhostByte', 'QuantumEcho', 'SolarFlare', 'HyperNova', 'TitanZero'];
    const randomName = names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 99);
    const randomAvatar = AVATAR_OPTIONS[Math.floor(Math.random() * AVATAR_OPTIONS.length)].id;

    const newPlayer = {
      id: `p-${Date.now()}`,
      sessionToken: `token-${Date.now()}`,
      nickname: randomName,
      avatar: randomAvatar,
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

    setCurrentRoom((prev) => (prev ? { ...prev, players: [...prev.players, newPlayer] } : null));
    showToast('Player Joined!', `${randomName} stepped into the lobby`, 'info');
  };

  const handleKickPlayer = (playerId: string) => {
    sounds.playClick();
    setCurrentRoom((prev) => {
      if (!prev) return null;
      const target = prev.players.find((p) => p.id === playerId);
      if (target) {
        showToast('Player Removed', `${target.nickname} was removed from the lobby`, 'info');
      }
      return {
        ...prev,
        players: prev.players.filter((p) => p.id !== playerId),
      };
    });
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      {/* Top Banner & Room Code Display */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-6 text-center">
        <RoomCodeDisplay
          roomCode={room.roomCode}
          onOpenShare={() => setIsShareOpen(true)}
          size="large"
        />
        <SettingsSummary settings={room.settings} />
      </div>

      {/* Main Roster Panel */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-6">
        <PlayerList
          players={room.players}
          currentPlayerId={currentPlayer?.id || room.hostId}
          isHost={isHost}
          onKickPlayer={handleKickPlayer}
        />

        {/* Action Controls */}
        <div className="pt-4 flex flex-col sm:flex-row items-center gap-3">
          {/* Host Controls */}
          {isHost ? (
            <button
              onClick={handleStartGame}
              disabled={room.players.length < 2}
              className={`w-full sm:flex-1 py-4 px-6 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl transition-all active:scale-98 ${
                room.players.length >= 2
                  ? 'bg-gradient-to-r from-cyan-500 to-purple-600 hover:brightness-110 text-white shadow-cyan-500/25'
                  : 'bg-white/5 border border-white/10 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Play className="w-5 h-5 fill-current" />
              Start Match ({room.players.length}/2+ Ready)
            </button>
          ) : (
            <div className="w-full sm:flex-1 py-4 px-6 rounded-2xl bg-white/5 border border-white/10 text-center text-xs font-semibold text-slate-300 flex items-center justify-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Waiting for host ({room.players.find((p) => p.isHost)?.nickname || 'Host'}) to start the match...
            </div>
          )}

          {/* Quick Roster Simulator Button for Testing */}
          <button
            onClick={handleSimulateJoin}
            disabled={room.players.length >= MAX_PLAYERS_PER_ROOM}
            className="w-full sm:w-auto px-4 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-bold transition flex items-center justify-center gap-1.5"
            title="Simulate adding a player to test roster responsiveness"
          >
            <UserPlus className="w-4 h-4 text-cyan-400" />
            + Simulate Player
          </button>

          {/* Leave Button */}
          <button
            onClick={() => {
              sounds.playClick();
              navigate('/');
            }}
            className="w-full sm:w-auto px-4 py-4 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-4 h-4" />
            Leave
          </button>
        </div>
      </div>

      {/* Share Modal Dialog */}
      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        roomCode={room.roomCode}
      />
    </div>
  );
};
