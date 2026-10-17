import React from 'react';
import { Flame, UserX, Award } from 'lucide-react';
import { Player } from '@mind-clash/shared';
import { AvatarBadge } from './AvatarBadge';

interface PlayerCardProps {
  player: Player;
  rank?: number;
  rankDelta?: number;
  isCurrentPlayer?: boolean;
  canKick?: boolean;
  onKick?: (playerId: string) => void;
  showScore?: boolean;
  className?: string;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({
  player,
  rank,
  rankDelta,
  isCurrentPlayer = false,
  canKick = false,
  onKick,
  showScore = true,
  className = '',
}) => {
  const rankColors: Record<number, string> = {
    1: 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-amber-500/20',
    2: 'bg-slate-300/20 text-slate-200 border-slate-300/40',
    3: 'bg-amber-700/20 text-amber-500 border-amber-700/40',
  };

  return (
    <div
      className={`relative flex items-center justify-between p-3 sm:p-4 rounded-2xl border backdrop-blur-md transition-all ${
        isCurrentPlayer
          ? 'bg-cyan-950/40 border-cyan-500/40 ring-1 ring-cyan-500/30'
          : 'bg-slate-900/40 hover:bg-slate-900/60 border-white/5 hover:border-white/10'
      } ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Optional Rank Badge */}
        {rank !== undefined && (
          <div
            className={`flex items-center justify-center w-7 h-7 rounded-xl border text-xs font-mono font-black shrink-0 ${
              rankColors[rank] || 'bg-white/5 border-white/10 text-slate-400'
            }`}
          >
            {rank <= 3 ? <Award className="w-4 h-4" /> : `#${rank}`}
          </div>
        )}

        {/* Avatar */}
        <AvatarBadge
          avatarId={player.avatar}
          isHost={player.isHost}
          isConnected={player.isConnected}
          size="sm"
        />

        {/* Player Meta */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm sm:text-base text-white truncate">
              {player.nickname}
            </span>
            {isCurrentPlayer && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                You
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            {player.streak > 1 && (
              <span className="flex items-center gap-0.5 text-amber-400 font-semibold">
                <Flame className="w-3.5 h-3.5 fill-current" />
                {player.streak} Streak
              </span>
            )}
            {!player.isConnected && (
              <span className="text-rose-400 text-[11px] font-medium">Reconnecting...</span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Score & Actions */}
      <div className="flex items-center gap-3 shrink-0">
        {rankDelta !== undefined && rankDelta !== 0 && (
          <span
            className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${
              rankDelta > 0
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-rose-500/20 text-rose-300'
            }`}
          >
            {rankDelta > 0 ? `+${rankDelta}` : rankDelta}
          </span>
        )}

        {showScore && (
          <div className="text-right">
            <span className="block font-mono font-black text-base sm:text-lg text-cyan-400">
              {player.score.toLocaleString()}
            </span>
            <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold">
              PTS
            </span>
          </div>
        )}

        {canKick && !player.isHost && onKick && (
          <button
            onClick={() => onKick(player.id)}
            aria-label={`Kick ${player.nickname}`}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            title="Kick Player"
          >
            <UserX className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
