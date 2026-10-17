import React, { useState, useEffect, useRef } from 'react';
import { Zap, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { ReactionChallengeClient } from '@mind-clash/shared';
import { sounds } from '../../audio/soundEffects';

interface ReactionViewProps {
  challenge: ReactionChallengeClient;
  onReact?: (reactionMs: number) => void;
  onFalseStart?: () => void;
  disabled?: boolean;
}

export const ReactionView: React.FC<ReactionViewProps> = ({
  challenge,
  onReact,
  onFalseStart,
  disabled = false,
}) => {
  const [state, setState] = useState<'waiting' | 'ready' | 'clicked' | 'false_start'>('waiting');
  const [reactionMs, setReactionMs] = useState<number | null>(null);
  const triggerTimeRef = useRef<number | null>(null);

  useEffect(() => {
    setState('waiting');
    setReactionMs(null);
    triggerTimeRef.current = null;

    const delay = challenge.waitDelayMs || 3000;
    const timer = setTimeout(() => {
      triggerTimeRef.current = Date.now();
      setState('ready');
      sounds.playReactionTrigger();
    }, delay);

    return () => clearTimeout(timer);
  }, [challenge]);

  const handlePadClick = () => {
    if (disabled || state === 'clicked' || state === 'false_start') return;

    if (state === 'waiting') {
      // Early click / Jump the gun!
      setState('false_start');
      sounds.playError();
      if (onFalseStart) onFalseStart();
      return;
    }

    if (state === 'ready' && triggerTimeRef.current) {
      const elapsed = Date.now() - triggerTimeRef.current;
      setReactionMs(elapsed);
      setState('clicked');
      sounds.playSuccess();
      if (onReact) onReact(elapsed);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Header Info */}
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 uppercase tracking-wider">
          <Zap className="w-3.5 h-3.5" />
          Reaction Clash
        </span>
        <span className="text-slate-400">Pure reflex battle</span>
      </div>

      {/* Massive Interactive Reflex Trigger Pad */}
      <button
        type="button"
        onClick={handlePadClick}
        disabled={disabled}
        aria-label="Reaction pad"
        className={`w-full aspect-[4/3] sm:aspect-[16/9] rounded-3xl p-8 flex flex-col items-center justify-center text-center transition-all duration-150 select-none border shadow-2xl focus:outline-none focus-visible:ring-4 ${
          state === 'waiting'
            ? 'bg-rose-950/40 border-rose-500/30 text-rose-200 cursor-pointer active:scale-98'
            : state === 'ready'
            ? 'bg-emerald-500 border-emerald-300 text-slate-950 shadow-emerald-500/60 scale-102 cursor-pointer animate-pulse motion-reduce:animate-none'
            : state === 'false_start'
            ? 'bg-rose-900 border-rose-500 text-white animate-shake motion-reduce:animate-none'
            : 'bg-cyan-950/60 border-cyan-400 text-cyan-200'
        }`}
      >
        {state === 'waiting' && (
          <div className="space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center animate-pulse motion-reduce:animate-none">
              <Clock className="w-10 h-10 text-rose-400" />
            </div>
            <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-wider">
              Wait For Green...
            </h2>
            <p className="text-xs sm:text-sm text-rose-300/80 font-medium max-w-xs mx-auto">
              Do NOT click early or you will receive a false-start penalty!
            </p>
          </div>
        )}

        {state === 'ready' && (
          <div className="space-y-3">
            <Zap className="w-20 h-20 mx-auto fill-current animate-bounce motion-reduce:animate-none" />
            <h2 className="text-4xl sm:text-6xl font-black uppercase tracking-tight">
              TAP NOW!
            </h2>
            <p className="text-sm font-bold uppercase tracking-widest text-slate-900">
              Strike Fast!
            </p>
          </div>
        )}

        {state === 'false_start' && (
          <div className="space-y-3">
            <AlertTriangle className="w-16 h-16 mx-auto text-rose-300" />
            <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-wider text-white">
              False Start!
            </h2>
            <p className="text-sm text-rose-200 font-semibold">
              You clicked before the green signal. -200 pts penalty.
            </p>
          </div>
        )}

        {state === 'clicked' && reactionMs !== null && (
          <div className="space-y-2">
            <CheckCircle2 className="w-14 h-14 mx-auto text-cyan-400" />
            <span className="text-xs uppercase tracking-widest text-cyan-300 font-bold block">
              Reflex Measured
            </span>
            <h2 className="text-5xl sm:text-6xl font-mono font-black text-white">
              {reactionMs} <span className="text-2xl text-cyan-400">ms</span>
            </h2>
            <p className="text-xs text-slate-400 font-medium">
              {reactionMs < 200
                ? '⚡ Godlike Superhuman Reflexes!'
                : reactionMs < 280
                ? '🔥 Lightning Speed!'
                : reactionMs < 380
                ? '👍 Solid Reaction!'
                : '🐢 A bit sluggish!'}
            </p>
          </div>
        )}
      </button>
    </div>
  );
};
