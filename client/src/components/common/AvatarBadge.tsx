import React from 'react';
import { Crown, WifiOff } from 'lucide-react';
import { AVATAR_OPTIONS } from '../../context/GameStateContext';

interface AvatarBadgeProps {
  avatarId: string;
  isHost?: boolean;
  isConnected?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isSelected?: boolean;
  className?: string;
}

export const AvatarBadge: React.FC<AvatarBadgeProps> = ({
  avatarId,
  isHost = false,
  isConnected = true,
  size = 'md',
  isSelected = false,
  className = '',
}) => {
  const avatar = AVATAR_OPTIONS.find((a) => a.id === avatarId) || AVATAR_OPTIONS[0];

  const sizeStyles = {
    xs: { box: 'w-7 h-7 text-xs', crown: 'w-2.5 h-2.5 -top-1 -right-1', ring: 'ring-1' },
    sm: { box: 'w-9 h-9 text-base', crown: 'w-3 h-3 -top-1.5 -right-1.5', ring: 'ring-2' },
    md: { box: 'w-12 h-12 text-2xl', crown: 'w-4 h-4 -top-2 -right-2', ring: 'ring-2' },
    lg: { box: 'w-16 h-16 text-3xl', crown: 'w-5 h-5 -top-2.5 -right-2.5', ring: 'ring-2' },
    xl: { box: 'w-20 h-20 text-4xl', crown: 'w-6 h-6 -top-3 -right-3', ring: 'ring-4' },
  };

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      {/* Avatar Emoji Container with gradient background */}
      <div
        className={`rounded-2xl flex items-center justify-center select-none shadow-lg transition-transform ${
          sizeStyles[size].box
        } bg-gradient-to-br ${avatar.color} ${
          isSelected
            ? 'ring-4 ring-cyan-400 ring-offset-2 ring-offset-slate-950 scale-105 shadow-cyan-500/50'
            : isConnected
            ? 'ring-1 ring-white/10'
            : 'opacity-40 grayscale'
        }`}
      >
        <span role="img" aria-label={avatar.label} className="leading-none drop-shadow">
          {avatar.emoji}
        </span>
      </div>

      {/* Host Crown */}
      {isHost && (
        <div
          className={`absolute ${sizeStyles[size].crown} p-1 rounded-full bg-amber-500 text-slate-950 shadow-md ring-1 ring-slate-950`}
          title="Room Host"
        >
          <Crown className="w-full h-full fill-current" />
        </div>
      )}

      {/* Disconnected Indicator */}
      {!isConnected && (
        <div
          className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-rose-600 text-white shadow-md ring-1 ring-slate-950"
          title="Disconnected"
        >
          <WifiOff className="w-3 h-3" />
        </div>
      )}
    </div>
  );
};
