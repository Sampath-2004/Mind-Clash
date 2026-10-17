import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { Trophy, RotateCcw, Home, Zap, Target, Flame, Crown, Medal, Layers } from 'lucide-react';
import { useGame } from '../context/GameStateContext';
import { AvatarBadge } from '../components/common/AvatarBadge';
import { sounds } from '../audio/soundEffects';
import { useToast } from '../context/ToastContext';
import { deterministicPlayerSort } from '@mind-clash/shared';

export const PodiumPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentRoom, currentPlayer, podiumData, playAgain, returnToLobby } = useGame();
  const { showToast } = useToast();
  const [isRestarting, setIsRestarting] = useState(false);

  // Auto-navigate back to lobby when rematch is triggered
  useEffect(() => {
    if (currentRoom?.status === 'LOBBY') {
      navigate('/lobby');
    }
  }, [currentRoom?.status, navigate]);

  useEffect(() => {
    // Play celebratory victory fanfare
    sounds.playVictoryFanfare();

    // Trigger confetti particles
    const end = Date.now() + 2.5 * 1000;
    const colors = ['#06B6D4', '#8B5CF6', '#F59E0B', '#10B981', '#EC4899'];

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  }, []);

  const isHost = currentRoom && currentPlayer
    ? currentRoom.hostId === currentPlayer.id || currentPlayer.isHost
    : true;

  const handlePlayAgain = async () => {
    sounds.playClick();
    if (!currentRoom) {
      navigate('/lobby');
      return;
    }

    if (!isHost) {
      showToast('Host Only', 'Only the room host can initiate a rematch', 'info');
      return;
    }

    setIsRestarting(true);
    const res = await playAgain();
    setIsRestarting(false);

    if (res.success) {
      showToast('Rematch Initiated!', 'Resetting room to lobby for another clash...', 'success');
      navigate('/lobby');
    } else {
      showToast('Rematch Failed', res.error || 'Could not reset room', 'error');
    }
  };

  const handleReturnToLobby = async () => {
    sounds.playClick();
    if (!currentRoom) {
      navigate('/lobby');
      return;
    }

    if (!isHost) {
      showToast('Host Only', 'Only the room host can return to lobby', 'info');
      return;
    }

    setIsRestarting(true);
    const res = await returnToLobby();
    setIsRestarting(false);

    if (res.success) {
      showToast('Returned to Lobby', 'Room reset for new configuration', 'info');
      navigate('/lobby');
    } else {
      showToast('Error', res.error || 'Could not return to lobby', 'error');
    }
  };

  // Derive podium leaderboard from live server data or fallback to demo
  const leaderboard = podiumData?.leaderboard || currentRoom?.players || [
    {
      id: 'p-1',
      sessionToken: 't1',
      nickname: currentPlayer?.nickname || 'NeoGamer',
      avatar: currentPlayer?.avatar || 'cyber-brain',
      score: 4850,
      streak: 5,
      isHost: true,
      isConnected: true,
      stats: {
        triviaCorrect: 5,
        triviaTotal: 5,
        mathCorrect: 2,
        mathTotal: 2,
        memoryPerfectCount: 1,
        fastestReactionMs: 214,
        highestStreak: 5,
        rareAnswerCorrect: 1,
        rareAnswerTotal: 1,
      },
    },
    {
      id: 'p-2',
      sessionToken: 't2',
      nickname: 'Valkyrie',
      avatar: 'plasma-dragon',
      score: 4120,
      streak: 3,
      isHost: false,
      isConnected: true,
      stats: {
        triviaCorrect: 4,
        triviaTotal: 5,
        mathCorrect: 2,
        mathTotal: 2,
        memoryPerfectCount: 0,
        fastestReactionMs: 240,
        highestStreak: 3,
        rareAnswerCorrect: 1,
        rareAnswerTotal: 1,
      },
    },
    {
      id: 'p-3',
      sessionToken: 't3',
      nickname: 'PixelPulse',
      avatar: 'astro-bot',
      score: 3650,
      streak: 2,
      isHost: false,
      isConnected: true,
      stats: {
        triviaCorrect: 3,
        triviaTotal: 5,
        mathCorrect: 1,
        mathTotal: 2,
        memoryPerfectCount: 1,
        fastestReactionMs: 290,
        highestStreak: 2,
        rareAnswerCorrect: 0,
        rareAnswerTotal: 1,
      },
    },
  ];

  const sortedLeaderboard = [...leaderboard].sort(deterministicPlayerSort);
  const first = sortedLeaderboard[0];
  const second = sortedLeaderboard[1];
  const third = sortedLeaderboard[2];
  const restPlayers = sortedLeaderboard.slice(3);

  // Accolades list
  const accoladesList = podiumData?.accolades || [
    {
      title: 'Lightning Reflexes',
      nickname: first?.nickname || 'NeoGamer',
      avatar: first?.avatar || 'cyber-brain',
      value: '214 ms',
    },
    {
      title: 'Precision Master',
      nickname: second?.nickname || 'Valkyrie',
      avatar: second?.avatar || 'plasma-dragon',
      value: '100% Accuracy',
    },
    {
      title: 'Unstoppable Flame',
      nickname: first?.nickname || 'NeoGamer',
      avatar: first?.avatar || 'cyber-brain',
      value: '5x Streak',
    },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 max-w-4xl mx-auto space-y-10">
      {/* Title */}
      <div className="text-center space-y-2">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-black uppercase tracking-widest">
          <Trophy className="w-4 h-4 text-amber-400" />
          Game Completed • Final Results
        </span>
        <h1 className="text-4xl sm:text-5xl font-black text-white">
          The Victory Podium
        </h1>
      </div>

      {/* Grand Final Winner Announcement */}
      {first && (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl text-center space-y-3 border-2 border-amber-400/40 shadow-2xl shadow-amber-500/20 relative overflow-hidden bg-gradient-to-b from-amber-500/10 via-slate-900/80 to-slate-900">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 font-black uppercase tracking-widest text-xs animate-pulse">
            <Crown className="w-4 h-4 text-amber-400" />
            GRAND CLASH CHAMPION
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-200 to-yellow-400">
            {first.nickname}
          </h2>
          <p className="text-sm sm:text-base text-slate-300 font-semibold">
            Victorious in 1st Place with <strong className="text-cyan-300 font-mono font-bold">{first.score.toLocaleString()} total points</strong>!
          </p>
        </div>
      )}

      {/* 3-Tier Podium Stage */}
      <div className="pt-6 pb-2 flex items-end justify-center gap-2 sm:gap-6 max-w-lg mx-auto">
        {/* 2nd Place */}
        {second ? (
          <div className="flex flex-col items-center flex-1">
            <div className="mb-2 flex flex-col items-center animate-pop motion-reduce:animate-none">
              <AvatarBadge avatarId={second.avatar} size="md" />
              <span className="font-bold text-xs sm:text-sm text-white mt-1 truncate max-w-[80px] sm:max-w-[100px]">
                {second.nickname}
              </span>
              <span className="font-mono text-[11px] font-black text-slate-300">
                {second.score.toLocaleString()}
              </span>
            </div>
            <div className="w-full h-36 sm:h-44 rounded-t-2xl bg-gradient-to-t from-slate-900 via-slate-800 to-slate-700/80 border-t-2 border-slate-300/40 p-2 flex flex-col items-center justify-between shadow-2xl">
              <span className="text-2xl font-black font-mono text-slate-300">2</span>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Silver
              </span>
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* 1st Place (Center / Champion) */}
        {first && (
          <div className="flex flex-col items-center flex-1 z-10">
            <div className="mb-2 flex flex-col items-center animate-pop motion-reduce:animate-none">
              <span className="text-2xl animate-bounce motion-reduce:animate-none">👑</span>
              <AvatarBadge avatarId={first.avatar} size="lg" isHost={first.isHost} />
              <span className="font-black text-sm sm:text-base text-amber-300 mt-1 truncate max-w-[100px] sm:max-w-[120px]">
                {first.nickname}
              </span>
              <span className="font-mono text-xs sm:text-sm font-black text-cyan-300">
                {first.score.toLocaleString()} PTS
              </span>
            </div>
            <div className="w-full h-48 sm:h-56 rounded-t-2xl bg-gradient-to-t from-slate-900 via-amber-950 to-amber-700/80 border-t-2 border-amber-400/60 p-2 flex flex-col items-center justify-between shadow-2xl shadow-amber-500/20">
              <span className="text-4xl font-black font-mono text-amber-300">1</span>
              <span className="text-[11px] uppercase font-black text-amber-300 tracking-widest flex items-center gap-1">
                <Crown className="w-3.5 h-3.5 text-amber-400" /> Champion
              </span>
            </div>
          </div>
        )}

        {/* 3rd Place */}
        {third ? (
          <div className="flex flex-col items-center flex-1">
            <div className="mb-2 flex flex-col items-center animate-pop motion-reduce:animate-none">
              <AvatarBadge avatarId={third.avatar} size="sm" />
              <span className="font-bold text-xs sm:text-sm text-white mt-1 truncate max-w-[80px] sm:max-w-[100px]">
                {third.nickname}
              </span>
              <span className="font-mono text-[11px] font-black text-slate-300">
                {third.score.toLocaleString()}
              </span>
            </div>
            <div className="w-full h-28 sm:h-36 rounded-t-2xl bg-gradient-to-t from-slate-900 via-slate-850 to-amber-900/60 border-t-2 border-amber-600/40 p-2 flex flex-col items-center justify-between shadow-xl">
              <span className="text-xl font-black font-mono text-amber-600">3</span>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Bronze
              </span>
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}
      </div>

      {/* Accolades & MVP Badges */}
      {accoladesList.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {accoladesList.map((acc, i) => (
            <div
              key={i}
              className="p-4 rounded-2xl bg-slate-900/70 border border-white/5 flex items-center justify-between backdrop-blur-md"
            >
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
                  {acc.title.includes('Reflex') ? (
                    <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  ) : acc.title.includes('Flame') || acc.title.includes('Streak') ? (
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <Target className="w-3.5 h-3.5 text-purple-400" />
                  )}
                  {acc.title}
                </span>
                <p className="font-bold text-sm text-white">{acc.nickname}</p>
              </div>
              <span className="font-mono text-xs font-black text-cyan-300 px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                {acc.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Additional Players Leaderboard (4th place and below) */}
      {restPlayers.length > 0 && (
        <div className="glass-panel p-6 rounded-3xl space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Remaining Rankings
          </h3>
          <div className="space-y-2">
            {restPlayers.map((player, idx) => (
              <div
                key={player.id}
                className="p-3 rounded-xl bg-slate-900/50 border border-white/5 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-slate-400 w-5 text-center">
                    {idx + 4}
                  </span>
                  <AvatarBadge avatarId={player.avatar} size="xs" />
                  <span className="font-bold text-white">{player.nickname}</span>
                </div>
                <span className="font-mono font-bold text-slate-300">
                  {player.score.toLocaleString()} PTS
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Footer Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
        {currentRoom && !isHost ? (
          <div className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-slate-300 text-xs font-bold flex items-center justify-center gap-2">
            <Medal className="w-4 h-4 text-cyan-400" />
            <span>Waiting for host to initiate rematch or return to lobby...</span>
          </div>
        ) : (
          <>
            <button
              onClick={handlePlayAgain}
              disabled={isRestarting}
              className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-purple-600 to-cyan-500 hover:brightness-110 active:scale-98 text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-cyan-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RotateCcw className={`w-4 h-4 ${isRestarting ? 'animate-spin' : ''}`} />
              {isRestarting ? 'Resetting Room...' : 'Play Again (Rematch)'}
            </button>

            <button
              onClick={handleReturnToLobby}
              disabled={isRestarting}
              className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-white/10 hover:bg-white/15 active:scale-98 text-white font-bold text-sm uppercase tracking-wider border border-white/15 shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Layers className="w-4 h-4 text-cyan-400" />
              Return to Lobby
            </button>
          </>
        )}

        <button
          onClick={() => {
            sounds.playClick();
            navigate('/');
          }}
          className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-sm uppercase tracking-wider border border-white/10 transition flex items-center justify-center gap-2"
        >
          <Home className="w-4 h-4" />
          Leave Match
        </button>
      </div>
    </div>
  );
};
