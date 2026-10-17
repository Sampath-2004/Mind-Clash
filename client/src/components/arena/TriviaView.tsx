import React, { useState, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';
import { AnswerButton, AnswerState } from '../common/AnswerButton';
import { TriviaQuestionClient } from '@mind-clash/shared';
import { sounds } from '../../audio/soundEffects';

interface TriviaViewProps {
  question: TriviaQuestionClient;
  revealCorrectIndex?: number | null;
  onAnswer?: (index: number) => void;
  disabled?: boolean;
}

export const TriviaView: React.FC<TriviaViewProps> = ({
  question,
  revealCorrectIndex = null,
  onAnswer,
  disabled = false,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Reset selected state when a new question arrives
  useEffect(() => {
    setSelectedIndex(null);
  }, [question.id]);

  const handleSelect = (idx: number) => {
    if (disabled || selectedIndex !== null) return;
    setSelectedIndex(idx);
    sounds.playClick();
    if (onAnswer) onAnswer(idx);
  };

  // Keyboard shortcut support (1-4 and A-D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled || selectedIndex !== null) return;
      const key = e.key.toUpperCase();
      let targetIdx = -1;
      if (key === 'A' || key === '1') targetIdx = 0;
      else if (key === 'B' || key === '2') targetIdx = 1;
      else if (key === 'C' || key === '3') targetIdx = 2;
      else if (key === 'D' || key === '4') targetIdx = 3;

      if (targetIdx >= 0 && targetIdx < question.options.length) {
        handleSelect(targetIdx);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, selectedIndex, question.options]);

  const hotkeys = ['A', 'B', 'C', 'D'];

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 animate-fade-in motion-reduce:animate-none">
      {/* Category Pill & Instructions */}
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 uppercase tracking-wider font-bold shadow-sm">
          <HelpCircle className="w-3.5 h-3.5" />
          {question.category}
        </span>
        <span className="text-slate-400 hidden sm:inline text-xs">
          Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 font-mono text-[10px]">A-D</kbd> or tap to answer
        </span>
      </div>

      {/* Animated Question Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-white/10 shadow-2xl text-center space-y-2 relative overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-cyan-500" />
        <h2 className="text-xl sm:text-2xl font-black text-white leading-relaxed">
          {question.question}
        </h2>
      </div>

      {/* 4 Answer Buttons (Responsive 2x2 or Stacked) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {question.options.map((option, idx) => {
          let state: AnswerState = 'default';

          if (revealCorrectIndex !== null && revealCorrectIndex !== undefined) {
            if (idx === revealCorrectIndex) {
              state = 'correct';
            } else if (selectedIndex === idx) {
              state = 'wrong';
            } else {
              state = 'dimmed';
            }
          } else if (selectedIndex === idx) {
            state = 'selected';
          }

          return (
            <AnswerButton
              key={`${question.id}-${idx}`}
              hotkey={hotkeys[idx]}
              label={option}
              state={state}
              disabled={disabled || selectedIndex !== null}
              onClick={() => handleSelect(idx)}
            />
          );
        })}
      </div>
    </div>
  );
};
