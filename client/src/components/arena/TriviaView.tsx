import React, { useState } from 'react';
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

  const handleSelect = (idx: number) => {
    if (disabled || selectedIndex !== null) return;
    setSelectedIndex(idx);
    sounds.playClick();
    if (onAnswer) onAnswer(idx);
  };

  const hotkeys = ['A', 'B', 'C', 'D'];

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Category Pill & Instructions */}
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 uppercase tracking-wider">
          <HelpCircle className="w-3.5 h-3.5" />
          {question.category}
        </span>
        <span className="text-slate-400">Choose the correct answer</span>
      </div>

      {/* Question Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-white/10 shadow-2xl text-center space-y-2">
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
              key={idx}
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
