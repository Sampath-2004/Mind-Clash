import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z
    .string()
    .default('3001')
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0 && val < 65536, {
      message: 'PORT must be a valid port number (1-65535)',
    }),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  CLIENT_ORIGIN: z
    .string()
    .default('http://localhost:5173'),
  MAX_ROOM_IDLE_MINUTES: z
    .string()
    .default('15')
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val >= 1, {
      message: 'MAX_ROOM_IDLE_MINUTES must be >= 1',
    }),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`[Config Error] Invalid environment configuration:\n${issues}`);
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
}

const env = parsedEnv.success
  ? parsedEnv.data
  : {
      PORT: 3001,
      NODE_ENV: 'test' as const,
      CLIENT_ORIGIN: 'http://localhost:5173',
      MAX_ROOM_IDLE_MINUTES: 15,
    };

export function getAllowedOrigins(
  rawOrigin: string = env.CLIENT_ORIGIN,
  isProd: boolean = env.NODE_ENV === 'production',
  port: number = env.PORT
): string[] {
  const list = rawOrigin
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (process.env.RENDER_EXTERNAL_URL) {
    const renderUrl = process.env.RENDER_EXTERNAL_URL.trim().replace(/\/$/, '');
    if (!list.includes(renderUrl)) list.push(renderUrl);
  }
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    const railwayUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN.trim()}`.replace(/\/$/, '');
    if (!list.includes(railwayUrl)) list.push(railwayUrl);
  }

  if (!isProd) {
    const localServer = `http://localhost:${port}`;
    const ipServer = `http://127.0.0.1:${port}`;
    if (!list.includes(localServer)) list.push(localServer);
    if (!list.includes(ipServer)) list.push(ipServer);
  }

  if (isProd) {
    // In production, forbid wildcard '*'
    const sanitized = list.filter((origin) => origin !== '*');
    if (sanitized.length === 0) {
      console.warn('[Security Warning] Production CLIENT_ORIGIN cannot be wildcard or empty. Falling back to localhost.');
      return ['http://localhost:5173', `http://localhost:${port}`];
    }
    return sanitized;
  }

  return list.length > 0 ? list : ['http://localhost:5173', `http://localhost:${port}`];
}

export const config = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  allowedOrigins: getAllowedOrigins(env.CLIENT_ORIGIN, env.NODE_ENV === 'production'),
  maxRoomIdleMs: env.MAX_ROOM_IDLE_MINUTES * 60 * 1000,
  maxPayloadBytes: 16 * 1024, // 16 KB for Express HTTP payloads
  maxSocketPayloadBytes: 10 * 1024, // 10 KB for Socket.IO messages
};
