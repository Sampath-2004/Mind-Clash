import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, ArrowRight, Zap, CheckCircle2, AlertCircle, Clock, XCircle, Sparkles } from 'lucide-react';
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
          rareAnswerCorrect: 1,
          rareAnswerTotal: 1,
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
          rareAnswerCorrect: 1,
          rareAnswerTotal: 1,
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
          rareAnswerCorrect: 0,
          rareAnswerTotal: 1,
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
                {roundRecap.mode === 'rare_answer' && (
                  <>
                    Rare Answer Challenge:{' '}
                    <strong className="text-white font-bold">
                      {roundRecap.rareAnswerPrompt || 'Uniqueness Evaluated'}
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
          {roundRecap?.mode === 'rare_answer'
            ? 'Match Uniqueness: 100 ÷ Matching Players'
            : '+100 Base + Up to 50 Speed Bonus'}
        </span>
      </div>

      {/* Round Voided Banner */}
      {roundRecap?.isVoided && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-amber-300 uppercase text-xs tracking-wider block">
              Round Voided & Replaced
            </span>
            <p className="text-xs text-amber-200/90 leading-relaxed">
              {roundRecap.voidReason || 'Round could not be judged fairly and was voided for everyone. A replacement round has been scheduled with no score penalties.'}
            </p>
          </div>
        </div>
      )}

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

      {/* Rare Answer Submissions & Rarity Breakdown */}
      {roundRecap?.rareAnswerSubmissions && roundRecap.rareAnswerSubmissions.length > 0 && (
        <div className="glass-panel p-6 rounded-3xl space-y-4 border border-rose-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-400" />
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Submitted Answers & Match Rarity
              </h3>
            </div>
            <span className="text-[11px] font-mono text-rose-300">
              Match Uniqueness Only
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {roundRecap.rareAnswerSubmissions.map((sub) => (
              <div
                key={sub.playerId}
                className={`p-3.5 rounded-2xl border transition ${
                  sub.isValid
                    ? 'bg-slate-900/80 border-emerald-500/30'
                    : 'bg-slate-900/80 border-rose-500/30'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-bold text-white truncate">
                      {sub.nickname}
                      {sub.playerId === currentPlayer?.id && (
                        <span className="ml-1 text-rose-400 text-[10px]">(You)</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {sub.isValid ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Valid
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-bold">
                        <XCircle className="w-3 h-3 text-rose-400" />
                        Invalid
                      </span>
                    )}
                    <span className="font-mono font-bold text-xs text-white">
                      +{sub.pointsEarned} pts
                    </span>
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="font-mono text-slate-200 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5 break-words">
                    &ldquo;{sub.answer || '(No submission)'}&rdquo;
                    {sub.canonicalAnswer && sub.canonicalAnswer.toLowerCase() !== (sub.answer || '').toLowerCase() && (
                      <span className="block text-[10px] text-slate-400 not-italic mt-0.5">
                        Recognized alias: <strong className="text-slate-300">{sub.canonicalAnswer}</strong>
                      </span>
                    )}
                  </div>
                  {sub.isValid ? (
                    <div className="text-[11px] text-emerald-400 font-semibold flex items-center justify-between">
                      <span>
                        {sub.duplicateCount === 1
                          ? '🌟 Unique (1 player)'
                          : `👥 Shared with ${sub.duplicateCount} players`}
                      </span>
                      <span className="font-mono text-slate-400 text-[10px]">
                        Math.round(100 / {sub.duplicateCount})
                      </span>
                    </div>
                  ) : null}
                  {sub.explanation && (
                    <p className="text-[11px] text-slate-400 italic pt-0.5 leading-snug">
                      {sub.explanation}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Scoring explainer notice */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-slate-400 space-y-1">
            <span className="font-bold text-slate-300 block">Scoring Breakdown:</span>
            <p>
              Scores are calculated solely based on answer uniqueness within this match:
              Valid unique answers award 100 points. Shared answers divide 100 points (50 each for 2 players, 33 each for 3). Blank or invalid answers score 0. No speed bonus. Normalized for casing, spacing, punctuation, and aliases without merging distinctly different answers.
            </p>
          </div>
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
                    rareAnswerCorrect: 0,
                    rareAnswerTotal: 0,
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
                      {res.submittedAnswerText && (
                        <span className="hidden md:inline-block text-[11px] text-slate-400 italic mr-2 truncate max-w-[150px]">
                          &ldquo;{res.submittedAnswerText}&rdquo;
                          {res.rarityCount !== undefined && res.isCorrect && (
                            <span className="ml-1 text-cyan-300 font-bold not-italic">
                              ({res.rarityCount === 1 ? 'Unique' : `${res.rarityCount} matched`})
                            </span>
                          )}
                        </span>
                      )}
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
