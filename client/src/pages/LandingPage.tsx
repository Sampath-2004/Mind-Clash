import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusCircle, LogIn, HelpCircle, Sparkles, Brain, Calculator, Grid, Zap, ShieldCheck } from 'lucide-react';
import { Logo } from '../components/common/Logo';
import { Modal } from '../components/common/Modal';
import { sounds } from '../audio/soundEffects';
import { useGame } from '../context/GameStateContext';

export const LandingPage: React.FC = () => {
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const navigate = useNavigate();
  const { loadSampleRoom } = useGame();

  const handleLaunchDemo = () => {
    sounds.playClick();
    loadSampleRoom();
    navigate('/lobby');
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-between py-8 px-4 sm:px-6 max-w-6xl mx-auto space-y-12">
      {/* Hero Section */}
      <section className="flex flex-col items-center text-center space-y-6 pt-4 sm:pt-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-widest shadow-sm">
          <Sparkles className="w-3.5 h-3.5" />
          Zero Signup • Instant 6-Letter Codes • 2–10 Players
        </div>

        <Logo size="hero" />

        <p className="max-w-2xl text-base sm:text-xl text-slate-300 font-normal leading-relaxed">
          Battle friends, classmates, or family across real-time cognitive showdowns:{' '}
          <span className="text-cyan-400 font-semibold">Trivia</span>,{' '}
          <span className="text-purple-400 font-semibold">Speed Math</span>,{' '}
          <span className="text-emerald-400 font-semibold">Memory Matrix</span>, and{' '}
          <span className="text-amber-400 font-semibold">Reaction Clash</span>.
        </p>

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full max-w-md pt-2">
          <Link
            to="/create"
            onClick={() => sounds.playClick()}
            className="w-full sm:w-1/2 flex items-center justify-center gap-2 py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-cyan-500/25 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <PlusCircle className="w-5 h-5" />
            Create Room
          </Link>

          <Link
            to="/join"
            onClick={() => sounds.playClick()}
            className="w-full sm:w-1/2 flex items-center justify-center gap-2 py-4 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm uppercase tracking-wider border border-white/10 shadow-lg active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
          >
            <LogIn className="w-5 h-5 text-purple-400" />
            Join Room
          </Link>
        </div>

        {/* Secondary Auxiliary Controls */}
        <div className="flex items-center gap-4 text-xs font-semibold text-slate-400 pt-2">
          <button
            onClick={() => {
              sounds.playClick();
              setIsHowToPlayOpen(true);
            }}
            className="inline-flex items-center gap-1.5 hover:text-white transition"
          >
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            How to Play
          </button>
          <span>•</span>
          <button
            onClick={handleLaunchDemo}
            className="inline-flex items-center gap-1.5 hover:text-cyan-300 transition text-slate-300"
            title="Load mock room to inspect UI"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Preview Demo Room
          </button>
        </div>
      </section>

      {/* 4 Cognitive Modes Showcase Grid */}
      <section className="space-y-4">
        <div className="text-center">
          <h2 className="text-xs uppercase tracking-widest text-slate-500 font-bold">
            The 4 Cognitive Battlegrounds
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Trivia */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-cyan-500/20 hover:border-cyan-500/40 transition space-y-2 backdrop-blur-md">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Brain className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Trivia Blitz</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Fast-paced knowledge duels across science, history, and pop culture. Answer faster for speed bonus multipliers!
            </p>
          </div>

          {/* Math */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-purple-500/20 hover:border-purple-500/40 transition space-y-2 backdrop-blur-md">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Calculator className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Speed Math</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Procedurally generated mental arithmetic. Solve equations under intense clock pressure.
            </p>
          </div>

          {/* Memory */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-emerald-500/20 hover:border-emerald-500/40 transition space-y-2 backdrop-blur-md">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Grid className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Memory Matrix</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Pattern flashes on grid for 2.8s, then vanishes. Recall and tap tiles before time runs out.
            </p>
          </div>

          {/* Reaction */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-amber-500/20 hover:border-amber-500/40 transition space-y-2 backdrop-blur-md">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Reaction Clash</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Reflex showdown. Wait for the green flash to tap. Watch out for early false-start penalties!
            </p>
          </div>
        </div>
      </section>

      {/* Engineering Integrity Assurance Pill */}
      <footer className="pt-8 pb-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3 text-center sm:text-left">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Server-authoritative engine • Anti-cheat validation • Sub-50ms sync</span>
        </div>
        <p>© Mind Clash. Production-ready multiplayer web game.</p>
      </footer>

      {/* How to Play Modal */}
      <Modal
        isOpen={isHowToPlayOpen}
        onClose={() => setIsHowToPlayOpen(false)}
        title="How to Play Mind Clash"
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs sm:text-sm text-slate-300">
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/5 space-y-1">
            <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
              <span className="text-cyan-400">1.</span> Create or Join a Room
            </h4>
            <p className="text-slate-400">
              Pick your battle avatar and nickname. Hosts receive a 6-character room code to share with 2 to 10 players.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/5 space-y-1">
            <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
              <span className="text-purple-400">2.</span> Synchronized Rounds
            </h4>
            <p className="text-slate-400">
              Everyone faces the exact same challenge simultaneously. Each match lasts 5 rounds by default, alternating through the 4 modes.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/5 space-y-1">
            <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
              <span className="text-amber-400">3.</span> Speed & Accuracy Scoring
            </h4>
            <p className="text-slate-400">
              Points are calculated server-side. Correct answers score base points plus speed bonuses. Continuous streaks grant combo multipliers!
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/5 space-y-1">
            <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
              <span className="text-emerald-400">4.</span> Grand Podium Finale
            </h4>
            <p className="text-slate-400">
              At round 5, the top 3 players claim the podium with custom accolades: Speed Demon, Accuracy Master, and Calculation Beast!
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
