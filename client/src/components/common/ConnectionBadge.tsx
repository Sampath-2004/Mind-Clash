import React from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useGame } from '../../context/GameStateContext';
import { sounds } from '../../audio/soundEffects';

interface ConnectionBadgeProps {
  onReconnect?: () => void;
  compact?: boolean;
}

export const ConnectionBadge: React.FC<ConnectionBadgeProps> = ({ onReconnect, compact = false }) => {
  const { isConnected, socketId } = useGame();

  const handleReconnect = () => {
    sounds.playClick();
    if (onReconnect) onReconnect();
  };

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border backdrop-blur-md px-3 py-1 transition-all ${
        isConnected
          ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
          : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
      }`}
      title={isConnected ? `Connected (ID: ${socketId || 'Active'})` : 'Disconnected from server'}
    >
      <span className="relative flex h-2 w-2">
        {isConnected && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-reduce:hidden" />
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            isConnected ? 'bg-emerald-400' : 'bg-rose-500'
          }`}
        />
      </span>

      {isConnected ? (
        <Wifi className="w-3.5 h-3.5 text-emerald-400" />
      ) : (
        <WifiOff className="w-3.5 h-3.5 text-rose-400" />
      )}

      {!compact && (
        <span className="text-xs font-semibold uppercase tracking-wider">
          {isConnected ? 'Online' : 'Offline'}
        </span>
      )}

      {!isConnected && onReconnect && (
        <button
          onClick={handleReconnect}
          className="ml-1 p-0.5 hover:text-white transition-colors"
          title="Attempt Reconnection"
        >
          <RefreshCw className="w-3 h-3 animate-spin" />
        </button>
      )}
    </div>
  );
};
