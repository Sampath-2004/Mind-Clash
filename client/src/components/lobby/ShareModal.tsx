import React, { useState } from 'react';
import { Copy, Check, Share2, Globe } from 'lucide-react';
import { Modal } from '../common/Modal';
import { useToast } from '../../context/ToastContext';
import { sounds } from '../../audio/soundEffects';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, roomCode }) => {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  const shareUrl = `${window.location.origin}/join?code=${roomCode}`;

  const handleCopyLink = async () => {
    sounds.playClick();
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      showToast('Invite Link Copied!', 'Share it with your friends to jump in instantly', 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('Clipboard Error', 'Could not copy link automatically', 'warning');
    }
  };

  const handleNativeShare = async () => {
    sounds.playClick();
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Mind Clash Multiplayer Invite',
          text: `Join my Mind Clash arena! Room Code: ${roomCode}`,
          url: shareUrl,
        });
      } catch {
        // User cancelled or not supported
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invite Competitors" maxWidth="sm">
      <div className="space-y-5 text-center">
        <p className="text-xs text-slate-400">
          Friends can join without creating an account or downloading anything. Just send them the code or link!
        </p>

        {/* Room Code Badge */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-cyan-500/30 space-y-1">
          <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
            Room Code
          </span>
          <p className="text-3xl font-mono font-black text-cyan-300 tracking-wider">
            {roomCode}
          </p>
        </div>

        {/* Link Input Bar */}
        <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-white/10 text-xs">
          <Globe className="w-4 h-4 text-slate-500 shrink-0 ml-1" />
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="w-full bg-transparent text-slate-300 font-mono focus:outline-none select-all truncate"
          />
          <button
            onClick={handleCopyLink}
            className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        {/* Action Buttons */}
        {'share' in navigator && (
          <button
            onClick={handleNativeShare}
            className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-98 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition"
          >
            <Share2 className="w-4 h-4" />
            Share via Device Sheet
          </button>
        )}
      </div>
    </Modal>
  );
};
