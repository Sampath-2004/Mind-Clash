import { Server, Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
  MIN_PLAYERS_PER_ROOM,
} from '@mind-clash/shared';
import { roomManager } from '../managers/RoomManager.js';
import { checkRateLimit, cleanupSocketRateLimit } from '../middleware/rateLimiter.js';

export function registerRoomHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>
) {
  // 1. Create Room
  socket.on('create_room', (payload, callback) => {
    if (!checkRateLimit(socket)) {
      return callback?.({ success: false, error: 'Rate limit exceeded. Please wait a moment.' });
    }

    try {
      const { room, player, sessionToken } = roomManager.createRoom(socket.id, payload);

      // Join Socket.IO channel
      socket.join(room.roomCode);
      socket.data.roomCode = room.roomCode;
      socket.data.playerId = player.id;
      socket.data.sessionToken = sessionToken;

      callback?.({
        success: true,
        data: {
          roomCode: room.roomCode,
          sessionToken,
          playerId: player.id,
        },
      });

      // Send initial room snapshot
      socket.emit('room_state_updated', room);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create room';
      callback?.({ success: false, error: message });
    }
  });

  // 2. Join Room
  socket.on('join_room', (payload, callback) => {
    if (!checkRateLimit(socket)) {
      return callback?.({ success: false, error: 'Rate limit exceeded. Please wait a moment.' });
    }

    try {
      const { room, player, sessionToken } = roomManager.joinRoom(socket.id, payload);

      // Join Socket.IO room channel
      socket.join(room.roomCode);
      socket.data.roomCode = room.roomCode;
      socket.data.playerId = player.id;
      socket.data.sessionToken = sessionToken;

      callback?.({
        success: true,
        data: {
          roomCode: room.roomCode,
          sessionToken,
          playerId: player.id,
        },
      });

      // Broadcast join event and full updated state to all in room
      io.to(room.roomCode).emit('player_joined', player);
      io.to(room.roomCode).emit('room_state_updated', room);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to join room';
      callback?.({ success: false, error: message });
    }
  });

  // 3. Reconnect Player
  socket.on('reconnect_player', (payload, callback) => {
    if (!checkRateLimit(socket)) {
      return callback?.({ success: false, error: 'Rate limit exceeded.' });
    }

    try {
      const { room, player } = roomManager.reconnectPlayer(socket.id, payload);

      socket.join(room.roomCode);
      socket.data.roomCode = room.roomCode;
      socket.data.playerId = player.id;
      socket.data.sessionToken = player.sessionToken;

      callback?.({
        success: true,
        data: {
          room,
          playerId: player.id,
        },
      });

      io.to(room.roomCode).emit('player_reconnected', player);
      io.to(room.roomCode).emit('room_state_updated', room);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Reconnection failed';
      callback?.({ success: false, error: message });
    }
  });

  // 4. Update Settings (Host Only)
  socket.on('update_settings', (payload, callback) => {
    try {
      const room = roomManager.updateSettings(socket.id, payload);
      io.to(room.roomCode).emit('room_state_updated', room);
      callback?.({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not update settings';
      callback?.({ success: false, error: message });
    }
  });

  // 5. Kick Player (Host Only)
  socket.on('kick_player', (payload, callback) => {
    try {
      const { room, kickedPlayer } = roomManager.kickPlayer(socket.id, payload);

      // Notify kicked player socket
      const kickedSocket = io.sockets.sockets.get(kickedPlayer.id);
      if (kickedSocket) {
        kickedSocket.emit('kicked', { reason: 'You were removed by the host' });
        kickedSocket.leave(room.roomCode);
      }

      io.to(room.roomCode).emit('player_left', { playerId: kickedPlayer.id });
      io.to(room.roomCode).emit('room_state_updated', room);
      callback?.({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to kick player';
      callback?.({ success: false, error: message });
    }
  });

  // 6. Start Game (Host Only)
  socket.on('start_game', (callback) => {
    try {
      const room = roomManager.getRoomBySocketId(socket.id);
      if (!room) {
        throw new Error('Room not found');
      }

      if (room.hostId !== socket.id) {
        throw new Error('Only the host can start the game');
      }

      const connectedPlayers = room.players.filter((p) => p.isConnected);
      if (connectedPlayers.length < MIN_PLAYERS_PER_ROOM) {
        throw new Error(`At least ${MIN_PLAYERS_PER_ROOM} players required to start the match`);
      }

      room.status = 'COUNTDOWN';
      io.to(room.roomCode).emit('room_state_updated', room);
      io.to(room.roomCode).emit('game_starting', { countdownMs: 3000 });
      callback?.({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not start game';
      callback?.({ success: false, error: message });
    }
  });

  // 7. Explicit Leave Room
  socket.on('leave_room', () => {
    const { room, player, newHostId, roomDestroyed } = roomManager.leaveRoom(socket.id);
    socket.leave(socket.data.roomCode || '');
    socket.data.roomCode = undefined;

    if (!roomDestroyed && room && player) {
      io.to(room.roomCode).emit('player_left', { playerId: player.id, newHostId });
      io.to(room.roomCode).emit('room_state_updated', room);
    }
  });

  // 8. Disconnect Handler
  socket.on('disconnect', () => {
    cleanupSocketRateLimit(socket.id);

    const { room, player, newHostId } = roomManager.handleDisconnect(socket.id);
    if (room && player) {
      io.to(room.roomCode).emit('player_disconnected', player.id);
      if (newHostId) {
        io.to(room.roomCode).emit('room_state_updated', room);
      }
    }
  });
}
