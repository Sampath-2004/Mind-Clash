import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, CheckCircle2, Lightbulb, Edit3, Users, BrainCircuit } from 'lucide-react';
import { RareAnswerChallengeClient } from '@mind-clash/shared';
import { sounds } from '../../audio/soundEffects';
import { useGame, AVATAR_OPTIONS } from '../../context/GameStateContext';

interface RareAnswerViewProps {
  challenge: RareAnswerChallengeClient;
  onAnswer?: (answer: string) => void;
  disabled?: boolean;
}

export const RareAnswerView: React.FC<RareAnswerViewProps> = ({
  challenge,
  onAnswer,
  disabled = false,
}) => {
  const { currentRoom, currentPlayer, submittedPlayerIds, isJudging, mySubmittedAnswer } = useGame();
  const [inputVal, setInputVal] = useState<string>(mySubmittedAnswer || '');
  const [lastAckAnswer, setLastAckAnswer] = useState<string | null>(mySubmittedAnswer || null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync with context on challenge or submission changes
  useEffect(() => {
    if (mySubmittedAnswer) {
      setLastAckAnswer(mySubmittedAnswer);
      if (!inputVal) {
        setInputVal(mySubmittedAnswer);
      }
    }
  }, [mySubmittedAnswer]);

  // Reset when a new challenge begins
  useEffect(() => {
    setInputVal('');
    setLastAckAnswer(null);
    if (!disabled && !isJudging) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [challenge.id]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputVal.trim();
    if (!trimmed || disabled || isJudging) return;

    sounds.playClick();
    setLastAckAnswer(trimmed);
    if (onAnswer) {
      onAnswer(trimmed);
    }
  };

  const isLocked = disabled || isJudging;
  const connectedPlayers = currentRoom?.players.filter((p) => p.isConnected) || [];
  const submittedCount = connectedPlayers.filter((p) => submittedPlayerIds.has(p.id)).length;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 animate-fade-in motion-reduce:animate-none">
      {/* Category Pill and Submissions Progress */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-semibold">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 uppercase tracking-wider font-bold shadow-sm self-start">
          <Sparkles className="w-3.5 h-3.5" />
          {challenge.category}
        </span>
        <div className="flex items-center gap-2 text-slate-400 text-xs self-start sm:self-auto">
          <Users className="w-3.5 h-3.5 text-cyan-400" />
          <span>
            {connectedPlayers.length > 0
              ? `${submittedCount} / ${connectedPlayers.length} Submissions Locked`
              : 'Private Submissions'}
          </span>
        </div>
      </div>

      {/* Prompt Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-white/10 shadow-2xl text-center space-y-3 relative overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-amber-400 to-rose-500" />
        <span className="text-[11px] font-mono uppercase tracking-widest text-rose-300/80">
          Rare Answer Challenge
        </span>
        <h2 className="text-lg sm:text-2xl font-black text-white leading-snug">
          {challenge.prompt}
        </h2>
        {challenge.sampleAcceptableHint && (
          <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Hint format: {challenge.sampleAcceptableHint}</span>
          </p>
        )}
      </div>

      {/* Visible AI Judging State */}
      {isJudging ? (
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/95 border border-purple-500/40 shadow-2xl text-center space-y-4 relative overflow-hidden backdrop-blur-md animate-pulse">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-500 via-rose-500 to-cyan-400 animate-pulse" />
          <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-lg shadow-purple-500/20">
            <BrainCircuit className="w-7 h-7 animate-spin" style={{ animationDuration: '4s' }} />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg sm:text-xl font-black text-white tracking-wide">
              Submissions Locked • Judging in Progress
            </h3>
            <p className="text-xs sm:text-sm text-purple-200/90 max-w-md mx-auto">
              Our AI engine is batch-evaluating validity, normalizing aliases, and calculating match uniqueness...
            </p>
          </div>
          {lastAckAnswer && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-200 text-xs font-mono">
              <span>Your locked submission:</span>
              <strong className="text-white">&ldquo;{lastAckAnswer}&rdquo;</strong>
            </div>
          )}
        </div>
      ) : (
        /* Input and Submission Section */
        <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                disabled={isLocked}
                placeholder="Type your rare answer..."
                maxLength={60}
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                className="w-full px-5 py-4 rounded-2xl bg-slate-950/80 border border-white/15 text-white placeholder-slate-500 font-semibold text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-rose-400 transition"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                type="submit"
                disabled={isLocked || !inputVal.trim() || inputVal.trim() === lastAckAnswer}
                className={`w-full py-4 rounded-2xl bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 hover:brightness-110 active:scale-98 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-rose-500/20 transition-all flex items-center justify-center gap-2 ${
                  isLocked || !inputVal.trim() || inputVal.trim() === lastAckAnswer
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                }`}
              >
                {lastAckAnswer ? (
                  <>
                    <Edit3 className="w-4 h-4" />
                    <span>Update Submission</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Lock In Answer</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Submission feedback */}
          {lastAckAnswer && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Recorded: <strong className="text-white">&ldquo;{lastAckAnswer}&rdquo;</strong>
                </span>
              </div>
              <span className="text-[11px] text-emerald-400/80 hidden sm:inline">
                Edits allowed until server deadline
              </span>
            </div>
          )}
        </div>
      )}

      {/* Live Submission Tracker: Shows WHO submitted without leaking WHAT they answered */}
      {connectedPlayers.length > 0 && (
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span className="uppercase tracking-wider text-[10px] font-bold">Room Submission Status</span>
            <span className="text-[11px] text-slate-500">Answers remain private until judging</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {connectedPlayers.map((player) => {
              const hasSubmitted = submittedPlayerIds.has(player.id);
              const isMe = player.id === currentPlayer?.id;
              const avatarMeta = AVATAR_OPTIONS.find((a) => a.id === player.avatar) || AVATAR_OPTIONS[0];

              return (
                <div
                  key={player.id}
                  className={`p-2.5 rounded-xl border flex items-center gap-2 transition ${
                    hasSubmitted
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                      : 'bg-white/5 border-white/5 text-slate-400'
                  }`}
                >
                  <span className="text-base select-none">{avatarMeta.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold truncate text-white">
                      {player.nickname} {isMe && <span className="text-rose-400 text-[10px]">(You)</span>}
                    </div>
                    <div className="text-[10px] flex items-center gap-1">
                      {hasSubmitted ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Ready
                        </span>
                      ) : (
                        <span className="text-slate-500">Typing...</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Clear Rules and Scoring Information */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1.5 text-xs text-slate-400">
        <div className="flex items-center gap-2 text-rose-300 font-bold uppercase tracking-wider text-[11px]">
          <Sparkles className="w-3.5 h-3.5 text-rose-400" />
          <span>Match Uniqueness Scoring Formula</span>
        </div>
        <p className="leading-relaxed">
          Points are based exclusively on uniqueness within this match:
        </p>
        <ul className="list-disc list-inside text-[11px] space-y-0.5 text-slate-300 pl-1">
          <li><strong>Valid unique answer:</strong> 100 points (1 player)</li>
          <li><strong>Valid shared answer:</strong> Math.round(100 / matching players) (50 pts each for 2 players, 33 for 3)</li>
          <li><strong>Blank or invalid answer:</strong> 0 points</li>
          <li><strong>No speed bonus:</strong> Take your time to think of a rare response!</li>
        </ul>
      </div>
    </div>
  );
};
