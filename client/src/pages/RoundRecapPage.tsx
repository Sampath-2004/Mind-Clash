import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';
import { useGame } from '../context/GameStateContext';
import { PlayerCard } from '../components/common/PlayerCard';
import { sounds } from '../audio/soundEffects';

export const RoundRecapPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentPlayer } = useGame();

  const mockResults = [
    {
      player: {
        id: 'p-1',
        sessionToken: 't1',
        nickname: currentPlayer?.nickname || 'NeoGamer',
        avatar: currentPlayer?.avatar || 'cyber-brain',
        score: 2650,
        streak: 4,
        isHost: true,
        isConnected: true,
        stats: {
          triviaCorrect: 3,
          triviaTotal: 3,
          mathCorrect: 1,
          mathTotal: 1,
          memoryPerfectCount: 1,
          fastestReactionMs: 220,
          highestStreak: 4,
        },
      },
      pointsEarned: 800,
      rank: 1,
      rankDelta: 1, // Moved up 1 rank
      isCorrect: true,
    },
    {
      player: {
        id: 'p-2',
        sessionToken: 't2',
        nickname: 'Valkyrie',
        avatar: 'plasma-dragon',
        score: 2250,
        streak: 2,
        isHost: false,
        isConnected: true,
        stats: {
          triviaCorrect: 2,
          triviaTotal: 3,
          mathCorrect: 1,
          mathTotal: 1,
          memoryPerfectCount: 0,
          fastestReactionMs: 254,
          highestStreak: 2,
        },
      },
      pointsEarned: 630,
      rank: 2,
      rankDelta: -1, // Slipped down
      isCorrect: true,
    },
    {
      player: {
        id: 'p-3',
        sessionToken: 't3',
        nickname: 'PixelPulse',
        avatar: 'astro-bot',
        score: 1450,
        streak: 0,
        isHost: false,
        isConnected: true,
        stats: {
          triviaCorrect: 1,
          triviaTotal: 3,
          mathCorrect: 0,
          mathTotal: 1,
          memoryPerfectCount: 1,
          fastestReactionMs: 310,
          highestStreak: 1,
        },
      },
      pointsEarned: 350,
      rank: 3,
      rankDelta: 0,
      isCorrect: true,
    },
    {
      player: {
        id: 'p-4',
        sessionToken: 't4',
        nickname: 'ChronoZero',
        avatar: 'void-ninja',
        score: 850,
        streak: 0,
        isHost: false,
        isConnected: false,
        stats: {
          triviaCorrect: 1,
          triviaTotal: 3,
          mathCorrect: 0,
          mathTotal: 1,
          memoryPerfectCount: 0,
          fastestReactionMs: 412,
          highestStreak: 1,
        },
      },
      pointsEarned: 0,
      rank: 4,
      rankDelta: 0,
      isCorrect: false,
    },
  ];

  const handleNext = () => {
    sounds.playClick();
    navigate('/podium');
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      {/* Round Header */}
      <div className="text-center space-y-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-wider">
          <Trophy className="w-3.5 h-3.5" />
          Round 2 / 5 Standings
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-white">
          Round Scoreboard
        </h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Real-time rank updates calculated from speed and precision
        </p>
      </div>

      {/* Answer Reveal Card */}
      <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between text-xs sm:text-sm text-emerald-200">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>
            Correct Answer:{' '}
            <strong className="text-white font-bold">Quantum Bit (Qubit)</strong>
          </span>
        </div>
        <span className="font-mono text-emerald-400 font-bold shrink-0">
          +500 Base + Speed Bonus
        </span>
      </div>

      {/* Leaderboard Stack */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-4">
        <div className="space-y-3">
          {mockResults.map((res) => (
            <PlayerCard
              key={res.player.id}
              player={res.player}
              rank={res.rank}
              rankDelta={res.rankDelta}
              isCurrentPlayer={res.player.id === (currentPlayer?.id || 'p-1')}
              showScore={true}
            />
          ))}
        </div>

        {/* Action Controls */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/5">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Zap className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span>Next challenge: Speed Math • Round 3</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                sounds.playClick();
                navigate('/game');
              }}
              className="flex-1 sm:flex-none px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs uppercase tracking-wider transition"
            >
              Back to Arena
            </button>

            <button
              onClick={handleNext}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 hover:brightness-110 active:scale-98 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/25 transition"
            >
              <span>View Final Podium</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
