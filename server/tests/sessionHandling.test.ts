import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { httpServer, io } from '../src/index.js';
import { io as Client, Socket } from 'socket.io-client';
import { AddressInfo } from 'net';
import { roomManager } from '../src/managers/RoomManager.js';
import { getGameEngine } from '../src/socket/roomHandlers.js';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomState,
  ServerResponseAck,
  ReconnectResponseData,
} from '@mind-clash/shared';

type TestSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

function ensureConnected(socket: TestSocket): Promise<void> {
  if (socket.connected) return Promise.resolve();
  return new Promise<void>((resolve) => {
    socket.once('connect', () => resolve());
  });
}

function waitForEvent<T>(socket: TestSocket, eventName: keyof ServerToClientEvents, timeoutMs = 5000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for event "${String(eventName)}" after ${timeoutMs}ms`));
    }, timeoutMs);

    socket.once(eventName as string, (data: unknown) => {
      clearTimeout(timer);
      resolve(data as T);
    });
  });
}

describe('Phase 8: Reliable Multiplayer Session Handling & Reconnection Tests', () => {
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
    getGameEngine()?.clearAll();
    io.close();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  beforeEach(() => {
    roomManager.clearAll();
    getGameEngine()?.clearAll();
  });

  it('1. Browser Refresh & Reconnection: Preserves authoritative score, prevents duplicate players, rotates token, and provides full snapshot', async () => {
    const hostSocket = createClientSocket();
    const player2Socket = createClientSocket();
    await Promise.all([ensureConnected(hostSocket), ensureConnected(player2Socket)]);

    // 1. Host creates room
    let roomCode = '';
    await new Promise<void>((resolve) => {
      hostSocket.emit(
        'create_room',
        { nickname: 'HostCaptain', avatar: 'cyber-brain' },
        (res: ServerResponseAck<{ roomCode: string; sessionToken: string; playerId: string }>) => {
          expect(res.success).toBe(true);
          roomCode = res.data!.roomCode;
          resolve();
        }
      );
    });

    // 2. Player 2 joins room
    let p2SessionToken = '';
    await new Promise<void>((resolve) => {
      player2Socket.emit(
        'join_room',
        { roomCode, nickname: 'QuantumChallenger', avatar: 'plasma-dragon' },
        (res: ServerResponseAck<{ roomCode: string; sessionToken: string; playerId: string }>) => {
          expect(res.success).toBe(true);
          p2SessionToken = res.data!.sessionToken;
          resolve();
        }
      );
    });

    // Verify room has exactly 2 players
    const currentRoom = roomManager.getRoom(roomCode);
    expect(currentRoom).toBeDefined();
    expect(currentRoom!.players.length).toBe(2);

    // 3. Start game
    const roundStartedPromise = waitForEvent<{ round: number; activeChallenge: unknown }>(
      player2Socket,
      'round_started',
      5000
    );

    await new Promise<void>((resolve) => {
      hostSocket.emit('start_game', (res) => {
        expect(res.success).toBe(true);
        resolve();
      });
    });

    const roundData = await roundStartedPromise;
    expect(roundData.round).toBe(1);
    expect(roundData.activeChallenge).toBeDefined();

    // 4. Player 2 submits answer and earns authoritative score
    await new Promise<void>((resolve) => {
      player2Socket.emit(
        'submit_trivia_answer',
        { answerIndex: 0, clientTimeMs: Date.now() },
        (res) => {
          expect(res.success).toBe(true);
          resolve();
        }
      );
    });

    // Manually set an authoritative score for player 2 to verify persistence across refresh
    const p2InRoom = currentRoom!.players.find((p) => p.sessionToken === p2SessionToken);
    expect(p2InRoom).toBeDefined();
    p2InRoom!.score = 750;
    p2InRoom!.streak = 3;

    // 5. Simulate browser refresh: disconnect old socket
    const p2DisconnectPromise = waitForEvent(hostSocket, 'player_disconnected');
    player2Socket.disconnect();
    await p2DisconnectPromise;
    expect(p2InRoom!.isConnected).toBe(false);

    // 6. Connect new socket (simulating new tab or refreshed page connection)
    const refreshedSocket = createClientSocket();
    await ensureConnected(refreshedSocket);

    let reconnectData: ReconnectResponseData | undefined;
    await new Promise<void>((resolve) => {
      refreshedSocket.emit(
        'reconnect_player',
        { roomCode, sessionToken: p2SessionToken },
        (res: ServerResponseAck<ReconnectResponseData>) => {
          expect(res.success).toBe(true);
          reconnectData = res.data;
          resolve();
        }
      );
    });

    expect(reconnectData).toBeDefined();
    // Verify no duplicate players: room still has exactly 2 players
    expect(reconnectData!.room.players.length).toBe(2);

    // Verify authoritative score, streak, and stats preserved
    const reconnectedPlayer = reconnectData!.room.players.find(
      (p) => p.id === refreshedSocket.id
    );
    expect(reconnectedPlayer).toBeDefined();
    expect(reconnectedPlayer!.nickname).toBe('QuantumChallenger');
    expect(reconnectedPlayer!.score).toBe(750);
    expect(reconnectedPlayer!.streak).toBe(3);
    expect(reconnectedPlayer!.isConnected).toBe(true);

    // Verify complete current-state snapshot restoration
    expect(reconnectData!.activeChallenge).toBeDefined();
    expect(reconnectData!.remainingMs).toBeTypeOf('number');

    // Verify token rotation: newSessionToken returned and different from old
    expect(reconnectData!.newSessionToken).toBeDefined();
    expect(reconnectData!.newSessionToken).not.toBe(p2SessionToken);

    // 7. Old session token must now be invalid (cannot be reused)
    const rogueSocket = createClientSocket();
    await ensureConnected(rogueSocket);

    await new Promise<void>((resolve) => {
      rogueSocket.emit(
        'reconnect_player',
        { roomCode, sessionToken: p2SessionToken },
        (res: ServerResponseAck<ReconnectResponseData>) => {
          expect(res.success).toBe(false);
          expect(res.error).toMatch(/Session token not recognized|expired/);
          resolve();
        }
      );
    });

    // 8. Reconnected player cannot re-submit answer for the same round (anti-duplicate scoring)
    await new Promise<void>((resolve) => {
      refreshedSocket.emit(
        'submit_trivia_answer',
        { answerIndex: 1, clientTimeMs: Date.now() },
        (res) => {
          expect(res.success).toBe(false);
          expect(res.error).toMatch(/already submitted/);
          resolve();
        }
      );
    });
  });

  it('2. Anti-Impersonation & Sensitive Credential Sanitization: Other players cannot snoop tokens', async () => {
    const hostSocket = createClientSocket();
    const player2Socket = createClientSocket();
    const attackerSocket = createClientSocket();
    await Promise.all([
      ensureConnected(hostSocket),
      ensureConnected(player2Socket),
      ensureConnected(attackerSocket),
    ]);

    let roomCode = '';
    await new Promise<void>((resolve) => {
      hostSocket.emit(
        'create_room',
        { nickname: 'HostPlayer', avatar: 'cyber-brain' },
        (res) => {
          roomCode = res.data!.roomCode;
          resolve();
        }
      );
    });

    // Setup listener on host to inspect broadcast room state when Player 2 joins
    const hostRoomUpdatePromise = waitForEvent<RoomState>(hostSocket, 'room_state_updated');

    await new Promise<void>((resolve) => {
      player2Socket.emit(
        'join_room',
        { roomCode, nickname: 'Valkyrie', avatar: 'plasma-dragon' },
        (res) => {
          expect(res.success).toBe(true);
          resolve();
        }
      );
    });

    const broadcastRoom = await hostRoomUpdatePromise;
    // CRITICAL: All player sessionTokens in public broadcasts must be redacted/empty
    broadcastRoom.players.forEach((p) => {
      expect(p.sessionToken).toBe('');
    });

    // Attacker attempts to impersonate with malformed token
    await new Promise<void>((resolve) => {
      attackerSocket.emit(
        'reconnect_player',
        { roomCode, sessionToken: 'invalid-non-uuid-string' },
        (res) => {
          expect(res.success).toBe(false);
          expect(res.error).toMatch(/Invalid session token format/);
          resolve();
        }
      );
    });

    // Attacker attempts to impersonate with valid but unrecognized UUID
    await new Promise<void>((resolve) => {
      attackerSocket.emit(
        'reconnect_player',
        { roomCode, sessionToken: '00000000-0000-0000-0000-000000000000' },
        (res) => {
          expect(res.success).toBe(false);
          expect(res.error).toMatch(/Session token not recognized/);
          resolve();
        }
      );
    });
  });

  it('3. Host Departure: Safely transfers host authority to connected player and preserves room authority', async () => {
    const hostSocket = createClientSocket();
    const player2Socket = createClientSocket();
    await Promise.all([ensureConnected(hostSocket), ensureConnected(player2Socket)]);

    let roomCode = '';
    let hostToken = '';
    await new Promise<void>((resolve) => {
      hostSocket.emit(
        'create_room',
        { nickname: 'OriginalHost', avatar: 'cyber-brain' },
        (res) => {
          roomCode = res.data!.roomCode;
          hostToken = res.data!.sessionToken;
          resolve();
        }
      );
    });

    await new Promise<void>((resolve) => {
      player2Socket.emit(
        'join_room',
        { roomCode, nickname: 'SecondPlayer', avatar: 'astro-bot' },
        (res) => {
          expect(res.success).toBe(true);
          resolve();
        }
      );
    });

    const room = roomManager.getRoom(roomCode);
    expect(room!.hostId).toBe(hostSocket.id);

    // Host disconnects
    const hostDisconnectPromise = waitForEvent(player2Socket, 'player_disconnected');
    hostSocket.disconnect();
    await hostDisconnectPromise;

    // Verify host authority transferred to Player 2
    expect(room!.hostId).toBe(player2Socket.id);
    const p2 = room!.players.find((p) => p.id === player2Socket.id);
    expect(p2!.isHost).toBe(true);

    // Original host reconnects with new socket
    const reconnectedHostSocket = createClientSocket();
    await ensureConnected(reconnectedHostSocket);

    await new Promise<void>((resolve) => {
      reconnectedHostSocket.emit(
        'reconnect_player',
        { roomCode, sessionToken: hostToken },
        (res) => {
          expect(res.success).toBe(true);
          resolve();
        }
      );
    });

    // Original host must NOT overwrite Player 2's host authority
    expect(room!.hostId).toBe(player2Socket.id);
    const originalHostReconnected = room!.players.find((p) => p.id === reconnectedHostSocket.id);
    expect(originalHostReconnected!.isHost).toBe(false);
  });

  it('4. Disconnect Grace Period & Purge on Expiry', async () => {
    const hostSocket = createClientSocket();
    const player2Socket = createClientSocket();
    await Promise.all([ensureConnected(hostSocket), ensureConnected(player2Socket)]);

    let roomCode = '';
    let p2Token = '';
    await new Promise<void>((resolve) => {
      hostSocket.emit(
        'create_room',
        { nickname: 'HostCaptain', avatar: 'cyber-brain' },
        (res) => {
          roomCode = res.data!.roomCode;
          resolve();
        }
      );
    });

    await new Promise<void>((resolve) => {
      player2Socket.emit(
        'join_room',
        { roomCode, nickname: 'ExpiringPlayer', avatar: 'solar-phoenix' },
        (res) => {
          p2Token = res.data!.sessionToken;
          resolve();
        }
      );
    });

    const room = roomManager.getRoom(roomCode);
    expect(room).toBeDefined();

    // Configure test grace period to 100ms
    roomManager.setGracePeriodMs(100);

    const p2DisconnectPromise = waitForEvent(hostSocket, 'player_disconnected');
    player2Socket.disconnect();
    await p2DisconnectPromise;

    const p2 = room!.players.find((p) => p.sessionToken === p2Token);
    expect(p2!.isConnected).toBe(false);
    expect(p2!.disconnectedAt).toBeTypeOf('number');

    // Wait for the 100ms grace period timer to fire
    await new Promise((r) => setTimeout(r, 160));

    // Player should now be purged from the room
    expect(room!.players.length).toBe(1);
    expect(room!.players.some((p) => p.sessionToken === p2Token)).toBe(false);

    // Attempting to reconnect with expired credentials must be rejected
    const newSocket = createClientSocket();
    await ensureConnected(newSocket);

    await new Promise<void>((resolve) => {
      newSocket.emit(
        'reconnect_player',
        { roomCode, sessionToken: p2Token },
        (res) => {
          expect(res.success).toBe(false);
          expect(res.error).toMatch(/Session token not recognized or grace period expired/);
          resolve();
        }
      );
    });
  });

  it('5. Honest Server Restart Handling: In-memory rooms cannot survive process restarts', async () => {
    const clientSocket = createClientSocket();
    await ensureConnected(clientSocket);

    let roomCode = '';
    let sessionToken = '';
    await new Promise<void>((resolve) => {
      clientSocket.emit(
        'create_room',
        { nickname: 'RestartTester', avatar: 'cyber-brain' },
        (res) => {
          roomCode = res.data!.roomCode;
          sessionToken = res.data!.sessionToken;
          resolve();
        }
      );
    });

    // Simulate server process restart: clear all in-memory state
    roomManager.clearAll();
    getGameEngine()?.clearAll();

    // Client attempts to reconnect to restarted server
    await new Promise<void>((resolve) => {
      clientSocket.emit(
        'reconnect_player',
        { roomCode, sessionToken },
        (res) => {
          expect(res.success).toBe(false);
          expect(res.error).toBe('Room not found or server was restarted');
          resolve();
        }
      );
    });
  });

  it('6. Inactive Room Expiration & Preventing Memory Leaks', async () => {
    const clientSocket = createClientSocket();
    await ensureConnected(clientSocket);

    let roomCode = '';
    await new Promise<void>((resolve) => {
      clientSocket.emit(
        'create_room',
        { nickname: 'IdleHost', avatar: 'cyber-brain' },
        (res) => {
          roomCode = res.data!.roomCode;
          resolve();
        }
      );
    });

    expect(roomManager.getRoom(roomCode)).toBeDefined();

    // Disconnect host and wait for disconnect to process
    clientSocket.disconnect();
    await new Promise((r) => setTimeout(r, 60));

    // Call purgeInactiveRooms with 0 maxIdleMs
    const purged = roomManager.purgeInactiveRooms(0);
    expect(purged).toContain(roomCode);
    expect(roomManager.getRoom(roomCode)).toBeUndefined();
  });
});
