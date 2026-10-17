import React, { useState, useEffect } from 'react';
import { Calculator } from 'lucide-react';
import { MathQuestionClient } from '@mind-clash/shared';
import { AnswerButton, AnswerState } from '../common/AnswerButton';
import { sounds } from '../../audio/soundEffects';

interface MathViewProps {
  question: MathQuestionClient;
  revealAnswer?: number | null;
  onAnswer?: (answer: number) => void;
  disabled?: boolean;
}

export const MathView: React.FC<MathViewProps> = ({
  question,
  revealAnswer = null,
  onAnswer,
  disabled = false,
}) => {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  // Reset selected answer when a new question arrives
  useEffect(() => {
    setSelectedAnswer(null);
  }, [question.id]);

  const handleSelect = (val: number) => {
    if (disabled || selectedAnswer !== null) return;
    setSelectedAnswer(val);
    sounds.playClick();
    if (onAnswer) onAnswer(val);
  };

  // Keyboard shortcut support (1-4 and A-D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled || selectedAnswer !== null) return;
      const key = e.key.toUpperCase();
      let targetIdx = -1;
      if (key === 'A' || key === '1') targetIdx = 0;
      else if (key === 'B' || key === '2') targetIdx = 1;
      else if (key === 'C' || key === '3') targetIdx = 2;
      else if (key === 'D' || key === '4') targetIdx = 3;

      if (targetIdx >= 0 && targetIdx < question.options.length) {
        handleSelect(question.options[targetIdx]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, selectedAnswer, question.options]);

  const hotkeys = ['A', 'B', 'C', 'D'];

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 animate-fade-in motion-reduce:animate-none">
      {/* Header Badge */}
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 uppercase tracking-wider font-bold shadow-sm">
          <Calculator className="w-3.5 h-3.5" />
          Speed Math
        </span>
        <span className="text-slate-400 hidden sm:inline text-xs">
          Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-purple-300 font-mono text-[10px]">1-4</kbd> or tap to answer
        </span>
      </div>

      {/* Arithmetic Problem Billboard */}
      <div className="p-8 sm:p-10 rounded-3xl bg-slate-900/90 border border-purple-500/30 shadow-2xl text-center space-y-3 relative overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-cyan-400 to-purple-500" />
        <span className="text-xs font-mono uppercase tracking-widest text-slate-400 font-bold">
          Solve Expression
        </span>
        <h2 className="text-3xl sm:text-5xl font-mono font-black text-white tracking-wide">
          {question.prompt}
        </h2>
      </div>

      {/* Answer Options Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {question.options.map((option, idx) => {
          let state: AnswerState = 'default';

          if (revealAnswer !== null && revealAnswer !== undefined) {
            if (option === revealAnswer) {
              state = 'correct';
            } else if (selectedAnswer === option) {
              state = 'wrong';
            } else {
              state = 'dimmed';
            }
          } else if (selectedAnswer === option) {
            state = 'selected';
          }

          return (
            <AnswerButton
              key={`${question.id}-${idx}`}
              hotkey={hotkeys[idx]}
              label={option}
              state={state}
              disabled={disabled || selectedAnswer !== null}
              onClick={() => handleSelect(option)}
              className="text-center justify-center font-mono text-xl sm:text-2xl"
            />
          );
        })}
      </div>
    </div>
  );
};
