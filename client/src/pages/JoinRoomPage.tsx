import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, LogIn, AlertCircle } from 'lucide-react';
import { AVATAR_OPTIONS, useGame } from '../context/GameStateContext';
import { AvatarBadge } from '../components/common/AvatarBadge';
import { ROOM_CODE_LENGTH } from '@mind-clash/shared';
import { sounds } from '../audio/soundEffects';
import { useToast } from '../context/ToastContext';

export const JoinRoomPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const { setCurrentPlayer, setCurrentRoom, socketId } = useGame();

  const [roomCode, setRoomCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_OPTIONS[1].id);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill room code if passed via URL (e.g., from share link)
  useEffect(() => {
    const codeParam = searchParams.get('code');
    if (codeParam) {
      setRoomCode(codeParam.toUpperCase().slice(0, ROOM_CODE_LENGTH));
    }
  }, [searchParams]);

  const handleRoomCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LENGTH);
    setRoomCode(val);
    if (error) setError(null);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    sounds.playClick();

    if (roomCode.length !== ROOM_CODE_LENGTH) {
      setError(`Room code must be exactly ${ROOM_CODE_LENGTH} characters`);
      return;
    }

    const trimmed = nickname.trim();
    if (trimmed.length < 2) {
      setError('Nickname must be at least 2 characters');
      return;
    }

    const joiningPlayer = {
      id: socketId || 'player-joiner',
      sessionToken: 'token-' + Math.random().toString(36).slice(2, 9),
      nickname: trimmed,
      avatar: selectedAvatar,
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

    const mockHost = {
      id: 'host-1',
      sessionToken: 'token-host',
      nickname: 'ArenaMaster',
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
    };

    setCurrentPlayer(joiningPlayer);
    setCurrentRoom({
      roomCode,
      hostId: mockHost.id,
      players: [mockHost, joiningPlayer],
      status: 'LOBBY',
      currentRound: 1,
      totalRounds: 5,
      activeMode: 'trivia',
      settings: {
        roundCount: 5,
        selectedModes: ['trivia', 'math', 'memory', 'reaction'],
      },
    });

    showToast('Joined Lobby!', `Connected to Room ${roomCode}`, 'success');
    navigate('/lobby');
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-xl space-y-6">
        <Link
          to="/"
          onClick={() => sounds.playClick()}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              Join Battle Arena
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Enter the 6-character room code to challenge competitors
            </p>
          </div>

          <form onSubmit={handleJoin} className="space-y-6">
            {/* Room Code Field */}
            <div className="space-y-2">
              <label htmlFor="roomCode" className="block text-xs uppercase tracking-wider font-bold text-slate-300">
                6-Character Room Code
              </label>
              <input
                id="roomCode"
                type="text"
                value={roomCode}
                onChange={handleRoomCodeChange}
                placeholder="e.g. CLASH7"
                maxLength={ROOM_CODE_LENGTH}
                className="w-full px-4 py-3.5 rounded-2xl bg-slate-950/80 border border-cyan-500/30 text-cyan-300 placeholder-slate-600 font-mono font-black text-xl tracking-widest text-center uppercase focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition"
                autoFocus={!roomCode}
              />
            </div>

            {/* Nickname Field */}
            <div className="space-y-2">
              <label htmlFor="join-nickname" className="block text-xs uppercase tracking-wider font-bold text-slate-300">
                Your Nickname
              </label>
              <input
                id="join-nickname"
                type="text"
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Enter callsign"
                maxLength={20}
                className="w-full px-4 py-3.5 rounded-2xl bg-slate-950/80 border border-white/10 text-white placeholder-slate-500 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition"
              />
            </div>

            {/* Avatar Selector */}
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
                    className="p-1 rounded-2xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 flex items-center justify-center"
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

            {error && (
              <p className="flex items-center gap-1.5 text-xs text-rose-400 font-medium">
                <AlertCircle className="w-3.5 h-3.5" /> {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-cyan-500 hover:brightness-110 active:scale-98 text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-purple-600/25 transition-all flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Enter Arena
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
