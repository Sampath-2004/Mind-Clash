import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { WifiOff, RefreshCw, Home, AlertOctagon, UserX, ShieldAlert } from 'lucide-react';
import { useGame } from '../context/GameStateContext';
import { sounds } from '../audio/soundEffects';
import { RECONNECT_GRACE_PERIOD_MS } from '@mind-clash/shared';

export const ErrorReconnectPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isConnected } = useGame();

  const type = searchParams.get('type') || 'disconnected';
  const reason = searchParams.get('reason') || 'Lost connection to multiplayer game server';

  const [graceSecondsLeft, setGraceSecondsLeft] = useState(
    Math.floor(RECONNECT_GRACE_PERIOD_MS / 1000)
  );
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    if (type !== 'disconnected') return;
    const timer = setInterval(() => {
      setGraceSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [type]);

  const handleRetry = () => {
    sounds.playClick();
    setIsRetrying(true);
    setTimeout(() => {
      setIsRetrying(false);
      if (isConnected) {
        navigate('/lobby');
      }
    }, 1500);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-md glass-panel p-6 sm:p-8 rounded-3xl text-center space-y-6 relative overflow-hidden">
        {/* Status Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center">
          {type === 'disconnected' && (
            <div className="w-full h-full rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <WifiOff className="w-8 h-8 animate-pulse motion-reduce:animate-none" />
            </div>
          )}
          {type === 'kicked' && (
            <div className="w-full h-full rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <UserX className="w-8 h-8" />
            </div>
          )}
          {type === 'not_found' && (
            <div className="w-full h-full rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <AlertOctagon className="w-8 h-8" />
            </div>
          )}
        </div>

        {/* Headings */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            {type === 'disconnected' && 'Connection Interrupted'}
            {type === 'kicked' && 'Removed From Room'}
            {type === 'not_found' && 'Room Not Found'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{reason}</p>
        </div>

        {/* Reconnect Grace Period Bar (for disconnected state) */}
        {type === 'disconnected' && (
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-rose-500/20 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5 font-semibold">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" /> Session Grace Window
              </span>
              <span className="font-mono font-bold text-rose-400">
                {graceSecondsLeft}s Remaining
              </span>
            </div>
            <p className="text-[11px] text-slate-400 text-left">
              Your room slot and score are reserved for 60 seconds. Reconnect now to resume gameplay.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          {type === 'disconnected' && (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 active:scale-98 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/25 transition flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Re-establishing WebSocket...' : 'Reconnect Now'}
            </button>
          )}

          <Link
            to="/"
            onClick={() => sounds.playClick()}
            className="w-full py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs uppercase tracking-wider border border-white/10 transition flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            Return to Main Menu
          </Link>
        </div>
      </div>
    </div>
  );
};
