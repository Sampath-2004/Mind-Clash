import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { sounds } from '../../audio/soundEffects';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleClose = () => {
    sounds.playClick();
    onClose();
  };

  const maxWidthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity animate-pop motion-reduce:animate-none"
        onClick={handleClose}
      />

      {/* Modal Surface */}
      <div
        className={`relative w-full ${maxWidthStyles[maxWidth]} rounded-3xl bg-slate-900 border border-white/10 shadow-2xl p-6 sm:p-8 text-slate-100 z-10 animate-pop motion-reduce:animate-none`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <h2 id="modal-title" className="text-xl sm:text-2xl font-black tracking-tight text-white">
            {title}
          </h2>
          <button
            onClick={handleClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-xl text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
};
