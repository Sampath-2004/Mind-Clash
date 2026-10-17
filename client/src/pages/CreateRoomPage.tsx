import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, Check, Layers, AlertCircle } from 'lucide-react';
import { AVATAR_OPTIONS, useGame } from '../context/GameStateContext';
import { AvatarBadge } from '../components/common/AvatarBadge';
import { GameMode, DEFAULT_ROUND_COUNT } from '@mind-clash/shared';
import { sounds } from '../audio/soundEffects';
import { useToast } from '../context/ToastContext';

export const CreateRoomPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { setCurrentPlayer, setCurrentRoom, socketId } = useGame();

  const [nickname, setNickname] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_OPTIONS[0].id);
  const [roundCount, setRoundCount] = useState<number>(DEFAULT_ROUND_COUNT);
  const [selectedModes, setSelectedModes] = useState<GameMode[]>([
    'trivia',
    'math',
    'memory',
    'reaction',
  ]);
  const [error, setError] = useState<string | null>(null);

  const toggleMode = (mode: GameMode) => {
    sounds.playClick();
    if (selectedModes.includes(mode)) {
      if (selectedModes.length <= 1) {
        showToast('Mode Selection', 'At least one game mode must be enabled', 'warning');
        return;
      }
      setSelectedModes((prev) => prev.filter((m) => m !== mode));
    } else {
      setSelectedModes((prev) => [...prev, mode]);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    sounds.playClick();

    const trimmed = nickname.trim();
    if (trimmed.length < 2) {
      setError('Nickname must be at least 2 characters long');
      return;
    }
    if (trimmed.length > 20) {
      setError('Nickname must not exceed 20 characters');
      return;
    }

    // Generate room state for preview & navigation
    const generatedCode = 'MIND' + Math.floor(10 + Math.random() * 89);
    const hostPlayer = {
      id: socketId || 'player-host',
      sessionToken: 'token-' + Math.random().toString(36).slice(2, 9),
      nickname: trimmed,
      avatar: selectedAvatar,
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
    setCurrentRoom({
      roomCode: generatedCode,
      hostId: hostPlayer.id,
      players: [hostPlayer],
      status: 'LOBBY',
      currentRound: 1,
      totalRounds: roundCount,
      activeMode: selectedModes[0],
      settings: {
        roundCount,
        selectedModes,
      },
    });

    showToast('Arena Created!', `Room ${generatedCode} is ready for competitors`, 'success');
    navigate('/lobby');
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-xl space-y-6">
        {/* Navigation Back */}
        <Link
          to="/"
          onClick={() => sounds.playClick()}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        {/* Form Card */}
        <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-6 relative overflow-hidden">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              Create Battle Arena
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Configure your game room and challenge your competitors
            </p>
          </div>

          <form onSubmit={handleCreate} className="space-y-6">
            {/* Nickname Input */}
            <div className="space-y-2">
              <label htmlFor="nickname" className="block text-xs uppercase tracking-wider font-bold text-slate-300">
                Your Nickname
              </label>
              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Enter callsign (e.g. ApexPredator)"
                maxLength={20}
                className="w-full px-4 py-3.5 rounded-2xl bg-slate-950/80 border border-white/10 text-white placeholder-slate-500 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition"
                autoFocus
              />
              {error && (
                <p className="flex items-center gap-1.5 text-xs text-rose-400 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" /> {error}
                </p>
              )}
            </div>

            {/* Avatar Selection Grid */}
            <div className="space-y-2">
              <span className="block text-xs uppercase tracking-wider font-bold text-slate-300">
                Choose Avatar
              </span>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
                {AVATAR_OPTIONS.map((av) => (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setSelectedAvatar(av.id);
                    }}
                    className="p-1 rounded-2xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 flex items-center justify-center"
                    title={av.label}
                  >
                    <AvatarBadge
                      avatarId={av.id}
                      isSelected={selectedAvatar === av.id}
                      size="md"
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Rounds Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider font-bold text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" /> Total Rounds
                </span>
                <span className="text-xs font-mono font-bold text-cyan-300">
                  {roundCount} Rounds
                </span>
              </div>
              <div className="flex items-center gap-2">
                {[3, 5, 7, 10].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setRoundCount(count);
                    }}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                      roundCount === count
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 ring-1 ring-cyan-400/40'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            {/* Game Modes Toggles */}
            <div className="space-y-2">
              <span className="block text-xs uppercase tracking-wider font-bold text-slate-300">
                Game Modes Included
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(['trivia', 'math', 'memory', 'reaction'] as GameMode[]).map((mode) => {
                  const isEnabled = selectedModes.includes(mode);
                  const labels: Record<GameMode, string> = {
                    trivia: 'Trivia Blitz',
                    math: 'Speed Math',
                    memory: 'Memory Matrix',
                    reaction: 'Reaction Clash',
                  };

                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => toggleMode(mode)}
                      className={`flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition ${
                        isEnabled
                          ? 'bg-purple-950/40 border-purple-500/40 text-purple-200 ring-1 ring-purple-500/30'
                          : 'bg-white/5 border-white/5 text-slate-500 opacity-60'
                      }`}
                    >
                      <span>{labels[mode]}</span>
                      {isEnabled && <Check className="w-3.5 h-3.5 text-purple-400" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-purple-600 to-cyan-500 hover:brightness-110 active:scale-98 text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-cyan-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Initialize Lobby
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
