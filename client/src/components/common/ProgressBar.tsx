import React from 'react';

interface ProgressBarProps {
  current: number;
  total: number;
  label?: string;
  showCount?: boolean;
  colorScheme?: 'cyan' | 'purple' | 'amber' | 'gradient';
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  current,
  total,
  label,
  showCount = true,
  colorScheme = 'gradient',
  className = '',
}) => {
  const percentage = Math.max(0, Math.min(100, (current / total) * 100));

  const colors = {
    cyan: 'bg-cyan-500 shadow-cyan-500/50',
    purple: 'bg-purple-500 shadow-purple-500/50',
    amber: 'bg-amber-500 shadow-amber-500/50',
    gradient: 'bg-gradient-to-r from-cyan-400 via-purple-500 to-amber-400 shadow-cyan-500/30',
  };

  return (
    <div className={`w-full space-y-1.5 ${className}`}>
      {(label || showCount) && (
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
          <span>{label}</span>
          {showCount && (
            <span className="font-mono text-cyan-300">
              {current} / {total}
            </span>
          )}
        </div>
      )}

      {/* Track */}
      <div className="w-full h-2.5 bg-slate-900/80 rounded-full overflow-hidden border border-white/10 p-0.5">
        <div
          role="progressbar"
          aria-valuenow={current}
          aria-valuemin={0}
          aria-valuemax={total}
          className={`h-full rounded-full transition-all duration-300 ease-out shadow-sm motion-reduce:transition-none ${colors[colorScheme]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
