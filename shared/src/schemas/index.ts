import { z } from 'zod';
import { ROOM_CODE_LENGTH, MIN_ROUND_COUNT, MAX_ROUND_COUNT } from '../constants.js';

export const createRoomSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(2, 'Nickname must be at least 2 characters')
    .max(20, 'Nickname must not exceed 20 characters'),
  avatar: z.string().min(1, 'Avatar is required').max(100, 'Avatar identifier too long'),
});

export const joinRoomSchema = z.object({
  roomCode: z
    .string()
    .trim()
    .length(ROOM_CODE_LENGTH, `Room code must be exactly ${ROOM_CODE_LENGTH} characters`)
    .toUpperCase(),
  nickname: z
    .string()
    .trim()
    .min(2, 'Nickname must be at least 2 characters')
    .max(20, 'Nickname must not exceed 20 characters'),
  avatar: z.string().min(1, 'Avatar is required').max(100, 'Avatar identifier too long'),
});

export const reconnectSchema = z.object({
  roomCode: z
    .string()
    .trim()
    .length(ROOM_CODE_LENGTH, `Room code must be ${ROOM_CODE_LENGTH} characters`)
    .toUpperCase(),
  sessionToken: z.string().uuid('Invalid session token format'),
});

export const updateSettingsSchema = z.object({
  settings: z.object({
    roundCount: z
      .number()
      .int()
      .min(MIN_ROUND_COUNT, `Minimum rounds: ${MIN_ROUND_COUNT}`)
      .max(MAX_ROUND_COUNT, `Maximum rounds: ${MAX_ROUND_COUNT}`)
      .optional(),
    selectedModes: z
      .array(z.enum(['trivia', 'math', 'memory', 'reaction']))
      .min(1, 'At least one game mode must be selected')
      .max(4)
      .optional(),
  }),
});

export const kickPlayerSchema = z.object({
  targetPlayerId: z.string().min(1, 'Target player ID is required').max(100),
});

export const submitTriviaSchema = z.object({
  answerIndex: z.number().int().min(0).max(3),
  clientTimeMs: z.number().positive().finite(),
});

export const submitMathSchema = z.object({
  answer: z.number().finite(),
  clientTimeMs: z.number().positive().finite(),
});

export const submitMemorySchema = z.object({
  selectedIndices: z.array(z.number().int().nonnegative()).max(30).optional(),
  sequence: z.array(z.string().max(50)).max(30).optional(),
  clientTimeMs: z.number().positive().finite(),
});

export const submitReactionSchema = z.object({
  clientTimeMs: z.number().positive().finite(),
});

export const pingClockSchema = z.number().finite();

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
export type ReconnectInput = z.infer<typeof reconnectSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type KickPlayerInput = z.infer<typeof kickPlayerSchema>;
export type SubmitTriviaInput = z.infer<typeof submitTriviaSchema>;
export type SubmitMathInput = z.infer<typeof submitMathSchema>;
export type SubmitMemoryInput = z.infer<typeof submitMemorySchema>;
export type SubmitReactionInput = z.infer<typeof submitReactionSchema>;
export type PingClockInput = z.infer<typeof pingClockSchema>;

