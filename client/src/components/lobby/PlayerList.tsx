import React from 'react';
import { UserPlus } from 'lucide-react';
import { Player } from '@mind-clash/shared';
import { PlayerCard } from '../common/PlayerCard';
import { MAX_PLAYERS_PER_ROOM } from '@mind-clash/shared';

interface PlayerListProps {
  players: Player[];
  currentPlayerId?: string;
  isHost?: boolean;
  onKickPlayer?: (playerId: string) => void;
}

export const PlayerList: React.FC<PlayerListProps> = ({
  players,
  currentPlayerId,
  isHost = false,
  onKickPlayer,
}) => {
  const vacantSlots = Math.max(0, MAX_PLAYERS_PER_ROOM - players.length);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
        <span>
          LOBBY PLAYERS ({players.length} / {MAX_PLAYERS_PER_ROOM})
        </span>
        <span className="text-cyan-400">
          {players.length >= 2 ? 'Ready to Start' : 'Need at least 2 players'}
        </span>
      </div>

      {/* Roster Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {players.map((player) => (
          <PlayerCard
            key={player.id}
            player={player}
            isCurrentPlayer={player.id === currentPlayerId}
            canKick={isHost}
            onKick={onKickPlayer}
            showScore={false}
          />
        ))}

        {/* Vacant Player Slots */}
        {Array.from({ length: Math.min(vacantSlots, 4) }).map((_, i) => (
          <div
            key={`vacant-${i}`}
            className="flex items-center gap-3 p-3.5 rounded-2xl border border-dashed border-white/10 bg-white/[0.01] text-slate-500 select-none"
          >
            <div className="w-9 h-9 rounded-2xl border border-dashed border-white/10 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-slate-600" />
            </div>
            <span className="text-xs font-medium">Waiting for player...</span>
          </div>
        ))}
      </div>
    </div>
  );
};
