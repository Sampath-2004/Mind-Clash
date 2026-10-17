import { Server, Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
  MIN_PLAYERS_PER_ROOM,
  createRoomSchema,
  joinRoomSchema,
  reconnectSchema,
  updateSettingsSchema,
  kickPlayerSchema,
  submitTriviaSchema,
  submitMathSchema,
  submitMemorySchema,
  submitReactionSchema,
  submitRareAnswerSchema,
  pingClockSchema,
} from '@mind-clash/shared';
import { roomManager } from '../managers/RoomManager.js';
import { GameEngine } from '../engine/GameEngine.js';
import { checkRateLimit, cleanupSocketRateLimit } from '../middleware/rateLimiter.js';
import { logger } from '../utils/logger.js';

let gameEngine: GameEngine;

export function initGameEngine(
  io: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>
): GameEngine {
  if (!gameEngine) {
    gameEngine = new GameEngine(io);
  } else {
    gameEngine.setSocketServer(io);
  }
  return gameEngine;
}

export function getGameEngine(): GameEngine {
  return gameEngine;
}

export function registerRoomHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>
) {
  const engine = initGameEngine(io);

  // 1. Clock Sync for Round Countdowns (General rate limit)
  socket.on('ping_clock', (clientTime, callback) => {
    if (!checkRateLimit(socket, 'general')) {
      return;
    }

    const parseResult = pingClockSchema.safeParse(clientTime);
    if (!parseResult.success) {
      return;
    }

    callback?.({ clientTime: parseResult.data, serverTime: Date.now() });
  });

  // 2. Create Room (Room action rate limit)
  socket.on('create_room', (payload, callback) => {
    if (!checkRateLimit(socket, 'room_action')) {
      return callback?.({ success: false, error: 'Too many requests. Please slow down.' });
    }

    const validation = createRoomSchema.safeParse(payload);
    if (!validation.success) {
      const err = validation.error.issues[0]?.message || 'Invalid room creation payload';
      return callback?.({ success: false, error: err });
    }

    try {
      const { room, player, sessionToken } = roomManager.createRoom(socket.id, validation.data);

      socket.join(room.roomCode);
      socket.data.roomCode = room.roomCode;
      socket.data.playerId = player.id;
      socket.data.sessionToken = sessionToken;

      logger.info('Room created', { roomCode: room.roomCode, hostPlayerId: player.id });

      callback?.({
        success: true,
        data: {
          roomCode: room.roomCode,
          sessionToken,
          playerId: player.id,
        },
      });

      socket.emit('room_state_updated', roomManager.sanitizeRoom(room, sessionToken));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create room';
      logger.error('Error in create_room', err);
      callback?.({ success: false, error: message });
    }
  });

  // 3. Join Room (Room action rate limit)
  socket.on('join_room', (payload, callback) => {
    if (!checkRateLimit(socket, 'room_action')) {
      return callback?.({ success: false, error: 'Too many requests. Please slow down.' });
    }

    const validation = joinRoomSchema.safeParse(payload);
    if (!validation.success) {
      const err = validation.error.issues[0]?.message || 'Invalid join room payload';
      return callback?.({ success: false, error: err });
    }

    try {
      const { room, player, sessionToken } = roomManager.joinRoom(socket.id, validation.data);

      socket.join(room.roomCode);
      socket.data.roomCode = room.roomCode;
      socket.data.playerId = player.id;
      socket.data.sessionToken = sessionToken;

      logger.info('Player joined room', { roomCode: room.roomCode, playerId: player.id });

      callback?.({
        success: true,
        data: {
          roomCode: room.roomCode,
          sessionToken,
          playerId: player.id,
        },
      });

      io.to(room.roomCode).emit('player_joined', { ...player, sessionToken: '' });
      io.to(room.roomCode).emit('room_state_updated', roomManager.sanitizeRoom(room));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to join room';
      logger.error('Error in join_room', err);
      callback?.({ success: false, error: message });
    }
  });

  // 4. Reconnect Player (Room action rate limit)
  socket.on('reconnect_player', (payload, callback) => {
    if (!checkRateLimit(socket, 'room_action')) {
      return callback?.({ success: false, error: 'Too many requests. Please slow down.' });
    }

    const validation = reconnectSchema.safeParse(payload);
    if (!validation.success) {
      const err = validation.error.issues[0]?.message || 'Invalid reconnect credentials';
      return callback?.({ success: false, error: err });
    }

    try {
      const { room, player, newSessionToken, oldSocketId } = roomManager.reconnectPlayer(
        socket.id,
        validation.data
      );

      if (oldSocketId) {
        engine.updatePlayerSocketId(room.roomCode, oldSocketId, socket.id);
      }
      const snapshot = engine.getReconnectionSnapshot(room, player.id);

      socket.join(room.roomCode);
      socket.data.roomCode = room.roomCode;
      socket.data.playerId = player.id;
      socket.data.sessionToken = newSessionToken;

      logger.info('Player reconnected', { roomCode: room.roomCode, playerId: player.id });

      callback?.({
        success: true,
        data: {
          room: roomManager.sanitizeRoom(room, newSessionToken),
          playerId: player.id,
          newSessionToken,
          activeChallenge: snapshot.activeChallenge,
          remainingMs: snapshot.remainingMs,
          roundRecap: snapshot.roundRecap,
          podiumData: snapshot.podiumData,
          submittedPlayerIds: snapshot.submittedPlayerIds,
          mySubmittedAnswer: snapshot.mySubmittedAnswer,
          isJudging: snapshot.isJudging,
        },
      });

      io.to(room.roomCode).emit('player_reconnected', { ...player, sessionToken: '' });
      io.to(room.roomCode).emit('room_state_updated', roomManager.sanitizeRoom(room));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Reconnection failed';
      logger.error('Error in reconnect_player', err);
      callback?.({ success: false, error: message });
    }
  });

  // 5. Update Settings (Host Only)
  socket.on('update_settings', (payload, callback) => {
    if (!checkRateLimit(socket, 'room_action')) {
      return callback?.({ success: false, error: 'Too many requests. Please slow down.' });
    }

    const validation = updateSettingsSchema.safeParse(payload);
    if (!validation.success) {
      const err = validation.error.issues[0]?.message || 'Invalid settings payload';
      return callback?.({ success: false, error: err });
    }

    try {
      const room = roomManager.updateSettings(socket.id, validation.data);
      io.to(room.roomCode).emit('room_state_updated', roomManager.sanitizeRoom(room));
      callback?.({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not update settings';
      callback?.({ success: false, error: message });
    }
  });

  // 6. Kick Player (Host Only)
  socket.on('kick_player', (payload, callback) => {
    if (!checkRateLimit(socket, 'room_action')) {
      return callback?.({ success: false, error: 'Too many requests. Please slow down.' });
    }

    const validation = kickPlayerSchema.safeParse(payload);
    if (!validation.success) {
      const err = validation.error.issues[0]?.message || 'Invalid kick payload';
      return callback?.({ success: false, error: err });
    }

    try {
      const { room, kickedPlayer } = roomManager.kickPlayer(socket.id, validation.data);

      const kickedSocket = io.sockets.sockets.get(kickedPlayer.id);
      if (kickedSocket) {
        kickedSocket.emit('kicked', { reason: 'You were removed by the host' });
        kickedSocket.leave(room.roomCode);
      }

      io.to(room.roomCode).emit('player_left', { playerId: kickedPlayer.id });
      io.to(room.roomCode).emit('room_state_updated', roomManager.sanitizeRoom(room));
      callback?.({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to kick player';
      callback?.({ success: false, error: message });
    }
  });

  // 7. Start Game (Host Only)
  socket.on('start_game', async (callback) => {
    if (!checkRateLimit(socket, 'room_action')) {
      return callback?.({ success: false, error: 'Too many requests. Please slow down.' });
    }

    try {
      const room = roomManager.getRoomBySocketId(socket.id);
      if (!room) throw new Error('Room not found');
      if (room.hostId !== socket.id) throw new Error('Only the host can start the game');

      const connected = room.players.filter((p) => p.isConnected);
      if (connected.length < MIN_PLAYERS_PER_ROOM) {
        throw new Error(`At least ${MIN_PLAYERS_PER_ROOM} players required to start the match`);
      }

      await engine.startGame(room);
      callback?.({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not start game';
      callback?.({ success: false, error: message });
    }
  });

  // 7b. Retry AI Question Generation (Host Only)
  socket.on('retry_ai_generation', async (callback) => {
    if (!checkRateLimit(socket, 'room_action')) {
      return callback?.({ success: false, error: 'Too many requests. Please slow down.' });
    }

    try {
      const room = roomManager.getRoomBySocketId(socket.id);
      if (!room) throw new Error('Room not found');
      if (room.hostId !== socket.id) throw new Error('Only the host can retry question generation');

      await engine.retryAiGeneration(room);
      callback?.({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not retry question generation';
      callback?.({ success: false, error: message });
    }
  });

  // 7c. Use Offline Questions Choice (Host Only)
  socket.on('use_offline_questions', async (callback) => {
    if (!checkRateLimit(socket, 'room_action')) {
      return callback?.({ success: false, error: 'Too many requests. Please slow down.' });
    }

    try {
      const room = roomManager.getRoomBySocketId(socket.id);
      if (!room) throw new Error('Room not found');
      if (room.hostId !== socket.id) throw new Error('Only the host can choose offline questions');

      await engine.useOfflineQuestions(room);
      callback?.({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not use offline questions';
      callback?.({ success: false, error: message });
    }
  });

  // 7d. Cancel Match Preparation (Host Only)
  socket.on('cancel_match', (callback) => {
    if (!checkRateLimit(socket, 'room_action')) {
      return callback?.({ success: false, error: 'Too many requests. Please slow down.' });
    }

    try {
      const room = roomManager.getRoomBySocketId(socket.id);
      if (!room) throw new Error('Room not found');
      if (room.hostId !== socket.id) throw new Error('Only the host can cancel match preparation');

      engine.cancelMatch(room);
      callback?.({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not cancel match';
      callback?.({ success: false, error: message });
    }
  });

  // 8. Submit Trivia Answer (Gameplay action rate limit + strictly server-identified socket.id)
  socket.on('submit_trivia_answer', (payload, callback) => {
    if (!checkRateLimit(socket, 'gameplay_action')) {
      return callback?.({ success: false, error: 'Submission rate limit exceeded.' });
    }

    const validation = submitTriviaSchema.safeParse(payload);
    if (!validation.success) {
      return callback?.({ success: false, error: 'Invalid submission payload' });
    }

    try {
      const room = roomManager.getRoomBySocketId(socket.id);
      if (!room) throw new Error('Player not in an active room');

      const res = engine.submitAnswer(room, socket.id, {
        answer: validation.data.answerIndex,
        clientTimeMs: validation.data.clientTimeMs,
      });

      if (!res.success) throw new Error(res.error);
      callback?.({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid submission';
      callback?.({ success: false, error: message });
    }
  });

  // 9. Submit Math Answer (Gameplay action rate limit + strictly server-identified socket.id)
  socket.on('submit_math_answer', (payload, callback) => {
    if (!checkRateLimit(socket, 'gameplay_action')) {
      return callback?.({ success: false, error: 'Submission rate limit exceeded.' });
    }

    const validation = submitMathSchema.safeParse(payload);
    if (!validation.success) {
      return callback?.({ success: false, error: 'Invalid submission payload' });
    }

    try {
      const room = roomManager.getRoomBySocketId(socket.id);
      if (!room) throw new Error('Player not in an active room');

      const res = engine.submitAnswer(room, socket.id, {
        answer: validation.data.answer,
        clientTimeMs: validation.data.clientTimeMs,
      });

      if (!res.success) throw new Error(res.error);
      callback?.({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid submission';
      callback?.({ success: false, error: message });
    }
  });

  // 10. Submit Memory Tiles (Gameplay action rate limit + strictly server-identified socket.id)
  socket.on('submit_memory_tiles', (payload, callback) => {
    if (!checkRateLimit(socket, 'gameplay_action')) {
      return callback?.({ success: false, error: 'Submission rate limit exceeded.' });
    }

    const validation = submitMemorySchema.safeParse(payload);
    if (!validation.success) {
      return callback?.({ success: false, error: 'Invalid submission payload' });
    }

    try {
      const room = roomManager.getRoomBySocketId(socket.id);
      if (!room) throw new Error('Player not in an active room');

      const res = engine.submitAnswer(room, socket.id, {
        selectedIndices: validation.data.selectedIndices,
        sequence: validation.data.sequence,
        clientTimeMs: validation.data.clientTimeMs,
      });

      if (!res.success) throw new Error(res.error);
      callback?.({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid submission';
      callback?.({ success: false, error: message });
    }
  });

  // 11. Submit Reaction Click (Gameplay action rate limit + strictly server-identified socket.id)
  socket.on('submit_reaction_click', (payload, callback) => {
    if (!checkRateLimit(socket, 'gameplay_action')) {
      return callback?.({ success: false, error: 'Submission rate limit exceeded.' });
    }

    const validation = submitReactionSchema.safeParse(payload);
    if (!validation.success) {
      return callback?.({ success: false, error: 'Invalid submission payload' });
    }

    try {
      const room = roomManager.getRoomBySocketId(socket.id);
      if (!room) throw new Error('Player not in an active room');

      const res = engine.submitAnswer(room, socket.id, {
        clientTimeMs: validation.data.clientTimeMs,
      });

      if (!res.success) throw new Error(res.error);
      callback?.({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid submission';
      callback?.({ success: false, error: message });
    }
  });

  // 12. Submit Rare Answer (Gameplay action rate limit)
  socket.on('submit_rare_answer', (payload, callback) => {
    if (!checkRateLimit(socket, 'gameplay_action')) {
      return callback?.({ success: false, error: 'Submission rate limit exceeded.' });
    }

    const validation = submitRareAnswerSchema.safeParse(payload);
    if (!validation.success) {
      return callback?.({ success: false, error: 'Invalid submission payload' });
    }

    try {
      const room = roomManager.getRoomBySocketId(socket.id);
      if (!room) throw new Error('Player not in an active room');

      const res = engine.submitAnswer(room, socket.id, {
        textAnswer: validation.data.answer,
        clientTimeMs: validation.data.clientTimeMs,
      });

      if (!res.success) throw new Error(res.error);
      callback?.({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid submission';
      callback?.({ success: false, error: message });
    }
  });

  // 12. Play Again (Rematch - Host Only)
  socket.on('play_again', (callback) => {
    if (!checkRateLimit(socket, 'room_action')) {
      return callback?.({ success: false, error: 'Too many requests. Please slow down.' });
    }

    try {
      const room = roomManager.getRoomBySocketId(socket.id);
      if (!room) throw new Error('Room not found');
      if (room.hostId !== socket.id) throw new Error('Only the host can initiate a rematch');

      engine.playAgain(room);
      callback?.({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not restart match';
      callback?.({ success: false, error: message });
    }
  });

  // 13. Return to Lobby (Host Only)
  socket.on('return_to_lobby', (callback) => {
    if (!checkRateLimit(socket, 'room_action')) {
      return callback?.({ success: false, error: 'Too many requests. Please slow down.' });
    }

    try {
      const room = roomManager.getRoomBySocketId(socket.id);
      if (!room) throw new Error('Room not found');
      if (room.hostId !== socket.id) throw new Error('Only the host can return to lobby');

      engine.returnToLobby(room);
      callback?.({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not return to lobby';
      callback?.({ success: false, error: message });
    }
  });

  // 14. Explicit Leave Room
  socket.on('leave_room', () => {
    const roomCode = socket.data.roomCode;
    const { room, player, newHostId, roomDestroyed } = roomManager.leaveRoom(socket.id);
    if (roomCode) {
      socket.leave(roomCode);
    }
    socket.data.roomCode = undefined;

    if (roomDestroyed && roomCode) {
      engine.cleanRoom(roomCode);
    } else if (room && player) {
      io.to(room.roomCode).emit('player_left', { playerId: player.id, newHostId });
      io.to(room.roomCode).emit('room_state_updated', roomManager.sanitizeRoom(room));
    }
  });

  // 15. Disconnect Handler
  socket.on('disconnect', () => {
    cleanupSocketRateLimit(socket.id);

    const { room, player, newHostId } = roomManager.handleDisconnect(socket.id);
    if (room && player) {
      io.to(room.roomCode).emit('player_disconnected', player.id);
      if (newHostId) {
        io.to(room.roomCode).emit('room_state_updated', roomManager.sanitizeRoom(room));
      }
    }
  });
}
