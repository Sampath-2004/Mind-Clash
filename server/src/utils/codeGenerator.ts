import crypto from 'crypto';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@mind-clash/shared';

/**
 * Generates a cryptographically random 6-character room code.
 * Ensures the code does not collide with existing active room codes.
 */
export function generateUniqueRoomCode(isCodeActive: (code: string) => boolean): string {
  const alphabetLength = ROOM_CODE_ALPHABET.length;
  const maxAttempts = 1000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      const randomIndex = crypto.randomInt(0, alphabetLength);
      code += ROOM_CODE_ALPHABET[randomIndex];
    }

    if (!isCodeActive(code)) {
      return code;
    }
  }

  throw new Error('Failed to generate a unique room code after maximum attempts');
}
