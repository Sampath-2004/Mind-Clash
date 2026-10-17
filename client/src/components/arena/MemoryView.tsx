import React, { useState, useEffect } from 'react';
import { Grid, Eye, CheckCircle2 } from 'lucide-react';
import { MemoryChallengeClient } from '@mind-clash/shared';
import { sounds } from '../../audio/soundEffects';

interface MemoryViewProps {
  challenge: MemoryChallengeClient;
  revealSolution?: number[] | null;
  onSubmitTiles?: (indices: number[]) => void;
  disabled?: boolean;
}

export const MemoryView: React.FC<MemoryViewProps> = ({
  challenge,
  revealSolution = null,
  onSubmitTiles,
  disabled = false,
}) => {
  const [phase, setPhase] = useState<'memorize' | 'recall'>('memorize');
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [isLocked, setIsLocked] = useState(false);

  const gridSize = challenge.gridSize || 3;
  const totalTiles = gridSize * gridSize;

  // Reveal phase timer
  useEffect(() => {
    setPhase('memorize');
    setSelectedIndices([]);
    setIsLocked(false);

    const timer = setTimeout(() => {
      setPhase('recall');
    }, challenge.revealDurationMs || 2800);

    return () => clearTimeout(timer);
  }, [challenge]);

  const toggleTile = (index: number) => {
    if (phase !== 'recall' || disabled || isLocked) return;
    sounds.playClick();
    setSelectedIndices((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index);
      } else {
        return [...prev, index];
      }
    });
  };

  const handleLockIn = () => {
    if (isLocked || disabled) return;
    setIsLocked(true);
    sounds.playClick();
    if (onSubmitTiles) onSubmitTiles(selectedIndices);
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* Header Badge & Phase Banner */}
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 uppercase tracking-wider">
          <Grid className="w-3.5 h-3.5" />
          Memory Matrix
        </span>
        <span
          className={`font-bold uppercase tracking-wider flex items-center gap-1 ${
            phase === 'memorize' ? 'text-amber-400 animate-pulse' : 'text-cyan-400'
          }`}
        >
          {phase === 'memorize' ? (
            <>
              <Eye className="w-3.5 h-3.5" /> Memorize Pattern!
            </>
          ) : (
            <>Recall & Tap Tiles</>
          )}
        </span>
      </div>

      {/* Grid Container */}
      <div className="p-6 rounded-3xl bg-slate-900/90 border border-white/10 shadow-2xl flex flex-col items-center gap-4">
        <div
          className="grid gap-3 w-full aspect-square max-w-[320px]"
          style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: totalTiles }).map((_, idx) => {
            const isPatternTile = challenge.pattern.includes(idx);
            const isSelected = selectedIndices.includes(idx);

            let tileClasses = 'bg-slate-950 border-white/10 hover:border-cyan-500/50';

            if (revealSolution !== null && revealSolution !== undefined) {
              const inSolution = revealSolution.includes(idx);
              if (inSolution && isSelected) {
                tileClasses = 'bg-emerald-500 border-emerald-400 ring-2 ring-emerald-400 shadow-lg shadow-emerald-500/50';
              } else if (inSolution && !isSelected) {
                tileClasses = 'bg-emerald-950 border-emerald-500 text-emerald-400 ring-1 ring-emerald-500/50';
              } else if (!inSolution && isSelected) {
                tileClasses = 'bg-rose-600 border-rose-400 ring-2 ring-rose-400 shadow-lg shadow-rose-500/50';
              }
            } else if (phase === 'memorize') {
              if (isPatternTile) {
                tileClasses = 'bg-cyan-400 border-cyan-300 ring-2 ring-cyan-300 shadow-xl shadow-cyan-500/60 scale-95';
              }
            } else {
              // Recall Phase
              if (isSelected) {
                tileClasses = 'bg-purple-600 border-purple-400 ring-2 ring-purple-400 shadow-lg shadow-purple-500/50 scale-95';
              }
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => toggleTile(idx)}
                disabled={phase !== 'recall' || isLocked || disabled}
                aria-label={`Tile ${idx + 1}`}
                className={`w-full h-full rounded-2xl border transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${tileClasses}`}
              />
            );
          })}
        </div>

        {/* Phase Action Footnote */}
        {phase === 'recall' && (
          <div className="w-full pt-2 flex items-center justify-between text-xs text-slate-300">
            <span>
              Selected: <strong className="font-mono text-cyan-300">{selectedIndices.length}</strong> /{' '}
              {challenge.pattern.length}
            </span>
            <button
              onClick={handleLockIn}
              disabled={isLocked || disabled || selectedIndices.length === 0}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold uppercase tracking-wider text-xs transition active:scale-95 ${
                isLocked
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isLocked ? 'Locked In' : 'Lock In Answers'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
