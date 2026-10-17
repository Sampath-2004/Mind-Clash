import React, { useState } from 'react';
import { Copy, Check, Share2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { sounds } from '../../audio/soundEffects';

interface RoomCodeDisplayProps {
  roomCode: string;
  onOpenShare?: () => void;
  size?: 'normal' | 'large';
}

export const RoomCodeDisplay: React.FC<RoomCodeDisplayProps> = ({
  roomCode,
  onOpenShare,
  size = 'normal',
}) => {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  const handleCopy = async () => {
    sounds.playClick();
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      showToast('Room Code Copied!', `Code ${roomCode} copied to clipboard`, 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('Clipboard Error', `Please manually copy code: ${roomCode}`, 'warning');
    }
  };

  const letters = roomCode.split('');

  return (
    <div
      data-testid="room-code-display"
      data-room-code={roomCode}
      className="flex flex-col items-center gap-3"
    >
      <span className="text-xs uppercase tracking-widest text-slate-400 font-bold">
        Room Code
      </span>

      {/* Segmented 6-Character Grid */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {letters.map((char, index) => (
          <div
            key={index}
            className={`flex items-center justify-center font-mono font-black rounded-xl border border-cyan-500/30 bg-slate-900/90 text-cyan-300 shadow-inner select-all ${
              size === 'large'
                ? 'w-11 h-14 sm:w-14 sm:h-18 text-2xl sm:text-3xl'
                : 'w-8 h-10 sm:w-10 sm:h-12 text-lg sm:text-xl'
            }`}
          >
            {char}
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 mt-1">
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-slate-200 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          title="Copy Room Code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-cyan-400" />
              <span>Copy Code</span>
            </>
          )}
        </button>

        {onOpenShare && (
          <button
            onClick={onOpenShare}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-slate-200 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            title="Share Room Link"
          >
            <Share2 className="w-3.5 h-3.5 text-purple-400" />
            <span>Share Link</span>
          </button>
        )}
      </div>
    </div>
  );
};
