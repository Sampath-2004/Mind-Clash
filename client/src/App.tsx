import { useEffect, useState } from 'react';
import { socket } from './socket';
import { Wifi, WifiOff, Activity, ShieldCheck, Zap, RefreshCw } from 'lucide-react';

export default function App() {
  const [isConnected, setIsConnected] = useState<boolean>(socket.connected);
  const [socketId, setSocketId] = useState<string | null>(socket.id || null);
  const [latency, setLatency] = useState<number | null>(null);
  const [lastPingTime, setLastPingTime] = useState<string>('Never');
  const [backendHealth, setBackendHealth] = useState<'checking' | 'ok' | 'error'>('checking');

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
      setSocketId(socket.id || null);
      measurePing();
    }

    function onDisconnect() {
      setIsConnected(false);
      setSocketId(null);
    }

    // Check backend health endpoint
    fetch('/api/health')
      .then((res) => {
        if (res.ok) setBackendHealth('ok');
        else setBackendHealth('error');
      })
      .catch(() => setBackendHealth('error'));

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const measurePing = () => {
    const start = Date.now();
    fetch('/api/health')
      .then(() => {
        const ping = Date.now() - start;
        setLatency(ping);
        setLastPingTime(new Date().toLocaleTimeString());
      })
      .catch(() => {
        setLatency(null);
      });
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 selection:bg-clash-cyan selection:text-black">
      <div className="w-full max-w-lg space-y-6">
        {/* Header Hero */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-clash-cyan/10 border border-clash-cyan/20 text-clash-cyan text-xs font-semibold uppercase tracking-wider">
            <Zap className="w-3.5 h-3.5" />
            Phase 0 Verification
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white">
            Mind <span className="text-transparent bg-clip-text bg-gradient-to-r from-clash-cyan via-clash-purple to-clash-amber">Clash</span>
          </h1>
          <p className="text-slate-400 text-sm sm:text-base">
            Real-time multiplayer cognitive arena architecture & networking testbed
          </p>
        </div>

        {/* Live Network & Socket Status Card */}
        <div className="glass-panel p-6 rounded-2xl shadow-2xl relative overflow-hidden space-y-5">
          {/* Status Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  isConnected
                    ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/30'
                }`}
              >
                {isConnected ? <Wifi className="w-5 h-5 animate-pulse" /> : <WifiOff className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  Socket.IO Real-Time Gateway
                </h2>
                <p className="text-xs text-slate-400">
                  Authoritative WebSocket channel with auto-fallback
                </p>
              </div>
            </div>

            <span
              id="socket-status-badge"
              className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5 ${
                isConnected
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 glow-cyan'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'
                }`}
              />
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Telemetry Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="glass-card p-3 rounded-xl space-y-1">
              <span className="text-slate-400 font-medium">Socket ID</span>
              <p className="font-mono text-slate-200 truncate font-semibold" title={socketId || 'None'}>
                {socketId ? socketId : 'Connecting...'}
              </p>
            </div>

            <div className="glass-card p-3 rounded-xl space-y-1">
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-clash-cyan" /> Latency Ping
              </span>
              <p className="font-mono text-emerald-400 font-semibold">
                {latency !== null ? `${latency} ms` : 'Measuring...'}
              </p>
            </div>

            <div className="glass-card p-3 rounded-xl space-y-1">
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-clash-purple" /> REST API Health
              </span>
              <p
                className={`font-semibold capitalize ${
                  backendHealth === 'ok'
                    ? 'text-emerald-400'
                    : backendHealth === 'checking'
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {backendHealth === 'ok' ? 'Healthy (200 OK)' : backendHealth}
              </p>
            </div>

            <div className="glass-card p-3 rounded-xl space-y-1">
              <span className="text-slate-400 font-medium">Last Measured</span>
              <p className="font-mono text-slate-300 font-semibold">{lastPingTime}</p>
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-2 flex gap-3">
            <button
              id="refresh-ping-btn"
              onClick={measurePing}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-xs font-semibold text-slate-200 border border-white/10"
            >
              <RefreshCw className="w-3.5 h-3.5 text-clash-cyan" />
              Test Connection Latency
            </button>
          </div>
        </div>

        {/* Phase 0 Checklist */}
        <div className="glass-card p-4 rounded-xl border border-white/5 text-xs space-y-2">
          <p className="font-semibold text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-clash-cyan" />
            Verified Architecture Components
          </p>
          <div className="grid grid-cols-2 gap-2 text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-400">✓</span> React 18 + Vite Frontend
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-400">✓</span> Express + Socket.IO Backend
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-400">✓</span> Shared TypeScript Contracts
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-400">✓</span> Tailwind CSS Arcade Palette
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
