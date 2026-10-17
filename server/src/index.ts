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

  // Always permit same-origin requests matching server port
  if (origin === `http://localhost:${config.port}` || origin === `http://127.0.0.1:${config.port}`) {
    return true;
  }

  if (config.isProduction) {
    return config.allowedOrigins.includes(origin);
  }

  // In non-production, check allowedOrigins or allow wildcard
  return config.allowedOrigins.includes(origin) || config.allowedOrigins.includes('*');
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
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/socket.io') || req.path.startsWith('/api') || req.path.startsWith('/health')) {
      return next();
    }
    const indexPath = path.join(clientDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    next();
  });
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

if (!config.isTest) {
  httpServer.listen(config.port, () => {
    logger.info(`Mind Clash Server listening on port ${config.port}`, {
      origins: config.allowedOrigins,
      environment: config.nodeEnv,
    });
  });
}

export { app, httpServer, io };
