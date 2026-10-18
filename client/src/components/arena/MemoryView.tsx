import React, { useState, useEffect, useRef } from 'react';
import { Eye, CheckCircle2, RotateCcw, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { MemoryChallengeClient, MemorySymbol } from '@mind-clash/shared';
import { sounds } from '../../audio/soundEffects';
import { useGame } from '../../context/GameStateContext';

const DEFAULT_SYMBOLS: MemorySymbol[] = [
  { id: 'star', label: 'Star', icon: '⭐', colorClass: 'text-amber-400 border-amber-400/50 bg-amber-500/10' },
  { id: 'diamond', label: 'Diamond', icon: '💎', colorClass: 'text-cyan-400 border-cyan-400/50 bg-cyan-500/10' },
  { id: 'flame', label: 'Flame', icon: '🔥', colorClass: 'text-rose-400 border-rose-400/50 bg-rose-500/10' },
  { id: 'bolt', label: 'Lightning', icon: '⚡', colorClass: 'text-yellow-400 border-yellow-400/50 bg-yellow-500/10' },
  { id: 'shield', label: 'Shield', icon: '🛡️', colorClass: 'text-emerald-400 border-emerald-400/50 bg-emerald-500/10' },
  { id: 'moon', label: 'Moon', icon: '🌙', colorClass: 'text-purple-400 border-purple-400/50 bg-purple-500/10' },
];

interface MemoryViewProps {
  challenge: MemoryChallengeClient;
  revealSolution?: string[] | null;
  onSubmitSequence?: (sequence: string[]) => void;
  onSubmitTiles?: (indices: number[]) => void;
  disabled?: boolean;
}

export const MemoryView: React.FC<MemoryViewProps> = ({
  challenge,
  revealSolution = null,
  onSubmitSequence,
  onSubmitTiles,
  disabled = false,
}) => {
  const { clockOffsetMs } = useGame();

  // Explicit server-controlled phases: 'memorize' vs 'recall'
  // If reconnecting during Recall, start directly in 'recall' to prevent restarting preview
  const isInitialRecall = challenge.phase === 'recall';
  const [phase, setPhase] = useState<'memorize' | 'recall'>(isInitialRecall ? 'recall' : 'memorize');
  const [userSequence, setUserSequence] = useState<string[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [viewingSecondsLeft, setViewingSecondsLeft] = useState<number>(() => {
    const dur = challenge.viewingDurationMs || challenge.revealDurationMs || 3000;
    return Math.max(1, Math.ceil(dur / 1000));
  });

  // Cached reference to the sequence received during Memorize
  const memorizedSeqRef = useRef<string[]>(challenge.sequence || []);
  if (challenge.sequence && challenge.sequence.length > 0) {
    memorizedSeqRef.current = challenge.sequence;
  }

  const symbols = challenge.symbols && challenge.symbols.length > 0 ? challenge.symbols : DEFAULT_SYMBOLS;
  const targetLength =
    challenge.sequenceLength ||
    challenge.sequence?.length ||
    memorizedSeqRef.current.length ||
    5;

  // Server-synchronized viewing period timer
  useEffect(() => {
    // If challenge is explicitly in recall phase, enter recall and do NOT restart preview
    if (challenge.phase === 'recall') {
      setPhase('recall');
      return;
    }

    // Entering Memorize phase
    setPhase('memorize');
    setUserSequence([]);
    setIsLocked(false);

    const viewingDuration = challenge.viewingDurationMs || challenge.revealDurationMs || 3000;
    const endTime = challenge.viewingEndTime || (Date.now() + clockOffsetMs + viewingDuration);

    const updateViewingCountdown = () => {
      const estimatedNow = Date.now() + clockOffsetMs;
      const remainingMs = Math.max(0, endTime - estimatedNow);
      const secs = Math.max(1, Math.ceil(remainingMs / 1000));
      setViewingSecondsLeft(secs);

      // Transition to recall when server confirms phase or viewing time has completed
      if (remainingMs <= 0 || challenge.phase === 'recall') {
        setPhase('recall');
        sounds.playTick(700);
      }
    };

    updateViewingCountdown();
    const interval = setInterval(updateViewingCountdown, 100);

    return () => clearInterval(interval);
  }, [challenge.id, challenge.phase, challenge.viewingEndTime, challenge.viewingDurationMs, challenge.revealDurationMs, clockOffsetMs]);

  // Handle symbol selection during recall phase
  const handleSelectSymbol = (symbolId: string) => {
    if (phase !== 'recall' || disabled || isLocked) return;
    if (userSequence.length >= targetLength) return;

    sounds.playClick();
    setUserSequence((prev) => [...prev, symbolId]);
  };

  // Remove the last selected symbol (undo)
  const handleUndo = () => {
    if (phase !== 'recall' || disabled || isLocked || userSequence.length === 0) return;
    sounds.playClick();
    setUserSequence((prev) => prev.slice(0, -1));
  };

  // Clear all selections
  const handleClear = () => {
    if (phase !== 'recall' || disabled || isLocked || userSequence.length === 0) return;
    sounds.playClick();
    setUserSequence([]);
  };

  // Lock in / Submit sequence
  const handleLockIn = () => {
    if (isLocked || disabled || phase !== 'recall' || userSequence.length === 0) return;
    setIsLocked(true);
    sounds.playSuccess();

    if (onSubmitSequence) {
      onSubmitSequence(userSequence);
    } else if (onSubmitTiles) {
      // Map symbol IDs to index numbers for legacy callback
      const indices = userSequence.map((id) => symbols.findIndex((s) => s.id === id)).filter((i) => i >= 0);
      onSubmitTiles(indices);
    }
  };

  // Keyboard shortcut support (1-6 for symbol choices, Backspace for undo, Enter to lock in)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (phase !== 'recall' || disabled || isLocked) return;

      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= symbols.length) {
        handleSelectSymbol(symbols[num - 1].id);
      } else if (e.key === 'Backspace') {
        handleUndo();
      } else if (e.key === 'Enter' && userSequence.length === targetLength) {
        handleLockIn();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, disabled, isLocked, symbols, userSequence, targetLength]);

  const getSymbol = (id: string) => symbols.find((s) => s.id === id) || { id, label: id, icon: '❓', colorClass: '' };

  const displaySequence =
    challenge.sequence && challenge.sequence.length > 0
      ? challenge.sequence
      : memorizedSeqRef.current.length > 0
      ? memorizedSeqRef.current
      : ['star', 'bolt', 'shield', 'diamond', 'moon'];

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 animate-fade-in motion-reduce:animate-none">
      {/* Header Info & Accessible Text Cue */}
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 uppercase tracking-wider font-bold">
          <ShieldCheck className="w-3.5 h-3.5" />
          Memory Match • Sequence Order
        </span>
        <span
          className={`font-bold uppercase tracking-wider flex items-center gap-1.5 px-3 py-1 rounded-full text-xs ${
            phase === 'memorize'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
              : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
          }`}
        >
          {phase === 'memorize' ? (
            <>
              <Eye className="w-3.5 h-3.5" /> Memorize Sequence ({viewingSecondsLeft}s)
            </>
          ) : (
            <>Repeat {targetLength} Symbols in Order</>
          )}
        </span>
      </div>

      {/* Main Sequence Showcase Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-white/10 shadow-2xl space-y-5 relative overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-cyan-400 to-purple-500" />

        {/* Phase Instructions */}
        <div className="text-center space-y-1">
          <h2 className="text-lg sm:text-xl font-black text-white">
            {phase === 'memorize' ? 'Memorize this sequence' : 'Repeat the sequence in order.'}
          </h2>
          <p className="text-xs text-slate-400">
            {phase === 'memorize'
              ? 'All players view the same sequence. Input unlocks simultaneously.'
              : 'Reproduce the sequence from memory. Both symbol and order count!'}
          </p>
        </div>

        {/* Sequence Display Area */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 py-4 min-h-[100px]">
          {phase === 'memorize' ? (
            // MEMORIZE PHASE: Show target sequence with numbers, icons, and text labels
            displaySequence.map((symbolId, idx) => {
              const sym = getSymbol(symbolId);
              return (
                <div
                  key={idx}
                  className="flex flex-col items-center justify-center w-16 sm:w-20 h-20 sm:h-24 rounded-2xl bg-slate-800/80 border-2 border-cyan-400/60 p-2 shadow-lg animate-pop motion-reduce:animate-none space-y-1"
                >
                  <span className="text-[10px] font-mono font-bold text-slate-400">#{idx + 1}</span>
                  <span className="text-2xl sm:text-3xl">{sym.icon}</span>
                  <span className="text-[11px] font-bold text-white truncate max-w-full">{sym.label}</span>
                </div>
              );
            })
          ) : (
            // RECALL PHASE: Show user filled slots
            Array.from({ length: targetLength }).map((_, idx) => {
              const symbolId = userSequence[idx];
              const sym = symbolId ? getSymbol(symbolId) : null;

              return (
                <div
                  key={idx}
                  className={`flex flex-col items-center justify-center w-16 sm:w-20 h-20 sm:h-24 rounded-2xl border-2 transition-all p-2 ${
                    sym
                      ? 'bg-purple-950/50 border-purple-400 text-white shadow-md shadow-purple-500/20'
                      : 'bg-slate-950/60 border-dashed border-white/20 text-slate-500'
                  }`}
                >
                  <span className="text-[10px] font-mono font-bold text-slate-400">#{idx + 1}</span>
                  {sym ? (
                    <>
                      <span className="text-2xl sm:text-3xl animate-pop motion-reduce:animate-none">{sym.icon}</span>
                      <span className="text-[11px] font-bold text-white truncate max-w-full">{sym.label}</span>
                    </>
                  ) : (
                    <span className="text-xs font-mono font-bold text-slate-600 mt-2">Empty</span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Phase State & Sequence Controls */}
        {phase === 'memorize' ? (
          <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 font-medium">
            <Lock className="w-4 h-4 text-amber-400" />
            <span>Input disabled during server viewing phase ({viewingSecondsLeft}s remaining)</span>
          </div>
        ) : (
          <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-slate-400">
            <span>
              Progress: <strong className="text-cyan-300 font-mono">{userSequence.length}</strong> / {targetLength}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleUndo}
                disabled={userSequence.length === 0 || isLocked || disabled}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold disabled:opacity-40 transition"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={userSequence.length === 0 || isLocked || disabled}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold disabled:opacity-40 transition inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear</span>
              </button>
            </div>
          </div>
        )}

        {revealSolution && (
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Solution: {revealSolution.join(' → ')}</span>
          </div>
        )}
      </div>

      {/* Symbol Selection Palette (6 Accessible Buttons with Text + Icon) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
          <span>Choose Symbols:</span>
          <span className="hidden sm:inline">Use keyboard keys 1–6</span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 sm:gap-3">
          {symbols.map((sym, idx) => {
            const isFull = userSequence.length >= targetLength;
            return (
              <button
                key={sym.id}
                type="button"
                onClick={() => handleSelectSymbol(sym.id)}
                disabled={phase !== 'recall' || disabled || isLocked || isFull}
                className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 active:scale-95 ${
                  phase === 'recall' && !isLocked && !disabled && !isFull
                    ? 'bg-slate-900/80 border-white/15 hover:border-cyan-400 hover:bg-slate-800 text-white cursor-pointer shadow-lg'
                    : 'bg-slate-950/40 border-white/5 text-slate-600 cursor-not-allowed opacity-50'
                }`}
              >
                <span className="text-2xl sm:text-3xl">{sym.icon}</span>
                <span className="text-xs font-bold text-white tracking-wide">{sym.label}</span>
                <span className="text-[10px] font-mono font-bold text-slate-500">[{idx + 1}]</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Submission Button */}
      {phase === 'recall' && (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleLockIn}
            disabled={isLocked || disabled || userSequence.length === 0}
            className={`inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition shadow-lg ${
              isLocked
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                : userSequence.length === targetLength
                ? 'bg-gradient-to-r from-cyan-500 via-purple-600 to-cyan-500 hover:brightness-110 active:scale-98 text-white shadow-cyan-500/25'
                : 'bg-white/10 text-slate-300 hover:bg-white/15'
            }`}
          >
            {isLocked ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Sequence Locked In</span>
              </>
            ) : (
              <>
                <span>Lock In Sequence ({userSequence.length}/{targetLength})</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
