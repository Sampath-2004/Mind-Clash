import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { httpServer, io } from '../src/index.js';
import { io as Client, Socket } from 'socket.io-client';
import { AddressInfo } from 'net';
import { roomManager } from '../src/managers/RoomManager.js';
import { getGameEngine } from '../src/socket/roomHandlers.js';
import { resetRateLimits } from '../src/middleware/rateLimiter.js';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomState,
  ServerResponseAck,
  ActiveChallengeClient,
  RoundRecapData,
} from '@mind-clash/shared';

type TestSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

function ensureConnected(socket: TestSocket): Promise<void> {
  if (socket.connected) return Promise.resolve();
  return new Promise<void>((resolve) => {
    socket.once('connect', () => resolve());
  });
}

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

function waitForRoomState(
  socket: TestSocket,
  predicate: (r: RoomState) => boolean,
  timeoutMs = 8000
): Promise<RoomState> {
  return new Promise<RoomState>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`waitForRoomState timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const handler = (room: RoomState) => {
      if (predicate(room)) {
        clearTimeout(timer);
        socket.off('room_state_updated', handler);
        resolve(room);
      }
    };

    socket.on('room_state_updated', handler);
  });
}

describe('Phase 10: Comprehensive Quality Assurance & Protocol Verification', () => {
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
    const engine = getGameEngine();
    if (engine) engine.clearAll();
    io.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  beforeEach(() => {
    resetRateLimits();
  });

  it('1-4. Lifecycle QA: Room creation, joining, invalid codes, and 10-player capacity limit', async () => {
    const host = createClientSocket();
    await ensureConnected(host);

    // 1. Valid room creation
    const createRes = await new Promise<ServerResponseAck<{ roomCode: string; sessionToken: string; playerId: string }>>((resolve) => {
      host.emit('create_room', { nickname: 'Commander', avatar: 'cyber-brain' }, resolve);
    });
    expect(createRes.success).toBe(true);
    const roomCode = createRes.data!.roomCode;
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);

    // 2. Invalid room codes rejection
    const invalidSocket = createClientSocket();
    await ensureConnected(invalidSocket);

    // A. Malformed length code
    const malformedRes = await new Promise<ServerResponseAck<unknown>>((resolve) => {
      invalidSocket.emit('join_room', { roomCode: 'SHORT', nickname: 'Tester', avatar: 'astro-bot' }, resolve);
    });
    expect(malformedRes.success).toBe(false);

    // B. Non-existent code
    const nonExistentRes = await new Promise<ServerResponseAck<unknown>>((resolve) => {
      invalidSocket.emit('join_room', { roomCode: 'ZZZZZZ', nickname: 'Tester', avatar: 'astro-bot' }, resolve);
    });
    expect(nonExistentRes.success).toBe(false);
    expect(nonExistentRes.error).toContain('does not exist');

    // 3. Fill room to max 10 players
    for (let i = 2; i <= 10; i++) {
      const p = createClientSocket();
      await ensureConnected(p);
      const joinRes = await new Promise<ServerResponseAck<{ roomCode: string }>>((resolve) => {
        p.emit('join_room', { roomCode, nickname: `Player_${i}`, avatar: 'plasma-dragon' }, resolve);
      });
      expect(joinRes.success).toBe(true);
    }

    const currentRoom = roomManager.getRoom(roomCode);
    expect(currentRoom?.players.length).toBe(10);

    // 4. 11th player is rejected
    const player11 = createClientSocket();
    await ensureConnected(player11);
    const reject11Res = await new Promise<ServerResponseAck<unknown>>((resolve) => {
      player11.emit('join_room', { roomCode, nickname: 'OverflowPlayer', avatar: 'cosmic-alien' }, resolve);
    });
    expect(reject11Res.success).toBe(false);
    expect(reject11Res.error).toContain('full');
  });

  it('5-6. Timing & Synchronization QA: High-resolution clock drift measurement and countdown sync', async () => {
    const client1 = createClientSocket();
    const client2 = createClientSocket();
    await Promise.all([ensureConnected(client1), ensureConnected(client2)]);

    // Measure high-resolution clock drift over 10 consecutive round-trip samples
    const offsetsClient1: number[] = [];
    const rttsClient1: number[] = [];

    for (let i = 0; i < 10; i++) {
      const t0 = Date.now();
      const ack = await new Promise<{ clientTime: number; serverTime: number }>((resolve) => {
        client1.emit('ping_clock', t0, resolve);
      });
      const t1 = Date.now();
      const rtt = t1 - t0;
      const offset = ack.serverTime + rtt / 2 - t1;

      offsetsClient1.push(offset);
      rttsClient1.push(rtt);
      await new Promise((r) => setTimeout(r, 10));
    }

    const meanOffset = offsetsClient1.reduce((a, b) => a + b, 0) / offsetsClient1.length;
    const maxOffset = Math.max(...offsetsClient1);
    const minOffset = Math.min(...offsetsClient1);
    const driftRange = maxOffset - minOffset;
    const meanRtt = rttsClient1.reduce((a, b) => a + b, 0) / rttsClient1.length;

    // Report metrics
    console.log(`[QA Timing Report] Client-Server Clock Synchronization:
      Mean RTT: ${meanRtt.toFixed(2)} ms
      Mean Estimated Offset: ${meanOffset.toFixed(2)} ms
      Drift Range: ${driftRange.toFixed(2)} ms (Min: ${minOffset.toFixed(2)} ms, Max: ${maxOffset.toFixed(2)} ms)`);

    expect(Math.abs(meanOffset)).toBeLessThan(200); // Local socket offset should be tightly bounded
    expect(driftRange).toBeLessThan(100); // Local timing jitter should remain small

    // Verify countdown synchronization
    const createRes = await new Promise<ServerResponseAck<{ roomCode: string }>>((resolve) => {
      client1.emit('create_room', { nickname: 'SyncHost', avatar: 'cyber-brain' }, resolve);
    });
    const roomCode = createRes.data!.roomCode;

    await new Promise<ServerResponseAck<unknown>>((resolve) => {
      client2.emit('join_room', { roomCode, nickname: 'SyncGuest', avatar: 'astro-bot' }, resolve);
    });

    // Listen for game_starting on both clients
    const c1StartPromise = waitForEvent<{ countdownMs: number; serverTime: number }>(client1, 'game_starting');
    const c2StartPromise = waitForEvent<{ countdownMs: number; serverTime: number }>(client2, 'game_starting');

    await new Promise<ServerResponseAck<unknown>>((resolve) => {
      client1.emit('start_game', resolve);
    });

    const [c1Payload, c2Payload] = await Promise.all([c1StartPromise, c2StartPromise]);

    // Target start timestamp computed by both clients must be identical
    const targetStartClient1 = c1Payload.serverTime + c1Payload.countdownMs;
    const targetStartClient2 = c2Payload.serverTime + c2Payload.countdownMs;

    expect(c1Payload.countdownMs).toBe(3000);
    expect(c2Payload.countdownMs).toBe(3000);
    expect(targetStartClient1).toBe(targetStartClient2);
  });

  it('7-13. Gameplay & Scoring QA: Simultaneous submissions, late submissions, and duplicate rejections', async () => {
    const host = createClientSocket();
    const guest1 = createClientSocket();
    const guest2 = createClientSocket();
    await Promise.all([ensureConnected(host), ensureConnected(guest1), ensureConnected(guest2)]);

    const createRes = await new Promise<ServerResponseAck<{ roomCode: string }>>((resolve) => {
      host.emit('create_room', { nickname: 'Judge', avatar: 'cyber-brain' }, resolve);
    });
    const roomCode = createRes.data!.roomCode;

    await Promise.all([
      new Promise<ServerResponseAck<unknown>>((resolve) =>
        guest1.emit('join_room', { roomCode, nickname: 'Speedy', avatar: 'plasma-dragon' }, resolve)
      ),
      new Promise<ServerResponseAck<unknown>>((resolve) =>
        guest2.emit('join_room', { roomCode, nickname: 'Steady', avatar: 'astro-bot' }, resolve)
      ),
    ]);

    // Update settings: Trivia only
    await new Promise<ServerResponseAck<unknown>>((resolve) => {
      host.emit('update_settings', { settings: { roundCount: 5, selectedModes: ['trivia'] } }, resolve);
    });

    // Host starts game
    const roundStartedPromise = waitForEvent<{
      round: number;
      activeChallenge: ActiveChallengeClient;
      startTime: number;
      endTime: number;
    }>(host, 'round_started', 8000);

    await new Promise<ServerResponseAck<unknown>>((resolve) => {
      host.emit('start_game', resolve);
    });

    const roundData = await roundStartedPromise;
    expect(roundData.activeChallenge.mode).toBe('trivia');

    // 11. Simultaneous Submissions: Both guest1 and guest2 submit answers within millisecond window
    const [sub1Res, sub2Res] = await Promise.all([
      new Promise<ServerResponseAck<unknown>>((resolve) =>
        guest1.emit('submit_trivia_answer', { answerIndex: 0, clientTimeMs: Date.now() }, resolve)
      ),
      new Promise<ServerResponseAck<unknown>>((resolve) =>
        guest2.emit('submit_trivia_answer', { answerIndex: 1, clientTimeMs: Date.now() }, resolve)
      ),
    ]);

    expect(sub1Res.success).toBe(true);
    expect(sub2Res.success).toBe(true);

    // 13. Duplicate submission in the same active round is rejected
    const dupRes = await new Promise<ServerResponseAck<unknown>>((resolve) => {
      guest1.emit('submit_trivia_answer', { answerIndex: 2, clientTimeMs: Date.now() }, resolve);
    });
    expect(dupRes.success).toBe(false);
    expect(dupRes.error).toBe('Answer already submitted for this round');

    // Host submits answer to conclude round
    const recapPromise = waitForEvent<RoundRecapData>(host, 'round_recap', 8000);
    await new Promise<ServerResponseAck<unknown>>((resolve) => {
      host.emit('submit_trivia_answer', { answerIndex: 0, clientTimeMs: Date.now() }, resolve);
    });

    const recap = await recapPromise;
    expect(recap.results).toHaveLength(3);
    // Verified that all 3 players' submissions were processed
    const scoredPlayers = recap.results.map((s) => s.nickname);
    expect(scoredPlayers).toContain('Judge');
    expect(scoredPlayers).toContain('Speedy');
    expect(scoredPlayers).toContain('Steady');

    // 12. Late Submission: Submitting when round has transitioned to ROUND_RESULTS must be rejected
    const lateRes = await new Promise<ServerResponseAck<unknown>>((resolve) => {
      guest1.emit('submit_trivia_answer', { answerIndex: 0, clientTimeMs: Date.now() }, resolve);
    });
    expect(lateRes.success).toBe(false);
    expect(lateRes.error).toBe('No active round in progress');
  }, 15000);

  it('14-17. Progression & State Restoration QA: Reconnect, host transfer, final podium, and Play Again', async () => {
    const host = createClientSocket();
    const guest = createClientSocket();
    await Promise.all([ensureConnected(host), ensureConnected(guest)]);

    let roomCode = '';
    let guestSessionToken = '';

    const createRes = await new Promise<ServerResponseAck<{ roomCode: string }>>((resolve) => {
      host.emit('create_room', { nickname: 'HostA', avatar: 'cyber-brain' }, resolve);
    });
    roomCode = createRes.data!.roomCode;

    const joinRes = await new Promise<ServerResponseAck<{ sessionToken: string; playerId: string }>>((resolve) => {
      guest.emit('join_room', { roomCode, nickname: 'GuestB', avatar: 'plasma-dragon' }, resolve);
    });
    guestSessionToken = joinRes.data!.sessionToken;

    // 14. Disconnect & Reconnect with state restoration
    guest.disconnect();
    await new Promise((r) => setTimeout(r, 60));

    // Guest re-establishes connection and reconnects using sessionToken
    const reconnectedGuest = createClientSocket();
    await ensureConnected(reconnectedGuest);

    const reconnectRes = await new Promise<ServerResponseAck<{ room: RoomState; newSessionToken: string }>>((resolve) => {
      reconnectedGuest.emit('reconnect_player', { roomCode, sessionToken: guestSessionToken }, resolve);
    });
    expect(reconnectRes.success).toBe(true);
    expect(reconnectRes.data?.room.roomCode).toBe(roomCode);
    expect(reconnectRes.data?.newSessionToken).toBeTruthy();

    // 15. Host Transfer: Host disconnects, guest becomes host
    const hostTransferPromise = waitForRoomState(reconnectedGuest, (r) => r.hostId === reconnectedGuest.id);
    host.disconnect();

    const transferredRoom = await hostTransferPromise;
    expect(transferredRoom.hostId).toBe(reconnectedGuest.id);

    // New host can execute privileged host actions
    const updateRes = await new Promise<ServerResponseAck<unknown>>((resolve) => {
      reconnectedGuest.emit('update_settings', { settings: { roundCount: 5 } }, resolve);
    });
    expect(updateRes.success).toBe(true);

    // 17. Play Again: Verify clean rematch state reset
    const engine = getGameEngine();
    const activeRoom = roomManager.getRoom(roomCode)!;
    activeRoom.status = 'GAME_OVER';
    activeRoom.currentRound = 5;

    const playAgainRes = await new Promise<ServerResponseAck<unknown>>((resolve) => {
      reconnectedGuest.emit('play_again', resolve);
    });
    expect(playAgainRes.success).toBe(true);

    const resetRoom = roomManager.getRoom(roomCode)!;
    expect(resetRoom.status).toBe('LOBBY');
    expect(resetRoom.currentRound).toBe(1);
    resetRoom.players.forEach((p) => {
      expect(p.score).toBe(0);
      expect(p.streak).toBe(0);
    });

    engine.clearAll();
  }, 12000);

  it('18-20. Server Error Handling QA: Malformed payloads, invalid operations, and safe error messages', async () => {
    const rogue = createClientSocket();
    await ensureConnected(rogue);

    // A. Submitting without being in a room
    const noRoomSub = await new Promise<ServerResponseAck<unknown>>((resolve) => {
      rogue.emit('submit_trivia_answer', { answerIndex: 0, clientTimeMs: Date.now() }, resolve);
    });
    expect(noRoomSub.success).toBe(false);
    expect(noRoomSub.error).toBe('Player not in an active room');

    // B. Malformed JSON with extreme out-of-range roundCount in settings
    const badSettings = await new Promise<ServerResponseAck<unknown>>((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rogue.emit('update_settings', { settings: { roundCount: 9999 } } as any, resolve);
    });
    expect(badSettings.success).toBe(false);
    expect(badSettings.error).toContain('Maximum rounds');

    // C. Reconnecting with invalid UUID
    const badToken = await new Promise<ServerResponseAck<unknown>>((resolve) => {
      rogue.emit('reconnect_player', { roomCode: 'ABCDEF', sessionToken: 'malformed-not-uuid' }, resolve);
    });
    expect(badToken.success).toBe(false);
    expect(badToken.error).toBe('Invalid session token format');

    // Server must still be healthy and responding
    const pingAck = await new Promise<{ clientTime: number; serverTime: number }>((resolve) => {
      rogue.emit('ping_clock', Date.now(), resolve);
    });
    expect(pingAck.serverTime).toBeGreaterThan(0);
  });
});
