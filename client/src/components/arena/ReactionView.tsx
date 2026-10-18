import React, { useState, useEffect, useRef } from 'react';
import { Zap, AlertTriangle, CheckCircle2, Clock, Info, ShieldAlert } from 'lucide-react';
import { ReactionChallengeClient } from '@mind-clash/shared';
import { sounds } from '../../audio/soundEffects';
import { useGame } from '../../context/GameStateContext';

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
  const { clockOffsetMs } = useGame();
  const [state, setState] = useState<'waiting' | 'ready' | 'clicked' | 'false_start'>('waiting');
  const [reactionMs, setReactionMs] = useState<number | null>(null);
  const [isDistractorActive, setIsDistractorActive] = useState<boolean>(false);
  const activationTimeRef = useRef<number | null>(null);

  // Synchronized target activation using server-provided timestamp and clock offset
  useEffect(() => {
    setState('waiting');
    setReactionMs(null);
    setIsDistractorActive(false);

    const serverTargetTime =
      challenge.targetActivationTime ||
      Date.now() + (challenge.waitDelayMs || 3000);

    activationTimeRef.current = serverTargetTime;

    const estimatedNow = Date.now() + clockOffsetMs;
    const delay = Math.max(0, serverTargetTime - estimatedNow);

    let distractorTimer: ReturnType<typeof setTimeout> | undefined;
    let distractorEndTimer: ReturnType<typeof setTimeout> | undefined;

    // Optional impulse distractor cue scheduled before target activation
    if (challenge.hasDistractor && challenge.distractorDelayMs && challenge.distractorDelayMs < delay) {
      distractorTimer = setTimeout(() => {
        setIsDistractorActive(true);
        sounds.playTick(500);
        distractorEndTimer = setTimeout(() => {
          setIsDistractorActive(false);
        }, 550);
      }, challenge.distractorDelayMs);
    }

    const timer = setTimeout(() => {
      setIsDistractorActive(false);
      setState('ready');
      sounds.playReactionTrigger();
    }, delay);

    return () => {
      clearTimeout(timer);
      if (distractorTimer) clearTimeout(distractorTimer);
      if (distractorEndTimer) clearTimeout(distractorEndTimer);
    };
  }, [challenge.id, challenge.targetActivationTime, challenge.waitDelayMs, challenge.hasDistractor, challenge.distractorDelayMs, clockOffsetMs]);

  const handleStrike = () => {
    if (disabled || state === 'clicked' || state === 'false_start') return;

    const estimatedNow = Date.now() + clockOffsetMs;
    const targetTime = activationTimeRef.current || 0;

    if (state === 'waiting' || estimatedNow < targetTime) {
      // Early click / Jump the gun!
      setState('false_start');
      sounds.playError();
      if (onFalseStart) onFalseStart();
      return;
    }

    if (state === 'ready' && activationTimeRef.current) {
      const elapsed = Math.max(15, estimatedNow - activationTimeRef.current);
      setReactionMs(elapsed);
      setState('clicked');
      sounds.playSuccess();
      if (onReact) onReact(elapsed);
    }
  };

  // Keyboard Spacebar / Enter shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        handleStrike();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4 animate-fade-in motion-reduce:animate-none">
      {/* Header Info & Defined Round Phase */}
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 uppercase tracking-wider font-bold">
          <Zap className="w-3.5 h-3.5" />
          Reaction Rush • Reflex Clash
        </span>
        <span className="text-slate-400 hidden sm:inline text-xs">
          Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-amber-300 font-mono text-[10px]">SPACE</kbd> or tap screen
        </span>
      </div>

      {/* Massive Interactive Reflex Trigger Pad with Rich Textual & Visual Cues */}
      <button
        type="button"
        onClick={handleStrike}
        disabled={disabled}
        aria-label="Reaction trigger pad"
        className={`w-full aspect-[4/3] sm:aspect-[16/9] rounded-3xl p-8 flex flex-col items-center justify-center text-center transition-all duration-100 select-none border-4 shadow-2xl focus:outline-none focus-visible:ring-4 ${
          state === 'waiting'
            ? isDistractorActive
              ? 'bg-amber-950/60 border-solid border-amber-400 text-amber-200 cursor-pointer animate-pulse'
              : 'bg-rose-950/40 border-dashed border-rose-500/50 text-rose-200 cursor-pointer active:scale-98'
            : state === 'ready'
            ? 'bg-emerald-500 border-solid border-emerald-300 text-slate-950 shadow-emerald-500/60 scale-102 cursor-pointer animate-pulse motion-reduce:animate-none'
            : state === 'false_start'
            ? 'bg-rose-900 border-solid border-rose-500 text-white animate-shake motion-reduce:animate-none'
            : 'bg-cyan-950/70 border-solid border-cyan-400 text-cyan-200'
        }`}
      >
        {state === 'waiting' && (
          <div className="space-y-4 max-w-sm mx-auto">
            <div className={`w-20 h-20 mx-auto rounded-full border-2 flex items-center justify-center animate-pulse motion-reduce:animate-none ${
              isDistractorActive
                ? 'bg-amber-500/30 border-amber-400 text-amber-300'
                : 'bg-rose-500/20 border-rose-500/40 text-rose-400'
            }`}>
              {isDistractorActive ? (
                <ShieldAlert className="w-10 h-10 text-amber-400" />
              ) : (
                <Clock className="w-10 h-10 text-rose-400" />
              )}
            </div>
            <div className="space-y-1">
              <span className={`text-[11px] font-mono font-bold uppercase tracking-widest block ${
                isDistractorActive ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {isDistractorActive ? '[HOLD YOUR HORSES!]' : '[SHARED WAITING SCREEN]'}
              </span>
              <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-wider text-white">
                {isDistractorActive ? 'STEADY... NOT YET!' : 'WAIT FOR SIGNAL'}
              </h2>
            </div>
            <div className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 ${
              isDistractorActive
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
            }`}>
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>DO NOT TAP EARLY (-200 pts false start penalty)</span>
            </div>
          </div>
        )}

        {state === 'ready' && (
          <div className="space-y-3">
            <Zap className="w-20 h-20 mx-auto fill-current animate-bounce motion-reduce:animate-none text-slate-950" />
            <h2 className="text-4xl sm:text-7xl font-black uppercase tracking-tight text-slate-950">
              STRIKE NOW!
            </h2>
            <p className="text-base sm:text-lg font-black uppercase tracking-widest text-slate-900">
              [TAP OR PRESS SPACE]
            </p>
          </div>
        )}

        {state === 'false_start' && (
          <div className="space-y-3 max-w-sm mx-auto">
            <AlertTriangle className="w-16 h-16 mx-auto text-rose-300" />
            <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-wider text-white">
              FALSE START!
            </h2>
            <p className="text-xs sm:text-sm text-rose-200 font-semibold">
              Premature tap recorded before target activation. -200 pts penalty applied.
            </p>
          </div>
        )}

        {state === 'clicked' && reactionMs !== null && (
          <div className="space-y-2">
            <CheckCircle2 className="w-14 h-14 mx-auto text-cyan-400" />
            <span className="text-xs uppercase tracking-widest text-cyan-300 font-bold block">
              Reflex Measured Authoritatively
            </span>
            <h2 className="text-5xl sm:text-6xl font-mono font-black text-white">
              {reactionMs} <span className="text-2xl text-cyan-400">ms</span>
            </h2>
            <p className="text-xs font-bold text-cyan-300">
              {reactionMs < 250
                ? '⚡ Superhuman Reflexes!'
                : reactionMs < 380
                ? '🔥 Lightning Speed!'
                : reactionMs < 500
                ? '👍 Solid Reflex!'
                : '🐢 Steady Reaction!'}
            </p>
          </div>
        )}
      </button>

      {/* Network Latency Disclosure Notice */}
      <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-white/10 text-xs text-slate-400 flex items-start gap-2.5 backdrop-blur-md">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold text-slate-300 uppercase text-[10px] tracking-wider block">
            Network Latency Notice
          </span>
          <p className="leading-relaxed">
            Online multiplayer reflex times depend on network transit latency (ping) between your device and the server. Reaction rankings are calibrated for competitive fun, not laboratory millisecond fairness.
          </p>
        </div>
      </div>
    </div>
  );
};
