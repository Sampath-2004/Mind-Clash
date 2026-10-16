import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { httpServer, io } from '../src/index.js';
import { io as Client, Socket } from 'socket.io-client';
import { AddressInfo } from 'net';

describe('Phase 1: Server Core, CORS & Socket.IO Gateway', () => {
  let clientSocket: Socket;
  let port: number;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        port = (httpServer.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    io.close();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  it('GET /api/health should return 200 OK with runtime diagnostics', async () => {
    const res = await fetch(`http://localhost:${port}/api/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.timestamp).toBeTypeOf('number');
    expect(data.uptime).toBeTypeOf('number');
    expect(data.environment).toBeDefined();
  });

  it('GET /api/unregistered-route should return 404 JSON', async () => {
    const res = await fetch(`http://localhost:${port}/api/unregistered-route`);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('API route not found');
  });

  it('Socket.IO should attach to HTTP server and assign a unique socket ID', async () => {
    clientSocket = Client(`http://localhost:${port}`, {
      transports: ['websocket', 'polling'],
    });

    await new Promise<void>((resolve, reject) => {
      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        expect(clientSocket.id).toBeDefined();
        expect(clientSocket.id?.length).toBeGreaterThan(5);
        resolve();
      });
      clientSocket.on('connect_error', (err) => reject(err));
    });
  });
});
