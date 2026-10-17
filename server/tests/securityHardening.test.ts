import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { httpServer } from '../src/index.js';
import { io as Client, Socket } from 'socket.io-client';
import { AddressInfo } from 'net';
import { roomManager } from '../src/managers/RoomManager.js';
import { getGameEngine } from '../src/socket/roomHandlers.js';
import { resetRateLimits } from '../src/middleware/rateLimiter.js';
import { getAllowedOrigins } from '../src/config/env.js';
import { redactSensitiveData } from '../src/utils/logger.js';
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@mind-clash/shared';

type TestSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

function waitForEvent<T>(
  socket: TestSocket,
  eventName: keyof ServerToClientEvents,
  timeoutMs = 8000
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`waitForEvent('${String(eventName)}') timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const handler = (data: unknown) => {
      clearTimeout(timer);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socket.off(eventName as any, handler as any);
      resolve(data as T);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.on(eventName as any, handler as any);
  });
}

describe('Phase 9: Security and Reliability Hardening Tests', () => {
  let port: number;
  const connectedSockets: TestSocket[] = [];

  const createClientSocket = (): TestSocket => {
    const socket = Client(`http://localhost:${port}`, {
      transports: ['websocket'],
      forceNew: true,
      autoConnect: true,
    }) as TestSocket;
    connectedSockets.push(socket);
    return socket;
  };

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        port = (httpServer.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    connectedSockets.forEach((s) => {
      if (s.connected) s.disconnect();
    });
    roomManager.clearAll();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  beforeEach(() => {
    resetRateLimits();
  });

  it('1. Host Authorization: Unauthorized users cannot start games, modify settings, or kick players', async () => {
    const hostSocket = createClientSocket();
    const guestSocket = createClientSocket();
    const rogueSocket = createClientSocket();

    let roomCode = '';
    let hostPlayerId = '';

    // Create room with Host
    await new Promise<void>((resolve) => {
      hostSocket.emit(
        'create_room',
        { nickname: 'HostPlayer', avatar: 'host-avatar' },
        (res) => {
          expect(res.success).toBe(true);
          if (res.success && res.data) {
            roomCode = res.data.roomCode;
            hostPlayerId = res.data.playerId;
          }
          resolve();
        }
      );
    });

    // Guest joins room
    await new Promise<void>((resolve) => {
      guestSocket.emit(
        'join_room',
        { roomCode, nickname: 'GuestPlayer', avatar: 'guest-avatar' },
        (res) => {
          expect(res.success).toBe(true);
          resolve();
        }
      );
    });

    // A. Guest (non-host) attempts to start game -> MUST FAIL
    await new Promise<void>((resolve) => {
      guestSocket.emit('start_game', (res) => {
        expect(res.success).toBe(false);
        expect(res.error).toBe('Only the host can start the game');
        resolve();
      });
    });

    // B. Rogue socket (not in room) attempts to start game -> MUST FAIL
    await new Promise<void>((resolve) => {
      rogueSocket.emit('start_game', (res) => {
        expect(res.success).toBe(false);
        expect(res.error).toBe('Room not found');
        resolve();
      });
    });

    // C. Guest attempts to update room settings -> MUST FAIL
    await new Promise<void>((resolve) => {
      guestSocket.emit(
        'update_settings',
        { settings: { roundCount: 15 } },
        (res) => {
          expect(res.success).toBe(false);
          expect(res.error).toBe('Only the host can modify room settings');
          resolve();
        }
      );
    });

    // D. Guest attempts to kick Host -> MUST FAIL
    await new Promise<void>((resolve) => {
      guestSocket.emit(
        'kick_player',
        { targetPlayerId: hostPlayerId },
        (res) => {
          expect(res.success).toBe(false);
          expect(res.error).toBe('Only the room host has permission to kick players');
          resolve();
        }
      );
    });

    // E. Host attempts to kick themselves -> MUST FAIL
    await new Promise<void>((resolve) => {
      hostSocket.emit(
        'kick_player',
        { targetPlayerId: hostPlayerId },
        (res) => {
          expect(res.success).toBe(false);
          expect(res.error).toBe('Host cannot kick themselves');
          resolve();
        }
      );
    });

    // Verify room state is still in LOBBY and both players remain
    const currentRoom = roomManager.getRoom(roomCode);
    expect(currentRoom?.status).toBe('LOBBY');
    expect(currentRoom?.players.length).toBe(2);
    expect(currentRoom?.settings.roundCount).toBe(5); // Default intact
  });

  it('2. Anti-Impersonation: Client cannot submit answers on behalf of another player or alter scores', async () => {
    const hostSocket = createClientSocket();
    const guestSocket = createClientSocket();
    const outsiderSocket = createClientSocket();

    let roomCode = '';
    let hostPlayerId = '';

    await new Promise<void>((resolve) => {
      hostSocket.emit(
        'create_room',
        { nickname: 'HostPlayer2', avatar: 'host-avatar' },
        (res) => {
          expect(res.success).toBe(true);
          if (res.success && res.data) {
            roomCode = res.data.roomCode;
            hostPlayerId = res.data.playerId;
          }
          resolve();
        }
      );
    });

    await new Promise<void>((resolve) => {
      guestSocket.emit(
        'join_room',
        { roomCode, nickname: 'GuestPlayer2', avatar: 'guest-avatar' },
        (res) => {
          expect(res.success).toBe(true);
          resolve();
        }
      );
    });

    // Set trivia mode only for deterministic challenge
    await new Promise<void>((resolve) => {
      hostSocket.emit(
        'update_settings',
        { settings: { roundCount: 5, selectedModes: ['trivia'] } },
        (res) => {
          expect(res.success).toBe(true);
          resolve();
        }
      );
    });

    // Host starts game
    const roundStartedPromise = waitForEvent(hostSocket, 'round_started', 8000);
    await new Promise<void>((resolve) => {
      hostSocket.emit('start_game', (res) => {
        expect(res.success).toBe(true);
        resolve();
      });
    });
    await roundStartedPromise;

    // A. Outsider socket attempts to submit answer -> MUST FAIL
    await new Promise<void>((resolve) => {
      outsiderSocket.emit(
        'submit_trivia_answer',
        { answerIndex: 0, clientTimeMs: Date.now() },
        (res) => {
          expect(res.success).toBe(false);
          expect(res.error).toBe('Player not in an active room');
          resolve();
        }
      );
    });

    // B. Guest attempts to submit answer injecting host's playerId or arbitrary score
    // Even if client injects unauthorized fields in the payload, server identifies submitter solely by socket.id
    // and calculates score authoritatively
    await new Promise<void>((resolve) => {
      guestSocket.emit(
        'submit_trivia_answer',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { answerIndex: 1, clientTimeMs: Date.now(), playerId: hostPlayerId, score: 99999 } as any,
        (res) => {
          expect(res.success).toBe(true);
          resolve();
        }
      );
    });

    const activeRoom = roomManager.getRoom(roomCode)!;
    const engine = getGameEngine();
    const submissions = engine.getSubmissions(roomCode);

    // Verify submission was credited to guestSocket (GuestPlayer2), NOT Host
    expect(submissions?.has(guestSocket.id)).toBe(true);
    expect(submissions?.has(hostSocket.id)).toBe(false);

    // Host has not submitted, so host score remains 0
    const hostInRoom = activeRoom.players.find((p) => p.id === hostPlayerId);
    expect(hostInRoom?.score).toBe(0);

    // C. Guest attempts duplicate submission in the same round -> MUST FAIL
    await new Promise<void>((resolve) => {
      guestSocket.emit(
        'submit_trivia_answer',
        { answerIndex: 2, clientTimeMs: Date.now() },
        (res) => {
          expect(res.success).toBe(false);
          expect(res.error).toBe('Answer already submitted for this round');
          resolve();
        }
      );
    });
  }, 12000);

  it('3. Tiered Rate Limiting: Blocks flood of room actions and gameplay submissions', async () => {
    const floodSocket = createClientSocket();

    // Max 8 room actions allowed per 10s window. The 9th must fail with rate limit error.
    let rateLimited = false;
    for (let i = 0; i < 9; i++) {
      await new Promise<void>((resolve) => {
        floodSocket.emit(
          'create_room',
          { nickname: `SpamBot${i}`, avatar: 'avatar' },
          (res) => {
            if (!res.success && res.error?.includes('Too many requests')) {
              rateLimited = true;
            }
            resolve();
          }
        );
      });
    }

    expect(rateLimited).toBe(true);
  });

  it('4. Zod Schema Validation: Rejects malformed and bounded inputs with safe error messages', async () => {
    const testSocket = createClientSocket();

    // Nickname too short
    await new Promise<void>((resolve) => {
      testSocket.emit(
        'create_room',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { nickname: 'A', avatar: 'avatar' } as any,
        (res) => {
          expect(res.success).toBe(false);
          expect(res.error).toBe('Nickname must be at least 2 characters');
          resolve();
        }
      );
    });

    // Nickname too long
    await new Promise<void>((resolve) => {
      testSocket.emit(
        'create_room',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { nickname: 'ThisNicknameIsWayTooLongForMindClash', avatar: 'avatar' } as any,
        (res) => {
          expect(res.success).toBe(false);
          expect(res.error).toBe('Nickname must not exceed 20 characters');
          resolve();
        }
      );
    });

    // Malformed memory sequence exceeding bounded max limit (30 items)
    await new Promise<void>((resolve) => {
      testSocket.emit(
        'submit_memory_tiles',
        {
          selectedIndices: Array.from({ length: 35 }, (_, i) => i),
          clientTimeMs: Date.now(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        (res) => {
          expect(res.success).toBe(false);
          expect(res.error).toBe('Invalid submission payload');
          resolve();
        }
      );
    });

    // Malformed clock sync ping (NaN or string)
    let pingAcked = false;
    testSocket.emit(
      'ping_clock',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'not-a-number' as any,
      () => {
        pingAcked = true;
      }
    );
    await new Promise((r) => setTimeout(r, 200));
    expect(pingAcked).toBe(false);
  });

  it('5. Production CORS & Secret Redaction: Disallows wildcards in production and scrubs credentials', () => {
    // Development allows wildcard or specified origins
    const devOrigins = getAllowedOrigins('http://localhost:5173, *', false);
    expect(devOrigins).toContain('*');

    // Production strictly strips wildcard '*'
    const prodOrigins = getAllowedOrigins('http://mindclash.game, *', true);
    expect(prodOrigins).not.toContain('*');
    expect(prodOrigins).toContain('http://mindclash.game');

    // Redaction utility scrubs sensitive fields
    const sensitiveData = {
      user: 'player1',
      sessionToken: '12345678-1234-4234-8234-123456789abc',
      nested: {
        password: 'supersecretpassword',
        auth: { authorization: 'Bearer token123' },
      },
    };

    const redacted = redactSensitiveData(sensitiveData);
    expect(redacted.sessionToken).toBe('[REDACTED]');
    expect(redacted.nested.password).toBe('[REDACTED]');
    expect(redacted.nested.auth.authorization).toBe('[REDACTED]');
    expect(redacted.user).toBe('player1');
  });

  it('6. Inactive Room Periodic Sweeper: Automatically purges idle rooms without lingering references', async () => {
    // Create an idle room manually
    const { room, sessionToken } = roomManager.createRoom('idle-socket-1', {
      nickname: 'IdlePlayer',
      avatar: 'avatar',
    });

    expect(roomManager.getRoom(room.roomCode)).toBeDefined();

    // Fast-forward lastActivityAt to 20 minutes ago
    room.lastActivityAt = Date.now() - 20 * 60 * 1000;

    // Purge with maxIdle 15 minutes
    const purged = roomManager.purgeInactiveRooms(15 * 60 * 1000);
    expect(purged).toContain(room.roomCode);

    // Verify room and session mappings are destroyed
    expect(roomManager.getRoom(room.roomCode)).toBeUndefined();
    expect(roomManager.getRoomBySocketId('idle-socket-1')).toBeUndefined();

    // Reconnecting to purged room should fail
    const testSocket = createClientSocket();
    await new Promise<void>((resolve) => {
      testSocket.emit(
        'reconnect_player',
        { roomCode: room.roomCode, sessionToken },
        (res) => {
          expect(res.success).toBe(false);
          expect(res.error).toBe('Room not found or server was restarted');
          resolve();
        }
      );
    });
  });
});

