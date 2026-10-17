import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Volume2, VolumeX, HelpCircle, Users } from 'lucide-react';
import { Logo } from './Logo';
import { ConnectionBadge } from './ConnectionBadge';
import { useGame } from '../../context/GameStateContext';

interface NavbarProps {
  onOpenHowToPlay?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenHowToPlay }) => {
  const { currentRoom, isMuted, toggleSound } = useGame();
  const location = useLocation();

  const isLobbyOrGame =
    location.pathname.startsWith('/lobby') ||
    location.pathname.startsWith('/game') ||
    location.pathname.startsWith('/recap') ||
    location.pathname.startsWith('/podium');

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-slate-950/80 border-b border-white/5 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand Logo */}
        <Link to="/" className="focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-lg">
          <Logo size="sm" />
        </Link>

        {/* Center: In-room Quick Stats / Navigation */}
        {isLobbyOrGame && currentRoom && (
          <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs">
            <span className="flex items-center gap-1.5 text-cyan-400 font-bold font-mono">
              ROOM: {currentRoom.roomCode}
            </span>
            <span className="text-white/20">•</span>
            <span className="flex items-center gap-1 text-slate-300">
              <Users className="w-3.5 h-3.5 text-purple-400" />
              {currentRoom.players.length} Players
            </span>
            {currentRoom.status !== 'LOBBY' && (
              <>
                <span className="text-white/20">•</span>
                <span className="text-amber-400 font-semibold">
                  Round {currentRoom.currentRound}/{currentRoom.totalRounds}
                </span>
              </>
            )}
          </div>
        )}

        {/* Right: Controls & Connection Status */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* How to Play Trigger */}
          {onOpenHowToPlay && (
            <button
              onClick={onOpenHowToPlay}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 transition active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              title="How to Play"
            >
              <HelpCircle className="w-4 h-4 text-cyan-400" />
              <span className="hidden md:inline">Rules</span>
            </button>
          )}

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            aria-label={isMuted ? 'Unmute game audio' : 'Mute game audio'}
            className="p-2 rounded-lg text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 transition active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            )}
          </button>

          {/* Connection Status Pill */}
          <ConnectionBadge compact />
        </div>
      </div>
    </header>
  );
};
