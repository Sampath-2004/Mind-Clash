import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, ArrowRight, Zap, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { useGame } from '../context/GameStateContext';
import { PlayerCard } from '../components/common/PlayerCard';
import { sounds } from '../audio/soundEffects';

export const RoundRecapPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentRoom, currentPlayer, roundRecap } = useGame();

  // Synchronized Navigation: automatically transition as server advances round or ends match
  useEffect(() => {
    if (currentRoom?.status === 'ROUND_ACTIVE') {
      navigate('/game');
    } else if (currentRoom?.status === 'GAME_OVER') {
      navigate('/podium');
    } else if (currentRoom?.status === 'LOBBY') {
      navigate('/lobby');
    }
  }, [currentRoom?.status, navigate]);

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
      rankDelta: 1,
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
      rankDelta: -1,
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
  ];

  const handleNext = () => {
    sounds.playClick();
    navigate('/podium');
  };

  const roundNum = roundRecap ? roundRecap.roundNumber : (currentRoom?.currentRound || 1);
  const totalRounds = roundRecap ? roundRecap.totalRounds : (currentRoom?.totalRounds || 5);

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      {/* Round Header */}
      <div className="text-center space-y-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-wider">
          <Trophy className="w-3.5 h-3.5" />
          Round {roundNum} / {totalRounds} Standings
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-white">
          Round Scoreboard
        </h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Server-authoritative scores calculated from speed and precision
        </p>
      </div>

      {/* Answer Reveal Card */}
      <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm text-emerald-200">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>
            {roundRecap ? (
              <>
                {roundRecap.triviaRevealIndex !== undefined && (
                  <>
                    Correct Answer:{' '}
                    <strong className="text-white font-bold">
                      {roundRecap.triviaCorrectText
                        ? roundRecap.triviaCorrectText
                        : `Option #${roundRecap.triviaRevealIndex + 1}`}
                    </strong>
                  </>
                )}
                {roundRecap.mathCorrectAnswer !== undefined && (
                  <>
                    Calculated Solution:{' '}
                    <strong className="text-white font-bold font-mono">
                      {roundRecap.mathCorrectAnswer}
                    </strong>
                  </>
                )}
                {roundRecap.memorySequence && (
                  <>
                    Target Sequence:{' '}
                    <strong className="text-white font-bold font-mono tracking-wider">
                      {roundRecap.memorySequence.join(' → ')}
                    </strong>
                  </>
                )}
                {!roundRecap.memorySequence && roundRecap.memorySolution !== undefined && (
                  <>
                    Target Pattern Solution:{' '}
                    <strong className="text-white font-bold font-mono">
                      {roundRecap.memorySolution.length} Activated Tiles
                    </strong>
                  </>
                )}
                {roundRecap.mode === 'reaction' && (
                  <>
                    Reflex Assessment:{' '}
                    <strong className="text-white font-bold">
                      {roundRecap.reactionFastestMs !== undefined
                        ? `Fastest reflex: ${roundRecap.reactionFastestMs} ms`
                        : 'Reaction Times Recorded'}
                    </strong>
                  </>
                )}
              </>
            ) : (
              <>
                Correct Answer:{' '}
                <strong className="text-white font-bold">Quantum Bit (Qubit)</strong>
              </>
            )}
          </span>
        </div>
        <span className="font-mono text-emerald-400 font-bold shrink-0">
          +100 Base + Up to 50 Speed Bonus
        </span>
      </div>

      {/* Network Latency Notice Banner */}
      {roundRecap?.networkNotice && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-center gap-2.5">
          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong className="text-white font-semibold">Fairness Notice: </strong>
            {roundRecap.networkNotice}
          </span>
        </div>
      )}

      {/* Round Result Explanation */}
      {roundRecap?.explanation && (
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-cyan-500/20 text-xs text-slate-300 flex items-start gap-3 backdrop-blur-md shadow-lg">
          <div className="w-6 h-6 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-cyan-400 font-bold text-xs">💡</span>
          </div>
          <div className="space-y-0.5">
            <span className="font-bold text-cyan-300 uppercase text-[10px] tracking-wider block">
              Explanation & Fact Check
            </span>
            <p className="text-slate-300 leading-relaxed">{roundRecap.explanation}</p>
          </div>
        </div>
      )}

      {/* Leaderboard Stack */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-4">
        <div className="space-y-3">
          {roundRecap
            ? roundRecap.results.map((res) => {
                const playerObj = currentRoom?.players.find((p) => p.id === res.playerId) || {
                  id: res.playerId,
                  sessionToken: '',
                  nickname: res.nickname,
                  avatar: res.avatar,
                  score: res.totalScore,
                  streak: res.isCorrect ? 1 : 0,
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

                return (
                  <div key={res.playerId} className="relative">
                    <PlayerCard
                      player={playerObj}
                      rank={res.rank}
                      rankDelta={res.rankDelta}
                      isCurrentPlayer={res.playerId === currentPlayer?.id}
                      showScore={true}
                    />
                    <div className="absolute right-24 sm:right-32 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs font-mono">
                      {res.falseStart ? (
                        <span className="text-rose-400 font-bold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> -200 (False Start)
                        </span>
                      ) : res.isCorrect ? (
                        <span className="text-emerald-400 font-bold">
                          +{res.pointsEarned.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-slate-500 font-bold">+0</span>
                      )}
                    </div>
                  </div>
                );
              })
            : mockResults.map((res) => (
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

        {/* Action Controls & Synchronized Transition Status */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/5">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {currentRoom ? (
              <>
                <Clock className="w-4 h-4 text-cyan-400 animate-spin" />
                <span>Synchronizing next round transition with server...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-cyan-400 animate-pulse" />
                <span>Next challenge: Speed Math • Round 3</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {!currentRoom && (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
