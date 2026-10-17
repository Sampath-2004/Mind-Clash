import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { Trophy, RotateCcw, Home, Zap, Target, Flame } from 'lucide-react';
import { useGame } from '../context/GameStateContext';
import { AvatarBadge } from '../components/common/AvatarBadge';
import { sounds } from '../audio/soundEffects';

export const PodiumPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentPlayer } = useGame();

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

  const samplePodium = [
    {
      rank: 1,
      nickname: currentPlayer?.nickname || 'NeoGamer',
      avatar: currentPlayer?.avatar || 'cyber-brain',
      score: 4850,
      badge: '👑 Grand Champion',
      color: 'from-amber-400 via-amber-500 to-yellow-600',
      pedestalHeight: 'h-48 sm:h-56',
    },
    {
      rank: 2,
      nickname: 'Valkyrie',
      avatar: 'plasma-dragon',
      score: 4120,
      badge: '🥈 Runner-Up',
      color: 'from-slate-300 via-slate-400 to-slate-500',
      pedestalHeight: 'h-36 sm:h-44',
    },
    {
      rank: 3,
      nickname: 'PixelPulse',
      avatar: 'astro-bot',
      score: 3650,
      badge: '🥉 3rd Place',
      color: 'from-amber-700 via-amber-800 to-amber-900',
      pedestalHeight: 'h-28 sm:h-36',
    },
  ];

  const accolades = [
    {
      title: 'Lightning Reflexes',
      winner: 'NeoGamer',
      avatar: 'cyber-brain',
      value: '214 ms',
      icon: <Zap className="w-4 h-4 text-cyan-400" />,
    },
    {
      title: 'Precision Master',
      winner: 'Valkyrie',
      avatar: 'plasma-dragon',
      value: '100% Accuracy',
      icon: <Target className="w-4 h-4 text-purple-400" />,
    },
    {
      title: 'Unstoppable Flame',
      winner: 'NeoGamer',
      avatar: 'cyber-brain',
      value: '5x Streak',
      icon: <Flame className="w-4 h-4 text-amber-400" />,
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

      {/* 3-Tier Podium Stage */}
      <div className="pt-6 pb-2 flex items-end justify-center gap-2 sm:gap-6 max-w-lg mx-auto">
        {/* 2nd Place */}
        <div className="flex flex-col items-center flex-1">
          <div className="mb-2 flex flex-col items-center animate-pop motion-reduce:animate-none">
            <AvatarBadge avatarId={samplePodium[1].avatar} size="md" />
            <span className="font-bold text-xs sm:text-sm text-white mt-1 truncate max-w-[80px] sm:max-w-[100px]">
              {samplePodium[1].nickname}
            </span>
            <span className="font-mono text-[11px] font-black text-slate-300">
              {samplePodium[1].score.toLocaleString()}
            </span>
          </div>
          <div
            className={`w-full ${samplePodium[1].pedestalHeight} rounded-t-2xl bg-gradient-to-t from-slate-900 via-slate-800 to-slate-700/80 border-t-2 border-slate-300/40 p-2 flex flex-col items-center justify-between shadow-2xl`}
          >
            <span className="text-2xl font-black font-mono text-slate-300">2</span>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Silver
            </span>
          </div>
        </div>

        {/* 1st Place (Center / Highest) */}
        <div className="flex flex-col items-center flex-1 z-10">
          <div className="mb-2 flex flex-col items-center animate-pop motion-reduce:animate-none">
            <span className="text-2xl animate-bounce motion-reduce:animate-none">👑</span>
            <AvatarBadge avatarId={samplePodium[0].avatar} size="lg" isHost={true} />
            <span className="font-black text-sm sm:text-base text-amber-300 mt-1 truncate max-w-[100px] sm:max-w-[120px]">
              {samplePodium[0].nickname}
            </span>
            <span className="font-mono text-xs sm:text-sm font-black text-cyan-300">
              {samplePodium[0].score.toLocaleString()} PTS
            </span>
          </div>
          <div
            className={`w-full ${samplePodium[0].pedestalHeight} rounded-t-2xl bg-gradient-to-t from-slate-900 via-amber-950 to-amber-700/80 border-t-2 border-amber-400/60 p-2 flex flex-col items-center justify-between shadow-2xl shadow-amber-500/20`}
          >
            <span className="text-4xl font-black font-mono text-amber-300">1</span>
            <span className="text-[11px] uppercase font-black text-amber-300 tracking-widest">
              Champion
            </span>
          </div>
        </div>

        {/* 3rd Place */}
        <div className="flex flex-col items-center flex-1">
          <div className="mb-2 flex flex-col items-center animate-pop motion-reduce:animate-none">
            <AvatarBadge avatarId={samplePodium[2].avatar} size="sm" />
            <span className="font-bold text-xs sm:text-sm text-white mt-1 truncate max-w-[80px] sm:max-w-[100px]">
              {samplePodium[2].nickname}
            </span>
            <span className="font-mono text-[11px] font-black text-slate-300">
              {samplePodium[2].score.toLocaleString()}
            </span>
          </div>
          <div
            className={`w-full ${samplePodium[2].pedestalHeight} rounded-t-2xl bg-gradient-to-t from-slate-900 via-slate-850 to-amber-900/60 border-t-2 border-amber-600/40 p-2 flex flex-col items-center justify-between shadow-xl`}
          >
            <span className="text-xl font-black font-mono text-amber-600">3</span>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Bronze
            </span>
          </div>
        </div>
      </div>

      {/* Accolades & MVP Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {accolades.map((acc, i) => (
          <div
            key={i}
            className="p-4 rounded-2xl bg-slate-900/70 border border-white/5 flex items-center justify-between backdrop-blur-md"
          >
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
                {acc.icon} {acc.title}
              </span>
              <p className="font-bold text-sm text-white">{acc.winner}</p>
            </div>
            <span className="font-mono text-xs font-black text-cyan-300 px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              {acc.value}
            </span>
          </div>
        ))}
      </div>

      {/* Action Footer Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
        <button
          onClick={() => {
            sounds.playClick();
            navigate('/lobby');
          }}
          className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-purple-600 to-cyan-500 hover:brightness-110 active:scale-98 text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-cyan-500/20 transition flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Play Again (Rematch)
        </button>

        <button
          onClick={() => {
            sounds.playClick();
            navigate('/');
          }}
          className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-sm uppercase tracking-wider border border-white/10 transition flex items-center justify-center gap-2"
        >
          <Home className="w-4 h-4" />
          Back to Home
        </button>
      </div>
    </div>
  );
};
