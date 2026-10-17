import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { GameStateProvider } from './context/GameStateContext';
import { Navbar } from './components/common/Navbar';
import { Modal } from './components/common/Modal';
import { LandingPage } from './pages/LandingPage';
import { CreateRoomPage } from './pages/CreateRoomPage';
import { JoinRoomPage } from './pages/JoinRoomPage';
import { LobbyPage } from './pages/LobbyPage';
import { GameArenaPage } from './pages/GameArenaPage';
import { RoundRecapPage } from './pages/RoundRecapPage';
import { PodiumPage } from './pages/PodiumPage';
import { ErrorReconnectPage } from './pages/ErrorReconnectPage';
import { Eye, ChevronRight } from 'lucide-react';
import { sounds } from './audio/soundEffects';

function AppContent() {
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [showDemoNav, setShowDemoNav] = useState(false);
  const location = useLocation();

  const allScreens = [
    { path: '/', label: '1. Landing' },
    { path: '/create', label: '2. Create Room' },
    { path: '/join', label: '3. Join Room' },
    { path: '/lobby', label: '4. Lobby' },
    { path: '/game', label: '5. Game Arena' },
    { path: '/recap', label: '6. Round Recap' },
    { path: '/podium', label: '7. Final Podium' },
    { path: '/error?type=disconnected', label: '8. Reconnect' },
  ];

  return (
    <div className="min-h-screen bg-clash-darkest text-slate-100 flex flex-col font-sans selection:bg-cyan-400 selection:text-slate-950">
      {/* Top Navigation */}
      <Navbar onOpenHowToPlay={() => setIsHowToPlayOpen(true)} />

      {/* Main Viewport Router */}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/create" element={<CreateRoomPage />} />
          <Route path="/join" element={<JoinRoomPage />} />
          <Route path="/lobby" element={<LobbyPage />} />
          <Route path="/game" element={<GameArenaPage />} />
          <Route path="/recap" element={<RoundRecapPage />} />
          <Route path="/podium" element={<PodiumPage />} />
          <Route path="/error" element={<ErrorReconnectPage />} />
        </Routes>
      </main>

      {/* Global How to Play Modal */}
      <Modal
        isOpen={isHowToPlayOpen}
        onClose={() => setIsHowToPlayOpen(false)}
        title="Mind Clash — Battle Guide"
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs sm:text-sm text-slate-300">
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-cyan-500/20 space-y-1">
            <h4 className="font-bold text-cyan-300 text-sm">Real-Time Synchronization</h4>
            <p className="text-slate-400">
              Every player views the exact same challenges with millisecond timestamp synchronization.
              Rounds are server-authoritative to eliminate cheating or fabricated client scores.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 space-y-1">
              <strong className="text-white block">Speed Math</strong>
              <p className="text-slate-400 text-xs">Solve arithmetic equations before the clock hits zero.</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 space-y-1">
              <strong className="text-white block">Trivia Blitz</strong>
              <p className="text-slate-400 text-xs">Fast answers grant up to 500 bonus points on top of base points.</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 space-y-1">
              <strong className="text-white block">Memory Matrix</strong>
              <p className="text-slate-400 text-xs">Recall the illuminated tile pattern accurately.</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 space-y-1">
              <strong className="text-white block">Reaction Clash</strong>
              <p className="text-slate-400 text-xs">Strike immediately when green appears. Avoid false starts!</p>
            </div>
          </div>
        </div>
      </Modal>

      {/* Floating Design System Navigator Pill (Allows rapid review of all 8 screens) */}
      <aside aria-label="Design system screen switcher" className="fixed bottom-4 left-4 z-40">
        {showDemoNav ? (
          <div className="glass-panel p-3 rounded-2xl shadow-2xl border border-cyan-500/30 max-w-xs space-y-2 animate-pop motion-reduce:animate-none">
            <div className="flex items-center justify-between pb-1 border-b border-white/10 text-xs font-bold text-white">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <Eye className="w-3.5 h-3.5" /> Design System Views
              </span>
              <button
                onClick={() => setShowDemoNav(false)}
                className="text-slate-400 hover:text-white px-1.5 py-0.5 text-[10px] rounded bg-white/5"
              >
                Hide
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px] font-semibold">
              {allScreens.map((s) => (
                <Link
                  key={s.path}
                  to={s.path}
                  onClick={() => {
                    sounds.playClick();
                    setShowDemoNav(false);
                  }}
                  className={`px-2 py-1.5 rounded-lg truncate transition ${
                    location.pathname === s.path.split('?')[0]
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-white/5 hover:bg-white/10 text-slate-300'
                  }`}
                >
                  {s.label}
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              sounds.playClick();
              setShowDemoNav(true);
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-full glass-panel border border-cyan-500/30 text-cyan-300 text-xs font-bold shadow-xl hover:bg-white/10 active:scale-95 transition"
            title="Switch between the 8 Phase 2 screens"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Screen Switcher (8 Views)</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </aside>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <GameStateProvider>
          <AppContent />
        </GameStateProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
