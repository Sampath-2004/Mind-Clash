import React, { useEffect } from 'react';
import { sounds } from '../../audio/soundEffects';

interface CountdownTimerProps {
  durationMs: number;
  remainingMs: number;
  size?: number;
  strokeWidth?: number;
  playTicks?: boolean;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  durationMs,
  remainingMs,
  size = 72,
  strokeWidth = 6,
  playTicks = false,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progressRatio = Math.max(0, Math.min(1, remainingMs / durationMs));
  const strokeDashoffset = circumference * (1 - progressRatio);
  const secondsLeft = Math.ceil(remainingMs / 1000);

  // Play ticking audio when <= 5 seconds remain
  useEffect(() => {
    if (playTicks && secondsLeft > 0 && secondsLeft <= 4) {
      sounds.playTick(secondsLeft === 1 ? 1100 : 880);
    }
  }, [secondsLeft, playTicks]);

  // Color shifting depending on urgency
  let strokeColor = '#06B6D4'; // Cyan
  if (progressRatio <= 0.25) {
    strokeColor = '#F43F5E'; // Rose
  } else if (progressRatio <= 0.5) {
    strokeColor = '#F59E0B'; // Amber
  }

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90 transform" viewBox={`0 0 ${size} ${size}`}>
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Animated countdown ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          fill="transparent"
          className="transition-all duration-100 ease-linear motion-reduce:transition-none"
        />
      </svg>

      {/* Numerical seconds label */}
      <div className="absolute inset-0 flex items-center justify-center flex-col">
        <span
          className={`font-black font-mono leading-none ${
            size > 80 ? 'text-3xl' : 'text-xl'
          } ${
            progressRatio <= 0.25
              ? 'text-rose-400 animate-pulse motion-reduce:animate-none'
              : 'text-white'
          }`}
        >
          {secondsLeft}
        </span>
        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
          sec
        </span>
      </div>
    </div>
  );
};
