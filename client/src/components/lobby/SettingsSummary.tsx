import React from 'react';
import { Layers, Zap, Calculator, Grid, HelpCircle, Check, Settings, Sparkles, Gauge } from 'lucide-react';
import { RoomSettings, GameMode, Difficulty } from '@mind-clash/shared';
import { sounds } from '../../audio/soundEffects';

interface SettingsSummaryProps {
  settings: RoomSettings;
  isHost?: boolean;
  onUpdateSettings?: (settings: Partial<RoomSettings>) => void;
}

const ALL_MODES: { mode: GameMode; label: string; icon: React.ReactNode; color: string }[] = [
  {
    mode: 'trivia',
    label: 'Trivia',
    icon: <HelpCircle className="w-3.5 h-3.5" />,
    color: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
  },
  {
    mode: 'math',
    label: 'Math',
    icon: <Calculator className="w-3.5 h-3.5" />,
    color: 'bg-purple-500/10 border-purple-500/30 text-purple-300',
  },
  {
    mode: 'memory',
    label: 'Memory',
    icon: <Grid className="w-3.5 h-3.5" />,
    color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  },
  {
    mode: 'reaction',
    label: 'Reaction',
    icon: <Zap className="w-3.5 h-3.5" />,
    color: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  },
  {
    mode: 'rare_answer',
    label: 'Rare Answer',
    icon: <Sparkles className="w-3.5 h-3.5" />,
    color: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
  },
];

const DIFFICULTY_OPTIONS: { id: Difficulty; label: string; description: string; color: string }[] = [
  { id: 'easy', label: 'Easy', description: 'Direct & forgiving', color: 'bg-emerald-500/20 border-emerald-400 text-emerald-300' },
  { id: 'medium', label: 'Medium', description: 'Balanced challenge', color: 'bg-cyan-500/20 border-cyan-400 text-cyan-300' },
  { id: 'hard', label: 'Hard', description: 'Intense & precise', color: 'bg-rose-500/20 border-rose-400 text-rose-300' },
];

const ROUND_OPTIONS = [5, 10, 15];

export const SettingsSummary: React.FC<SettingsSummaryProps> = ({
  settings,
  isHost = false,
  onUpdateSettings,
}) => {
  const handleRoundChange = (count: number) => {
    if (!isHost || !onUpdateSettings || count === settings.roundCount) return;
    sounds.playClick();
    onUpdateSettings({ roundCount: count });
  };

  const handleDifficultyChange = (difficulty: Difficulty) => {
    if (!isHost || !onUpdateSettings || difficulty === settings.difficulty) return;
    sounds.playClick();
    onUpdateSettings({ difficulty });
  };

  const handleToggleMode = (mode: GameMode) => {
    if (!isHost || !onUpdateSettings) return;

    const isSelected = settings.selectedModes.includes(mode);
    if (isSelected && settings.selectedModes.length <= 1) {
      // Must keep at least one game mode selected
      sounds.playError();
      return;
    }

    sounds.playClick();
    const newModes = isSelected
      ? settings.selectedModes.filter((m) => m !== mode)
      : [...settings.selectedModes, mode];

    onUpdateSettings({ selectedModes: newModes });
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4 text-left">
      {/* Header with Host Badge */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-300 font-bold flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
          <Settings className="w-3.5 h-3.5 text-cyan-400" /> Match Configuration
        </span>
        <span className="text-[10px] font-mono text-slate-400">
          {isHost ? '👑 Host Controls' : 'Configured by Host'}
        </span>
      </div>

      {/* Difficulty Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
          <span className="flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" /> Difficulty Tier:
          </span>
          <span className="font-mono text-cyan-300 font-bold capitalize">
            {settings.difficulty || 'medium'}
          </span>
        </div>

        {isHost ? (
          <div className="grid grid-cols-3 gap-2">
            {DIFFICULTY_OPTIONS.map((opt) => {
              const isCurrent = (settings.difficulty || 'medium') === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleDifficultyChange(opt.id)}
                  className={`py-2 px-2 sm:px-3 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-0.5 active:scale-95 ${
                    isCurrent
                      ? `${opt.color} shadow-lg ring-1 ring-current/40`
                      : 'bg-slate-900/60 border-white/10 hover:border-white/20 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {isCurrent && <Check className="w-3 h-3 text-current" />}
                    <span>{opt.label}</span>
                  </div>
                  <span className="text-[9px] opacity-70 font-normal hidden sm:inline">{opt.description}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="inline-block px-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs font-bold text-white capitalize font-mono">
            {settings.difficulty || 'medium'}
          </div>
        )}
      </div>

      {/* Game Length Selection (5, 10, or 15 Rounds) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" /> Match Length:
          </span>
          <span className="font-mono text-cyan-300 font-bold">{settings.roundCount} Rounds</span>
        </div>

        {isHost ? (
          <div className="grid grid-cols-3 gap-2">
            {ROUND_OPTIONS.map((count) => {
              const isCurrent = settings.roundCount === count;
              return (
                <button
                  key={count}
                  type="button"
                  onClick={() => handleRoundChange(count)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 ${
                    isCurrent
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-500/10'
                      : 'bg-slate-900/60 border-white/10 hover:border-white/20 text-slate-400 hover:text-white'
                  }`}
                >
                  {isCurrent && <Check className="w-3 h-3 text-cyan-400" />}
                  <span>{count} Rounds</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="inline-block px-3 py-1 rounded-xl bg-slate-900/80 border border-white/10 text-xs font-bold text-white font-mono">
            {settings.roundCount} Rounds Total
          </div>
        )}
      </div>

      {/* Game Modes Selection / Display */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
          <span>Active Game Modes (Randomized Rotation):</span>
          {isHost && <span className="text-[10px] text-slate-400">Tap to toggle</span>}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {ALL_MODES.map((item) => {
            const isSelected = settings.selectedModes.includes(item.mode);
            return (
              <button
                key={item.mode}
                type="button"
                onClick={() => handleToggleMode(item.mode)}
                disabled={!isHost}
                className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  isSelected
                    ? item.color + ' shadow-sm'
                    : 'bg-slate-950/40 border-white/5 text-slate-600 opacity-60'
                } ${isHost ? 'cursor-pointer hover:brightness-110 active:scale-95' : 'cursor-default'}`}
              >
                {item.icon}
                <span>{item.label}</span>
                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
