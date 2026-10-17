import React from 'react';
import { Layers, Zap, Calculator, Grid, HelpCircle } from 'lucide-react';
import { RoomSettings, GameMode } from '@mind-clash/shared';

interface SettingsSummaryProps {
  settings: RoomSettings;
}

export const SettingsSummary: React.FC<SettingsSummaryProps> = ({ settings }) => {
  const modeIcons: Record<GameMode, { label: string; icon: React.ReactNode; color: string }> = {
    trivia: {
      label: 'Trivia',
      icon: <HelpCircle className="w-3.5 h-3.5" />,
      color: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
    },
    math: {
      label: 'Math',
      icon: <Calculator className="w-3.5 h-3.5" />,
      color: 'bg-purple-500/10 border-purple-500/30 text-purple-300',
    },
    memory: {
      label: 'Memory',
      icon: <Grid className="w-3.5 h-3.5" />,
      color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    },
    reaction: {
      label: 'Reaction',
      icon: <Zap className="w-3.5 h-3.5" />,
      color: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    },
  };

  return (
    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400 font-semibold flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-cyan-400" /> Match Structure
        </span>
        <span className="font-mono font-bold text-white bg-white/5 px-2.5 py-0.5 rounded-full border border-white/10">
          {settings.roundCount} Rounds
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {settings.selectedModes.map((mode) => {
          const cfg = modeIcons[mode];
          return (
            <span
              key={mode}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-semibold ${cfg.color}`}
            >
              {cfg.icon}
              {cfg.label}
            </span>
          );
        })}
      </div>
    </div>
  );
};
