import React from 'react';
import { Zap } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'hero';
  showTagline?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', showTagline = false }) => {
  const sizes = {
    sm: { icon: 'w-5 h-5', text: 'text-lg', badge: 'text-[9px] px-1.5' },
    md: { icon: 'w-6 h-6', text: 'text-2xl', badge: 'text-[10px] px-2' },
    lg: { icon: 'w-8 h-8', text: 'text-3xl sm:text-4xl', badge: 'text-xs px-2.5' },
    hero: { icon: 'w-10 h-10', text: 'text-5xl sm:text-6xl', badge: 'text-xs px-3' },
  };

  return (
    <div className="inline-flex flex-col items-center select-none group">
      <div className="flex items-center gap-2.5">
        {/* Animated Cyber Brain Icon */}
        <div className="relative">
          <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 opacity-60 blur-sm group-hover:opacity-100 transition duration-300 motion-reduce:opacity-60" />
          <div className="relative flex items-center justify-center p-2.5 rounded-xl bg-slate-950 border border-cyan-500/40 text-cyan-400 shadow-inner">
            <Zap className={`${sizes[size].icon} text-cyan-400 group-hover:text-purple-300 transition-colors duration-300`} />
          </div>
        </div>

        {/* Brand Typography */}
        <div className="flex flex-col text-left">
          <div className="flex items-baseline gap-1.5">
            <span className={`font-black tracking-tight text-white ${sizes[size].text}`}>
              Mind
            </span>
            <span
              className={`font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-fuchsia-500 ${sizes[size].text}`}
            >
              Clash
            </span>
            <span
              className={`font-bold tracking-wider uppercase rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 ${sizes[size].badge}`}
            >
              v1.0
            </span>
          </div>
        </div>
      </div>

      {showTagline && (
        <p className="text-xs sm:text-sm text-slate-400 mt-2 font-medium tracking-wide text-center">
          Real-Time Competitive Cognitive Arena
        </p>
      )}
    </div>
  );
};
