import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { httpServer, io } from '../src/index.js';
import { io as Client, Socket } from 'socket.io-client';
import { AddressInfo } from 'net';
import { roomManager } from '../src/managers/RoomManager.js';
import { ClientToServerEvents, ServerToClientEvents, RoomState, Player, ServerResponseAck } from '@mind-clash/shared';

type TestSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

function ensureConnected(socket: TestSocket): Promise<void> {
  if (socket.connected) return Promise.resolve();
  return new Promise<void>((resolve) => {
    socket.once('connect', () => resolve());
  });
}

function waitForRoomState(
  socket: TestSocket,
  predicate: (r: RoomState) => boolean,
  timeoutMs = 4000
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

describe('Phase 3: Multiplayer Room Creation, Joining, and Lifecycle Tests', () => {
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
    io.close();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  it('1. Two separate clients join the same room', async () => {
    const client1 = createClientSocket();
    const client2 = createClientSocket();

    await Promise.all([ensureConnected(client1), ensureConnected(client2)]);

    // Client 1 creates a room
    const createRes = await new Promise<{
      success: boolean;
      data?: { roomCode: string; sessionToken: string; playerId: string };
      error?: string;
    }>((resolve) => {
      client1.emit('create_room', { nickname: 'HostPlayer', avatar: 'cyber-brain' }, resolve);
    });

    expect(createRes.success).toBe(true);
    expect(createRes.data?.roomCode).toHaveLength(6);
    expect(createRes.data?.playerId).toBe(client1.id);
    const roomCode = createRes.data!.roomCode;

    // Client 1 listens for player_joined
    const client1NotifiedOfJoin = new Promise<Player>((resolve) => {
      client1.once('player_joined', resolve);
    });

    // Client 2 joins the room
    const joinRes = await new Promise<{
      success: boolean;
      data?: { roomCode: string; sessionToken: string; playerId: string };
      error?: string;
    }>((resolve) => {
      client2.emit(
        'join_room',
        { roomCode, nickname: 'SecondPlayer', avatar: 'plasma-dragon' },
        resolve
      );
    });

    expect(joinRes.success).toBe(true);
    expect(joinRes.data?.playerId).toBe(client2.id);

    // Verify Client 1 was notified of Client 2 joining
    const joinedPlayer = await client1NotifiedOfJoin;
    expect(joinedPlayer.nickname).toBe('SecondPlayer');
    expect(joinedPlayer.id).toBe(client2.id);
    expect(joinedPlayer.isHost).toBe(false);
  });

  it('2. A third client sees existing players and room updates appear on all clients', async () => {
    const client1 = createClientSocket();
    const client2 = createClientSocket();
    const client3 = createClientSocket();

    await Promise.all([
      ensureConnected(client1),
      ensureConnected(client2),
      ensureConnected(client3),
    ]);

    // Host creates room
    const createRes = await new Promise<ServerResponseAck<{ roomCode: string; sessionToken: string; playerId: string }>>((resolve) => {
      client1.emit('create_room', { nickname: 'Alice', avatar: 'cyber-brain' }, resolve);
    });
    const roomCode = createRes.data!.roomCode;

    // Client 2 joins
    await new Promise<ServerResponseAck<{ roomCode: string; sessionToken: string; playerId: string }>>((resolve) => {
      client2.emit('join_room', { roomCode, nickname: 'Bob', avatar: 'astro-bot' }, resolve);
    });

    // Setup wait for 3 players on both client1 and client2
    const c1Update = waitForRoomState(client1, (r) => r.players.length === 3);
    const c2Update = waitForRoomState(client2, (r) => r.players.length === 3);

    // Client 3 joins
    const joinRes = await new Promise<ServerResponseAck<{ roomCode: string; sessionToken: string; playerId: string }>>((resolve) => {
      client3.emit('join_room', { roomCode, nickname: 'Charlie', avatar: 'solar-phoenix' }, resolve);
    });
    expect(joinRes.success).toBe(true);

    // Both Client 1 and Client 2 receive broadcast with all 3 players
    const [c1Room, c2Room] = await Promise.all([c1Update, c2Update]);

    expect(c1Room.players).toHaveLength(3);
    expect(c2Room.players).toHaveLength(3);

    const nicknames = c1Room.players.map((p) => p.nickname);
    expect(nicknames).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('3. Full room rejects additional players beyond capacity (10 max)', async () => {
    const host = createClientSocket();
    await ensureConnected(host);

    const createRes = await new Promise<ServerResponseAck<{ roomCode: string; sessionToken: string; playerId: string }>>((resolve) => {
      host.emit('create_room', { nickname: 'Captain', avatar: 'cyber-brain' }, resolve);
    });
    const roomCode = createRes.data!.roomCode;

    // Join 9 more players to reach max capacity (10)
    for (let i = 2; i <= 10; i++) {
      const p = createClientSocket();
      await ensureConnected(p);
      const res = await new Promise<ServerResponseAck<{ roomCode: string; sessionToken: string; playerId: string }>>((resolve) => {
        p.emit('join_room', { roomCode, nickname: `Player${i}`, avatar: 'void-ninja' }, resolve);
      });
      expect(res.success).toBe(true);
    }

    // 11th player attempts to join
    const player11 = createClientSocket();
    await ensureConnected(player11);
    const rejectRes = await new Promise<ServerResponseAck<{ roomCode: string; sessionToken: string; playerId: string }>>((resolve) => {
      player11.emit('join_room', { roomCode, nickname: 'Player11', avatar: 'cosmic-alien' }, resolve);
    });

    expect(rejectRes.success).toBe(false);
    expect(rejectRes.error).toContain('full');
  });

  it('4. Host disconnect behavior is correct (host privileges migrate to next player)', async () => {
    const host = createClientSocket();
    const guest1 = createClientSocket();
    const guest2 = createClientSocket();

    await Promise.all([
      ensureConnected(host),
      ensureConnected(guest1),
      ensureConnected(guest2),
    ]);

    const createRes = await new Promise<ServerResponseAck<{ roomCode: string; sessionToken: string; playerId: string }>>((resolve) => {
      host.emit('create_room', { nickname: 'OriginalHost', avatar: 'cyber-brain' }, resolve);
    });
    const roomCode = createRes.data!.roomCode;

    await new Promise<ServerResponseAck<{ roomCode: string; sessionToken: string; playerId: string }>>((resolve) => {
      guest1.emit('join_room', { roomCode, nickname: 'Guest1', avatar: 'plasma-dragon' }, resolve);
    });

    await new Promise<ServerResponseAck<{ roomCode: string; sessionToken: string; playerId: string }>>((resolve) => {
      guest2.emit('join_room', { roomCode, nickname: 'Guest2', avatar: 'astro-bot' }, resolve);
    });

    // Guest 1 sets up wait for room state where hostId migrated to guest1.id
    const guest1MigrationPromise = waitForRoomState(guest1, (r) => r.hostId === guest1.id);

    // Host disconnects
    host.disconnect();

    const migratedRoom = await guest1MigrationPromise;

    // Verify host was migrated to Guest 1
    expect(migratedRoom.hostId).toBe(guest1.id);
    const guest1InRoom = migratedRoom.players.find((p) => p.id === guest1.id);
    expect(guest1InRoom?.isHost).toBe(true);

    // Verify original host is marked disconnected
    const origHostInRoom = migratedRoom.players.find((p) => p.nickname === 'OriginalHost');
    expect(origHostInRoom?.isConnected).toBe(false);
    expect(origHostInRoom?.isHost).toBe(false);
  });
});
