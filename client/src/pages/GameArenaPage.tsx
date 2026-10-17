import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, ArrowRight, HelpCircle, Calculator, Grid, Zap, CheckCircle2, ShieldAlert, Info, Sparkles, Gauge } from 'lucide-react';
import { useGame } from '../context/GameStateContext';
import { CountdownTimer } from '../components/common/CountdownTimer';
import { TriviaView } from '../components/arena/TriviaView';
import { MathView } from '../components/arena/MathView';
import { MemoryView } from '../components/arena/MemoryView';
import { ReactionView } from '../components/arena/ReactionView';
import { RareAnswerView } from '../components/arena/RareAnswerView';
import { GameMode, TriviaQuestionClient, MathQuestionClient, MemoryChallengeClient, ReactionChallengeClient, RareAnswerChallengeClient } from '@mind-clash/shared';
import { sounds } from '../audio/soundEffects';
import { useToast } from '../context/ToastContext';

export const GameArenaPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentRoom,
    currentPlayer,
    activeChallenge,
    submitTrivia,
    submitMath,
    submitMemory,
    submitReaction,
    submitRareAnswer,
    clockOffsetMs,
    isJudging,
  } = useGame();
  const { showToast } = useToast();

  const [activeTabMode, setActiveTabMode] = useState<GameMode>('trivia');
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  const [remainingMs, setRemainingMs] = useState<number>(15000);
  const [totalDurationMs, setTotalDurationMs] = useState<number>(15000);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(3);

  // Auto-navigate on state machine transitions
  useEffect(() => {
    if (currentRoom?.status === 'ROUND_RECAP') {
      navigate('/recap');
    } else if (currentRoom?.status === 'GAME_OVER') {
      navigate('/podium');
    }
  }, [currentRoom?.status, navigate]);

  // Reset submission state when a new round / challenge begins
  useEffect(() => {
    setHasSubmitted(false);
  }, [activeChallenge, currentRoom?.roundId]);

  // Synchronized Start Countdown Handler
  useEffect(() => {
    if (currentRoom?.status !== 'COUNTDOWN') return;

    sounds.playTick(600);
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const left = Math.max(1, 3 - Math.floor(elapsed / 1000));
      setCountdownSeconds(left);
      if (left > 0) {
        sounds.playTick(left === 1 ? 880 : 600);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentRoom?.status]);

  // Synchronized Round Timer Calculation (Server-Authoritative with Clock Offset)
  useEffect(() => {
    if (currentRoom?.roundEndTime && currentRoom?.roundStartTime) {
      const dur = Math.max(1000, currentRoom.roundEndTime - currentRoom.roundStartTime);
      setTotalDurationMs(dur);

      const interval = setInterval(() => {
        const estimatedServerNow = Date.now() + clockOffsetMs;
        const left = Math.max(0, currentRoom.roundEndTime! - estimatedServerNow);
        setRemainingMs(left);
        if (left <= 0) {
          clearInterval(interval);
        }
      }, 50);

      return () => clearInterval(interval);
    } else {
      // Fallback local simulation for direct page preview
      setTotalDurationMs(15000);
      setRemainingMs(15000);
      const interval = setInterval(() => {
        setRemainingMs((prev) => {
          if (prev <= 100) {
            clearInterval(interval);
            return 0;
          }
          return prev - 100;
        });
      }, 100);

      return () => clearInterval(interval);
    }
  }, [currentRoom?.roundEndTime, currentRoom?.roundStartTime, clockOffsetMs, activeChallenge]);

  // Sample mock challenges for isolated UI previews
  const triviaSample: TriviaQuestionClient = {
    id: 't-sample',
    category: 'Quantum Computing',
    question: 'What is the fundamental unit of quantum information called?',
    options: ['Quantum Bit (Qubit)', 'Quark Node', 'Photon Byte', 'Superposition Gate'],
    durationMs: 15000,
  };

  const mathSample: MathQuestionClient = {
    id: 'm-sample',
    prompt: '36 ÷ 4 + (7 × 3) = ?',
    options: [28, 30, 32, 26],
    durationMs: 15000,
  };

  const memorySample: MemoryChallengeClient = {
    id: 'mem-sample',
    symbols: [
      { id: 'star', label: 'Star', icon: '⭐', colorClass: 'text-amber-400 border-amber-400/50 bg-amber-500/10' },
      { id: 'diamond', label: 'Diamond', icon: '💎', colorClass: 'text-cyan-400 border-cyan-400/50 bg-cyan-500/10' },
      { id: 'flame', label: 'Flame', icon: '🔥', colorClass: 'text-rose-400 border-rose-400/50 bg-rose-500/10' },
      { id: 'bolt', label: 'Lightning', icon: '⚡', colorClass: 'text-yellow-400 border-yellow-400/50 bg-yellow-500/10' },
      { id: 'shield', label: 'Shield', icon: '🛡️', colorClass: 'text-emerald-400 border-emerald-400/50 bg-emerald-500/10' },
      { id: 'moon', label: 'Moon', icon: '🌙', colorClass: 'text-purple-400 border-purple-400/50 bg-purple-500/10' },
    ],
    sequence: ['star', 'bolt', 'shield', 'diamond'],
    viewingDurationMs: 3000,
    inputDurationMs: 7200,
    viewingEndTime: Date.now() + 3000,
  };

  const reactionSample: ReactionChallengeClient = {
    id: 'rx-sample',
    waitDelayMs: 2600,
    targetActivationTime: Date.now() + 2600,
    timeoutMs: 4000,
    networkNotice:
      'Online multiplayer reflex times depend on network transit latency (ping) between your device and the server. Reaction rankings are calibrated for competitive fun, not laboratory millisecond fairness.',
  };

  const rareAnswerSample: RareAnswerChallengeClient = {
    id: 'ra-sample',
    category: 'World Geography',
    prompt: 'Name a country in South America',
    sampleAcceptableHint: 'e.g. Suriname, Paraguay, Uruguay, Ecuador...',
    difficulty: 'medium',
    durationMs: 18000,
  };

  // Determine current active mode
  const effectiveMode: GameMode = activeChallenge?.mode || (currentRoom?.activeMode as GameMode) || activeTabMode;

  const handleTabChange = (mode: GameMode) => {
    sounds.playClick();
    setActiveTabMode(mode);
  };

  const handleTriviaAnswer = async (idx: number) => {
    setHasSubmitted(true);
    if (currentRoom) {
      const res = await submitTrivia(idx);
      if (!res.success) {
        showToast('Submission Rejected', res.error || 'Could not record answer', 'error');
      } else {
        showToast('Answer Locked In!', 'Waiting for other players or timer...', 'info');
      }
    } else {
      showToast('Answer Submitted!', 'Waiting for round time to expire...', 'info');
    }
  };

  const handleMathAnswer = async (ans: number) => {
    setHasSubmitted(true);
    if (currentRoom) {
      const res = await submitMath(ans);
      if (!res.success) {
        showToast('Submission Rejected', res.error || 'Could not record answer', 'error');
      } else {
        showToast('Calculated Answer Stamped!', 'Verifying on server...', 'info');
      }
    } else {
      showToast('Calculated Answer Stamped!', 'Verifying on server...', 'info');
    }
  };

  const handleMemorySubmit = async (sequenceOrTiles: string[] | number[]) => {
    setHasSubmitted(true);
    if (currentRoom) {
      const res = await submitMemory(sequenceOrTiles);
      if (!res.success) {
        showToast('Submission Rejected', res.error || 'Could not record sequence', 'error');
      } else {
        showToast('Sequence Locked!', `${sequenceOrTiles.length} items submitted`, 'info');
      }
    } else {
      showToast('Sequence Locked!', `${sequenceOrTiles.length} items submitted`, 'info');
    }
  };

  const handleReactionSubmit = async (elapsedMs?: number) => {
    setHasSubmitted(true);
    if (currentRoom) {
      const res = await submitReaction();
      if (!res.success) {
        showToast('Reflex Rejected', res.error || 'Invalid reaction click', 'error');
      } else {
        showToast('Reflex Recorded!', `${elapsedMs ?? ''} ms recorded`, 'success');
      }
    } else {
      showToast('Reflex Recorded!', `${elapsedMs ?? ''} ms recorded`, 'success');
    }
  };

  const handleRareAnswerSubmit = async (answer: string) => {
    if (currentRoom) {
      const res = await submitRareAnswer(answer);
      if (!res.success) {
        showToast('Submission Rejected', res.error || 'Could not record answer', 'error');
      } else {
        showToast('Answer Recorded!', 'Edits allowed until server deadline.', 'info');
      }
    } else {
      showToast('Answer Submitted!', 'Waiting for round time to expire...', 'info');
    }
  };

  const handleFinishRound = () => {
    sounds.playClick();
    showToast('Round Concluded!', 'Compiling real-time scores...', 'info');
    navigate('/recap');
  };

  const currentScore = currentPlayer ? currentPlayer.score : 1850;
  const currentStreak = currentPlayer ? currentPlayer.streak : 3;

  // Render Synchronized Start Countdown Overlay if Room is in COUNTDOWN state
  if (currentRoom?.status === 'COUNTDOWN') {
    return (
      <div className="min-h-[calc(100vh-4rem)] p-4 flex flex-col items-center justify-center">
        <div className="glass-panel p-10 sm:p-14 rounded-3xl max-w-lg w-full text-center space-y-6 border border-cyan-500/30 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-purple-500 to-cyan-400 animate-pulse" />
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold uppercase tracking-widest text-xs">
            Synchronizing Arena
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-wider">
            Match Starting In
          </h2>
          <div className="py-4">
            <span className="text-8xl sm:text-9xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 via-cyan-400 to-purple-500 animate-pulse">
              {countdownSeconds}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 font-medium">
            Get your fingers ready! Round 1 begins immediately.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 max-w-5xl mx-auto flex flex-col justify-between space-y-6">
      {/* Top Arena HUD Bar */}
      <div className="glass-panel p-4 sm:p-5 rounded-3xl flex items-center justify-between gap-4">
        {/* Left: Round & Mode Pill */}
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
              {currentRoom
                ? `ROUND ${currentRoom.currentRound} OF ${currentRoom.totalRounds}`
                : 'ROUND 1 OF 5 (PREVIEW)'}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/10 border border-white/10 text-cyan-300">
              <Gauge className="w-2.5 h-2.5 text-cyan-400" />
              {currentRoom?.settings?.difficulty || 'medium'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg font-black text-white capitalize">
              {effectiveMode === 'trivia' && 'Trivia Blitz'}
              {effectiveMode === 'math' && 'Speed Math'}
              {effectiveMode === 'memory' && 'Memory Matrix'}
              {effectiveMode === 'reaction' && 'Reaction Clash'}
              {effectiveMode === 'rare_answer' && 'Rare Answer'}
            </span>
          </div>
        </div>

        {/* Center: Authoritative Circular Countdown Timer */}
        <div className="shrink-0 flex flex-col items-center">
          <CountdownTimer
            durationMs={totalDurationMs}
            remainingMs={remainingMs}
            size={76}
            strokeWidth={6}
            playTicks={true}
          />
        </div>

        {/* Right: Live Authoritative Score & Streak */}
        <div className="text-right space-y-0.5">
          <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
            Current Score
          </span>
          <div className="flex items-center justify-end gap-2">
            {currentStreak > 1 && (
              <span className="flex items-center gap-0.5 text-xs font-black text-amber-400">
                <Flame className="w-3.5 h-3.5 fill-current" />
                {currentStreak}x
              </span>
            )}
            <span className="font-mono font-black text-lg sm:text-xl text-cyan-400">
              {currentScore.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Mode Selector Tabs (Visible only in demo mode when no active game room is driving the match) */}
      {!currentRoom && (
        <div className="flex items-center justify-center gap-1.5 p-1 rounded-2xl bg-white/5 border border-white/5 max-w-md mx-auto w-full text-xs font-bold">
          {[
            { mode: 'trivia', label: 'Trivia', icon: <HelpCircle className="w-3.5 h-3.5" /> },
            { mode: 'math', label: 'Math', icon: <Calculator className="w-3.5 h-3.5" /> },
            { mode: 'memory', label: 'Memory', icon: <Grid className="w-3.5 h-3.5" /> },
            { mode: 'reaction', label: 'Reaction', icon: <Zap className="w-3.5 h-3.5" /> },
            { mode: 'rare_answer', label: 'Rare Answer', icon: <Sparkles className="w-3.5 h-3.5" /> },
          ].map((item) => (
            <button
              key={item.mode}
              onClick={() => handleTabChange(item.mode as GameMode)}
              className={`flex-1 py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition ${
                activeTabMode === item.mode
                  ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {item.icon}
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Clear Rules and Scoring Information Before & During Each Mode */}
      <div className="px-4 py-2.5 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>
            {effectiveMode === 'trivia' && (
              <>
                <strong className="text-white">Trivia Rules:</strong> Select the correct answer before time runs out. Single scored attempt per player.
              </>
            )}
            {effectiveMode === 'math' && (
              <>
                <strong className="text-white">Math Rules:</strong> Solve the arithmetic equation. Faster correct answers earn a higher speed bonus.
              </>
            )}
            {effectiveMode === 'memory' && (
              <>
                <strong className="text-white">Memory Rules:</strong> Memorize the sequence during viewing. Once unlocked, tap all symbols in exact order.
              </>
            )}
            {effectiveMode === 'reaction' && (
              <>
                <strong className="text-white">Reaction Rules:</strong> Shared waiting screen. Tap or press SPACE immediately when STRIKE activates.
              </>
            )}
            {effectiveMode === 'rare_answer' && (
              <>
                <strong className="text-white">Rare Answer Rules:</strong> Type a valid private answer. Edits allowed until deadline. Scores are based on match uniqueness.
              </>
            )}
          </span>
        </div>
        <span className="font-mono text-cyan-300 text-[11px] font-bold shrink-0 bg-cyan-500/10 px-2.5 py-1 rounded-lg border border-cyan-500/20">
          {effectiveMode === 'trivia' && '100 Base + Up to 50 Speed Bonus'}
          {effectiveMode === 'math' && '100 Base + Up to 50 Speed Bonus'}
          {effectiveMode === 'memory' && '100 Base + Speed Bonus • 15 pts / partial'}
          {effectiveMode === 'reaction' && '100 Base + Reflex Bonus • Early Tap -200 pts'}
          {effectiveMode === 'rare_answer' && '100 ÷ Matching Players • No Speed Bonus'}
        </span>
      </div>

      {/* Active Arena Challenge Viewport */}
      <div className="py-2 flex-1 flex flex-col items-center justify-center">
        {effectiveMode === 'trivia' && (
          <TriviaView
            question={
              activeChallenge?.mode === 'trivia'
                ? activeChallenge.challenge
                : triviaSample
            }
            disabled={hasSubmitted}
            onAnswer={handleTriviaAnswer}
          />
        )}

        {effectiveMode === 'math' && (
          <MathView
            question={
              activeChallenge?.mode === 'math'
                ? activeChallenge.challenge
                : mathSample
            }
            disabled={hasSubmitted}
            onAnswer={handleMathAnswer}
          />
        )}

        {effectiveMode === 'memory' && (
          <MemoryView
            challenge={
              activeChallenge?.mode === 'memory'
                ? activeChallenge.challenge
                : memorySample
            }
            disabled={hasSubmitted}
            onSubmitSequence={(seq) => handleMemorySubmit(seq)}
            onSubmitTiles={(tiles) => handleMemorySubmit(tiles)}
          />
        )}

        {effectiveMode === 'reaction' && (
          <ReactionView
            challenge={
              activeChallenge?.mode === 'reaction'
                ? activeChallenge.challenge
                : reactionSample
            }
            disabled={hasSubmitted}
            onReact={(ms) => handleReactionSubmit(ms)}
            onFalseStart={() => {
              showToast('False Start Penalty!', 'Premature click recorded (-200 pts)', 'error');
              handleReactionSubmit();
            }}
          />
        )}

        {effectiveMode === 'rare_answer' && (
          <RareAnswerView
            challenge={
              activeChallenge?.mode === 'rare_answer'
                ? activeChallenge.challenge
                : rareAnswerSample
            }
            disabled={remainingMs <= 0 || isJudging}
            onAnswer={handleRareAnswerSubmit}
          />
        )}

        {/* Submission Confirmation Indicator (for single-submission modes) */}
        {hasSubmitted && effectiveMode !== 'rare_answer' && (
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold animate-pulse">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Answer Locked In • Waiting for server round conclusion</span>
          </div>
        )}
      </div>

      {/* Bottom Navigation Control (In live room, automated round conclusion occurs. In demo, allows manual progression) */}
      <div className="flex justify-between items-center pt-2">
        {currentRoom ? (
          <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
            Server Authoritative Round #{currentRoom.currentRound}
          </span>
        ) : (
          <span className="text-xs text-slate-500 font-mono">Demo Preview Mode</span>
        )}

        {!currentRoom && (
          <button
            onClick={handleFinishRound}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-600 hover:brightness-110 active:scale-98 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 transition"
          >
            <span>View Round Results</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
