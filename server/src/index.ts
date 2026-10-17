import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ClientToServerEvents, ServerToClientEvents, SocketData } from '@mind-clash/shared';
import { registerRoomHandlers } from './socket/roomHandlers.js';
import { roomManager } from './managers/RoomManager.js';
import { config } from './config/env.js';
import { logger } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Enable trust proxy for accurate IP and HTTPS protocol detection behind reverse proxies (Render, Railway, Cloudflare)
app.set('trust proxy', 1);

// Shared origin validation for Express and Socket.IO
const isOriginAllowed = (origin: string | undefined): boolean => {
  // Allow server-to-server, curl, and automated tests where origin header is absent
  if (!origin) return true;

  const normalized = origin.trim().replace(/\/+$/, '');

  if (config.isProduction) {
    if (config.allowedOrigins.includes(normalized)) {
      return true;
    }
    // Automatically accept origin matching Render web service (*.onrender.com)
    if (process.env.RENDER && /^https:\/\/[a-zA-Z0-9-]+\.onrender\.com$/.test(normalized)) {
      return true;
    }
    return false;
  }

  // In non-production, check allowedOrigins or allow wildcard
  if (config.allowedOrigins.includes(normalized) || config.allowedOrigins.includes('*')) {
    return true;
  }

  // Permit localhost matching server port in development
  if (normalized === `http://localhost:${config.port}` || normalized === `http://127.0.0.1:${config.port}`) {
    return true;
  }

  // Permit any private LAN IP origin in development (192.168.x.x, 10.x.x.x, 172.16-31.x.x, localhost, 127.0.0.1)
  if (
    /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(normalized) ||
    /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(normalized) ||
    /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(normalized) ||
    /^https?:\/\/localhost(:\d+)?$/.test(normalized) ||
    /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(normalized)
  ) {
    return true;
  }

  return false;
};

// 1. Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        connectSrc: ["'self'", ...config.allowedOrigins, 'ws:', 'wss:'],
        imgSrc: ["'self'", 'data:', 'blob:'],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// 2. Strict CORS Configuration
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS Policy: Origin ${origin} not permitted`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
};

app.use(cors(corsOptions));

// 3. Payload size limiting to prevent payload-based Denial of Service
app.use(express.json({ limit: config.maxPayloadBytes }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (!config.isTest) {
    logger.info(`HTTP ${req.method} ${req.url}`);
  }
  next();
});

// 4. Health check endpoints
const healthHandler = (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    environment: config.nodeEnv,
  });
};

app.get('/api/health', healthHandler);
app.get('/health', healthHandler);

// 5. Serve static client bundle if it exists (for unified production deployment)
const findClientDistPath = (): string | null => {
  const candidates = [
    process.env.CLIENT_DIST_PATH,
    path.resolve(__dirname, '../../client/dist'),
    path.resolve(__dirname, '../client/dist'),
    path.resolve(process.cwd(), 'client/dist'),
    path.resolve(process.cwd(), '../client/dist'),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }
  return null;
};

const clientDistPath = findClientDistPath();
if (clientDistPath) {
  logger.info(`Serving static client bundle from: ${clientDistPath}`);
  app.use(express.static(clientDistPath));
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/socket.io') || req.path.startsWith('/api') || req.path.startsWith('/health')) {
      return next();
    }
    if (req.path.startsWith('/assets/')) {
      return res.status(404).send('Asset not found');
    }
    const indexPath = path.join(clientDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    next();
  });
} else {
  logger.warn('Frontend client dist bundle not found; static serving disabled.');
}

// 6. API 404 Handler
app.use('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'API route not found' });
});

// 7. Global Express Error Handler (Safe error messages without leaking internals)
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled Express error', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: config.isProduction ? 'An unexpected error occurred' : err.message,
  });
});

// 8. Socket.IO Gateway attached to HTTP server with size and CORS hardening
const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
  httpServer,
  {
    cors: {
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`Socket.IO CORS Policy: Origin ${origin} not permitted`));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    maxHttpBufferSize: config.maxSocketPayloadBytes, // Prevent socket payload resource exhaustion
    transports: ['websocket', 'polling'],
  }
);

io.on('connection', (socket) => {
  if (!config.isTest) {
    logger.info(`Socket connected: ${socket.id}`);
  }

  // Register real-time room lifecycle event handlers
  registerRoomHandlers(io, socket);
});

// 9. Start periodic idle room background sweeper
roomManager.startPeriodicSweep(60_000, config.maxRoomIdleMs);

// 10. Graceful Shutdown Handler
function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Stop periodic sweep
  roomManager.stopPeriodicSweep();

  // Close Socket.IO clients first
  io.disconnectSockets(true);
  io.close(() => {
    logger.info('Socket.IO server closed.');
  });

  // Close HTTP server
  httpServer.close((err) => {
    if (err) {
      logger.error('Error during HTTP server close', err);
      process.exit(1);
    }
    logger.info('HTTP server closed gracefully. Exiting process.');
    process.exit(0);
  });

  // Force exit if hanging
  setTimeout(() => {
    logger.error('Forced shutdown after 5s timeout.');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (!config.isTest || process.env.PLAYWRIGHT_TEST === 'true') {
  httpServer.listen(config.port, '0.0.0.0', () => {
    logger.info(`Mind Clash Server listening on 0.0.0.0:${config.port}`, {
      origins: config.allowedOrigins,
      environment: config.nodeEnv,
    });
  });
}

export { app, httpServer, io };
