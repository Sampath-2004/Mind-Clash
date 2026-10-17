import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, ArrowRight, HelpCircle, Calculator, Grid, Zap } from 'lucide-react';
import { useGame } from '../context/GameStateContext';
import { CountdownTimer } from '../components/common/CountdownTimer';
import { TriviaView } from '../components/arena/TriviaView';
import { MathView } from '../components/arena/MathView';
import { MemoryView } from '../components/arena/MemoryView';
import { ReactionView } from '../components/arena/ReactionView';
import { GameMode } from '@mind-clash/shared';
import { sounds } from '../audio/soundEffects';
import { useToast } from '../context/ToastContext';

export const GameArenaPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentRoom, currentPlayer } = useGame();
  const { showToast } = useToast();

  const [activeTabMode, setActiveTabMode] = useState<GameMode>('trivia');
  const [remainingMs, setRemainingMs] = useState<number>(12000);
  const totalDurationMs = 12000;

  // Countdown timer simulation
  useEffect(() => {
    setRemainingMs(totalDurationMs);
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
  }, [activeTabMode]);

  // Mock challenge data for all 4 modes
  const triviaSample = {
    id: 't-1',
    category: 'Quantum Computing',
    question: 'What is the fundamental unit of quantum information called?',
    options: ['Quantum Bit (Qubit)', 'Quark Node', 'Photon Byte', 'Superposition Gate'],
    durationMs: 12000,
  };

  const mathSample = {
    id: 'm-1',
    prompt: '36 ÷ 4 + (7 × 3) = ?',
    options: [28, 30, 32, 26],
    durationMs: 10000,
  };

  const memorySample = {
    id: 'mem-1',
    gridSize: 3,
    pattern: [0, 2, 4, 6, 8], // X pattern
    revealDurationMs: 2800,
    inputDurationMs: 7200,
  };

  const reactionSample = {
    id: 'rx-1',
    waitDelayMs: 2600,
    timeoutMs: 4000,
  };

  const handleTabChange = (mode: GameMode) => {
    sounds.playClick();
    setActiveTabMode(mode);
  };

  const handleFinishRound = () => {
    sounds.playClick();
    showToast('Round Concluded!', 'Compiling real-time scores...', 'info');
    navigate('/recap');
  };

  const currentScore = currentPlayer ? currentPlayer.score : 1850;
  const currentStreak = currentPlayer ? currentPlayer.streak : 3;

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 max-w-5xl mx-auto flex flex-col justify-between space-y-6">
      {/* Top Arena HUD Bar */}
      <div className="glass-panel p-4 sm:p-5 rounded-3xl flex items-center justify-between gap-4">
        {/* Left: Round & Mode Pill */}
        <div className="space-y-0.5">
          <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
            {currentRoom ? `ROUND ${currentRoom.currentRound} OF ${currentRoom.totalRounds}` : 'ROUND 2 OF 5'}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg font-black text-white capitalize">
              {activeTabMode === 'trivia' && 'Trivia Blitz'}
              {activeTabMode === 'math' && 'Speed Math'}
              {activeTabMode === 'memory' && 'Memory Matrix'}
              {activeTabMode === 'reaction' && 'Reaction Clash'}
            </span>
          </div>
        </div>

        {/* Center: Synchronized Circular Countdown Timer */}
        <div className="shrink-0">
          <CountdownTimer
            durationMs={totalDurationMs}
            remainingMs={remainingMs}
            size={76}
            strokeWidth={6}
            playTicks={true}
          />
        </div>

        {/* Right: Live Score & Streak */}
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

      {/* Mode Preview Tabs (allows testing all 4 modes instantly) */}
      <div className="flex items-center justify-center gap-1.5 p-1 rounded-2xl bg-white/5 border border-white/5 max-w-md mx-auto w-full text-xs font-bold">
        {[
          { mode: 'trivia', label: 'Trivia', icon: <HelpCircle className="w-3.5 h-3.5" /> },
          { mode: 'math', label: 'Math', icon: <Calculator className="w-3.5 h-3.5" /> },
          { mode: 'memory', label: 'Memory', icon: <Grid className="w-3.5 h-3.5" /> },
          { mode: 'reaction', label: 'Reaction', icon: <Zap className="w-3.5 h-3.5" /> },
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

      {/* Active Arena Challenge Viewport */}
      <div className="py-2 flex-1 flex items-center justify-center">
        {activeTabMode === 'trivia' && (
          <TriviaView
            question={triviaSample}
            onAnswer={(_idx) => {
              showToast('Answer Submitted!', 'Waiting for round time to expire...', 'info');
            }}
          />
        )}

        {activeTabMode === 'math' && (
          <MathView
            question={mathSample}
            onAnswer={(_ans) => {
              showToast('Calculated Answer Stamped!', 'Verifying on server...', 'info');
            }}
          />
        )}

        {activeTabMode === 'memory' && (
          <MemoryView
            challenge={memorySample}
            onSubmitTiles={(tiles) => {
              showToast('Pattern Locked!', `${tiles.length} tiles submitted`, 'info');
            }}
          />
        )}

        {activeTabMode === 'reaction' && (
          <ReactionView
            challenge={reactionSample}
            onReact={(ms) => {
              showToast('Reflex Recorded!', `${ms} ms millisecond precision`, 'success');
            }}
            onFalseStart={() => {
              showToast('False Start Penalty!', 'Premature click recorded (-200 pts)', 'error');
            }}
          />
        )}
      </div>

      {/* Bottom Navigation Control */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleFinishRound}
          className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-600 hover:brightness-110 active:scale-98 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 transition"
        >
          <span>View Round Results</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
