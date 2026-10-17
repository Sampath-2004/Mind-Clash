import React from 'react';
import { Check, X } from 'lucide-react';
import { sounds } from '../../audio/soundEffects';

export type AnswerState = 'default' | 'selected' | 'correct' | 'wrong' | 'dimmed';

interface AnswerButtonProps {
  hotkey?: string;
  label: string | number;
  state?: AnswerState;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}

export const AnswerButton: React.FC<AnswerButtonProps> = ({
  hotkey,
  label,
  state = 'default',
  disabled = false,
  onClick,
  className = '',
}) => {
  const handleClick = () => {
    if (disabled) return;
    sounds.playClick();
    onClick();
  };

  const stateStyles: Record<AnswerState, string> = {
    default:
      'bg-slate-900/60 hover:bg-slate-800/80 border-white/10 hover:border-cyan-500/50 text-slate-100 hover:shadow-lg hover:shadow-cyan-500/10 active:scale-[0.98]',
    selected:
      'bg-cyan-950/80 border-cyan-400 text-cyan-200 ring-2 ring-cyan-400/50 shadow-lg shadow-cyan-500/20 scale-[0.99]',
    correct:
      'bg-emerald-950/90 border-emerald-400 text-emerald-200 ring-2 ring-emerald-400/50 shadow-lg shadow-emerald-500/30',
    wrong:
      'bg-rose-950/90 border-rose-400 text-rose-200 ring-2 ring-rose-400/50 shadow-lg shadow-rose-500/30 animate-shake motion-reduce:animate-none',
    dimmed:
      'bg-slate-950/40 border-white/5 text-slate-500 opacity-50 cursor-not-allowed',
  };

  const hotkeyStyles: Record<AnswerState, string> = {
    default: 'bg-white/10 text-slate-300 border-white/10',
    selected: 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold',
    correct: 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold',
    wrong: 'bg-rose-500 text-slate-950 border-rose-400 font-bold',
    dimmed: 'bg-white/5 text-slate-600 border-transparent',
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || state === 'dimmed'}
      className={`group relative flex items-center gap-3.5 w-full p-4 sm:p-5 rounded-2xl border backdrop-blur-md transition-all duration-200 text-left font-medium text-base sm:text-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
        stateStyles[state]
      } ${className}`}
    >
      {/* Hotkey identifier badge */}
      {hotkey && (
        <span
          className={`flex items-center justify-center w-8 h-8 rounded-xl border text-xs sm:text-sm font-mono font-bold transition-colors shrink-0 ${
            hotkeyStyles[state]
          }`}
        >
          {hotkey}
        </span>
      )}

      {/* Answer text */}
      <span className="flex-1 break-words font-semibold text-sm sm:text-base">
        {label}
      </span>

      {/* State icon indicator */}
      {state === 'correct' && (
        <span className="p-1 rounded-full bg-emerald-500/20 text-emerald-300">
          <Check className="w-5 h-5" />
        </span>
      )}
      {state === 'wrong' && (
        <span className="p-1 rounded-full bg-rose-500/20 text-rose-300">
          <X className="w-5 h-5" />
        </span>
      )}
    </button>
  );
};
