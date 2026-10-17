const SENSITIVE_KEYS = new Set([
  'sessiontoken',
  'newsessiontoken',
  'token',
  'secret',
  'password',
  'authorization',
  'cookie',
  'set-cookie',
]);

/**
 * Deeply clones and redacts sensitive field values from objects.
 */
export function redactSensitiveData<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // Redact UUID session tokens if embedded directly in strings (e.g. log messages)
    return obj.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
      '[REDACTED_UUID]'
    ) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const copy: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        copy[key] = '[REDACTED]';
      } else {
        copy[key] = redactSensitiveData(value);
      }
    }
    return copy as T;
  }

  return obj;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class StructuredLogger {
  private formatLog(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message: typeof message === 'string' ? redactSensitiveData(message) : message,
      ...(meta ? { meta: redactSensitiveData(meta) } : {}),
    };
    return JSON.stringify(logEntry);
  }

  public debug(message: string, meta?: Record<string, unknown>) {
    if (process.env.NODE_ENV !== 'test' && process.env.DEBUG) {
      console.debug(this.formatLog('debug', message, meta));
    }
  }

  public info(message: string, meta?: Record<string, unknown>) {
    if (process.env.NODE_ENV !== 'test') {
      console.log(this.formatLog('info', message, meta));
    }
  }

  public warn(message: string, meta?: Record<string, unknown>) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(this.formatLog('warn', message, meta));
    }
  }

  public error(message: string, error?: unknown, meta?: Record<string, unknown>) {
    if (process.env.NODE_ENV !== 'test') {
      const errMeta =
        error instanceof Error
          ? { errorMessage: error.message, errorName: error.name, ...meta }
          : { error, ...meta };
      console.error(this.formatLog('error', message, errMeta));
    }
  }
}

export const logger = new StructuredLogger();
