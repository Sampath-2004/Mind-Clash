# 🧠 Mind Clash

> Real-time competitive multiplayer cognitive arena built from scratch. Compete with friends, classmates, or family across Trivia, Speed Math, Memory Matrix, and Reaction Clash — no login, no downloads, instant 6-character room codes.

---

## 🚀 Key Features

- **Multiplayer Networking**: Real-time room-based synchronized gameplay using Socket.IO.
- **Server Authoritative**: Anti-cheat validation, server-managed round timers, and server-side answer verification.
- **Four Game Modes**:
  - 📚 **Trivia**: Rapid-fire multiple choice with speed bonus points.
  - 🔢 **Speed Math**: Procedural arithmetic challenges with integer solutions.
  - 🧩 **Memory Matrix**: Memorize and reproduce randomized grid patterns.
  - ⚡ **Reaction Clash**: Reflex showdown with millisecond tracking and false-start penalties.
- **Session Recovery & Reconnection**: Seamless reconnect within 60s via persistent session tokens without losing scores.
- **Host Controls & Migration**: Create rooms, customize rounds (3–10) and game modes, kick players, and automatic host migration if host leaves.
- **Zero Login Friction**: Nickname + avatar selection with instant 6-character room code joining.
- **Dark Arcade Aesthetics**: Glassmorphism, neon accents, tactile micro-animations, and responsive mobile-first UI.

---

## 🛠️ Architecture & Monorepo Structure

Built as an npm workspaces monorepo with strict TypeScript:

```
Mind-Clash/
├── shared/                 # Reusable TypeScript models, constants, and Zod schemas
│   ├── src/constants.ts    # Room limits, timing defaults, scoring formulas
│   ├── src/types/          # Player, Room, Challenge, and Score types
│   ├── src/events.ts       # Typed Socket.IO Client-to-Server & Server-to-Client events
│   └── src/schemas/        # Zod validation schemas for all incoming payloads
├── server/                 # Node.js + Express + Socket.IO backend
│   ├── src/index.ts        # Server entry, CORS, graceful shutdown, health endpoints
│   └── tests/              # Vitest test suite for endpoints & socket lifecycle
└── client/                 # React 18 + Vite + Tailwind CSS frontend
    ├── src/App.tsx         # Connection testbed, socket status, latency telemetry
    ├── src/socket.ts       # Typed Socket.IO client instance
    └── tailwind.config.js  # Dark arcade theme tokens and micro-animation keyframes
```

---

## 📋 Prerequisites

- **Node.js**: v18+ or v20+ / v22+ LTS (Verified on Node.js v24)
- **npm**: v9+ (Verified on npm v11)
- **Operating System**: Windows / macOS / Linux

---

## 💻 Exact Windows PowerShell Commands

### 1. Installation
Clone the repository and install dependencies across all workspaces:

```powershell
cd c:\Users\PSK\Documents\GitHub\Mind-Clash
npm install
```

### 2. Run in Development Mode
Starts both the Express + Socket.IO backend and the Vite frontend concurrently with hot reload:

```powershell
npm run dev
```

- **Frontend UI**: [http://localhost:5173](http://localhost:5173)
- **Backend API & Health**: [http://localhost:3001/api/health](http://localhost:3001/api/health)
- **Socket.IO Gateway**: `http://localhost:3001/socket.io`

*(To run them in separate terminals if preferred)*:
```powershell
# Terminal 1: Backend Server (port 3001)
npm run dev:server

# Terminal 2: Frontend Client (port 5173)
npm run dev:client
```

### 3. Run Quality Assurance Commands

#### TypeScript Type Check (All Workspaces):
```powershell
npm run typecheck
```

#### Linting (ESLint 9 Flat Config):
```powershell
npm run lint
```

#### Automated Tests (Vitest):
```powershell
npm run test
```

### 4. Production Build & Execution
Builds the entire monorepo and runs the single-port production server:

```powershell
# 1. Build shared types, client static bundle, and server
npm run build

# 2. Start the unified production server (serves frontend + backend on port 3001)
npm start
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env`:

```powershell
Copy-Item .env.example .env
```

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3001` | Port for the Express + Socket.IO server |
| `NODE_ENV` | `development` | Environment mode (`development` or `production`) |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Explicit allowed origin(s) for CORS (comma-separated) |
| `VITE_BACKEND_URL` | *(empty)* | Optional client override for remote backend deployments |

---

## 🌐 Production Deployment

Mind Clash is designed for single-port zero-CORS production hosting:
- In production (`NODE_ENV=production`), Express automatically serves the pre-compiled `client/dist` static assets and handles single-page app (SPA) fallback routing.
- Can be deployed directly to **Render**, **Railway**, **Fly.io**, or **Docker** using:
  - Build command: `npm run build`
  - Start command: `npm start`
