import crypto from 'crypto';
import type { Difficulty } from '@mind-clash/shared';
import { logger } from '../utils/logger.js';

// ==========================================
// 1. TYPES & INTERFACES
// ==========================================

export type QuestionType = 'trivia' | 'rare_answer';

export interface HistoryEntry {
  id: string; // Stable deterministic ID
  type: QuestionType;
  fingerprint: string; // Normalized token fingerprint
  normalizedText: string; // Normalized full text
  tokens: string[]; // Keyword tokens for paraphrase detection
  correctAnswer?: string; // Normalized correct answer (for trivia)
  category?: string;
  difficulty?: Difficulty;
  roomCode?: string;
  source?: 'gemini' | 'groq' | 'openai' | 'offline';
  recordedAt: number;
  expiresAt: number;
}

export interface QuestionReservation {
  reservationId: string;
  roomCode: string;
  type: QuestionType;
  entries: HistoryEntry[];
  reservedAt: number;
  expiresAt: number; // Lease expiration timestamp
}

export interface ParaphraseCheckResult {
  isDuplicate: boolean;
  reason?: 'exact' | 'fingerprint' | 'paraphrase';
  similarity: number;
  matchedEntryId?: string;
  matchedText?: string;
}

export interface DuplicateHistoryAdapter {
  readonly name: string;
  isAvailable(): boolean;
  addEntries(entries: HistoryEntry[]): Promise<void>;
  getRecentEntries(filter?: { roomCode?: string; type?: QuestionType }): Promise<HistoryEntry[]>;
  addReservation(reservation: QuestionReservation): Promise<void>;
  getReservation(reservationId: string): Promise<QuestionReservation | null>;
  getActiveReservations(filter?: { roomCode?: string; type?: QuestionType }): Promise<QuestionReservation[]>;
  removeReservation(reservationId: string): Promise<void>;
  clearRoom(roomCode: string): Promise<void>;
  clearAll(): Promise<void>;
  close?(): Promise<void>;
}

export class QuestionPoolExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuestionPoolExhaustedError';
  }
}

// ==========================================
// 2. TEXT NORMALIZATION & FINGERPRINTING
// ==========================================

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'were', 'will', 'with', 'what', 'which', 'who', 'whom',
  'whose', 'where', 'when', 'why', 'how', 'do', 'does', 'did', 'have',
  'had', 'having', 'been', 'being', 'can', 'could', 'should', 'would',
  'called', 'name', 'named', 'known', 'following', 'many', 'much',
  'about', 'between', 'into', 'through', 'during', 'before', 'after',
  'above', 'below', 'under', 'again', 'further', 'then', 'once', 'here',
  'there', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 'just', 'give', 'tell', 'me', 'one',
]);

/**
 * Normalizes text by lowercasing, stripping diacritics, removing punctuation,
 * and collapsing whitespace.
 */
export function normalizeText(raw: string): string {
  if (!raw) return '';
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // replace punctuation with space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes simple word stems (e.g. trailing plural 's', 'es').
 */
function stemWord(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('es') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/**
 * Extracts normalized, non-stopword keyword tokens.
 */
export function extractKeywords(text: string): string[] {
  const norm = normalizeText(text);
  if (!norm) return [];

  const rawTokens = norm.split(' ');
  const keywords: string[] = [];
  for (const token of rawTokens) {
    if (token.length < 2) continue;
    if (STOPWORDS.has(token)) continue;
    keywords.push(stemWord(token));
  }
  return keywords;
}

/**
 * Generates a stable token-sorted fingerprint string.
 */
export function calculateFingerprint(text: string): string {
  const keywords = Array.from(new Set(extractKeywords(text))).sort();
  return keywords.join(' ');
}

/**
 * Generates a deterministic stable ID for a question or prompt.
 */
export function generateStableId(type: QuestionType, text: string): string {
  const fp = calculateFingerprint(text) || normalizeText(text);
  const hash = crypto.createHash('sha256').update(`${type}:${fp}`).digest('hex');
  const prefix = type === 'trivia' ? 'triv' : 'rare';
  return `${prefix}_${hash.slice(0, 16)}`;
}

/**
 * Computes Jaccard similarity between two token sets.
 */
export function computeTokenJaccard(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 && tokensB.length === 0) return 1.0;
  if (tokensA.length === 0 || tokensB.length === 0) return 0.0;

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Computes Character 3-gram (trigram) Jaccard similarity.
 */
export function computeTrigramJaccard(strA: string, strB: string): number {
  const normA = normalizeText(strA).replace(/\s/g, '');
  const normB = normalizeText(strB).replace(/\s/g, '');

  if (normA === normB) return 1.0;
  if (normA.length < 3 || normB.length < 3) {
    return normA === normB ? 1.0 : 0.0;
  }

  const getTrigrams = (s: string): Set<string> => {
    const set = new Set<string>();
    for (let i = 0; i <= s.length - 3; i++) {
      set.add(s.slice(i, i + 3));
    }
    return set;
  };

  const triA = getTrigrams(normA);
  const triB = getTrigrams(normB);

  let intersection = 0;
  for (const t of triA) {
    if (triB.has(t)) intersection++;
  }

  const union = new Set([...triA, ...triB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Evaluates whether two text items are exact duplicates or closely paraphrased.
 */
export function areDuplicateOrParaphrase(
  candidateText: string,
  existingText: string,
  candidateAnswer?: string,
  existingAnswer?: string,
  threshold = 0.65
): ParaphraseCheckResult {
  const normCandidate = normalizeText(candidateText);
  const normExisting = normalizeText(existingText);

  // 1. Exact match
  if (normCandidate === normExisting) {
    return { isDuplicate: true, reason: 'exact', similarity: 1.0 };
  }

  // 2. Token fingerprint match
  const fpCandidate = calculateFingerprint(candidateText);
  const fpExisting = calculateFingerprint(existingText);

  if (fpCandidate && fpCandidate === fpExisting) {
    return { isDuplicate: true, reason: 'fingerprint', similarity: 1.0 };
  }

  // 3. Keyword token Jaccard similarity
  const tokensCandidate = extractKeywords(candidateText);
  const tokensExisting = extractKeywords(existingText);
  const tokenSim = computeTokenJaccard(tokensCandidate, tokensExisting);

  // 4. Character trigram similarity
  const trigramSim = computeTrigramJaccard(candidateText, existingText);

  const maxSim = Math.max(tokenSim, trigramSim);

  // 5. Trivia answer reinforcement
  // If both have identical answers and moderate semantic similarity, it is a paraphrase
  if (
    candidateAnswer &&
    existingAnswer &&
    normalizeText(candidateAnswer) === normalizeText(existingAnswer) &&
    normalizeText(candidateAnswer).length > 0
  ) {
    const setA = new Set(tokensCandidate);
    const setB = new Set(tokensExisting);
    let intersection = 0;
    for (const t of setA) {
      if (setB.has(t)) intersection++;
    }
    const minTokens = Math.min(setA.size, setB.size);
    const overlap = minTokens > 0 ? intersection / minTokens : 0;

    if (tokenSim >= 0.35 || trigramSim >= 0.35 || overlap >= 0.50) {
      return {
        isDuplicate: true,
        reason: 'paraphrase',
        similarity: Math.max(maxSim, 0.9),
      };
    }
  }

  if (maxSim >= threshold) {
    return { isDuplicate: true, reason: 'paraphrase', similarity: maxSim };
  }

  return { isDuplicate: false, similarity: maxSim };
}

// ==========================================
// 3. IN-MEMORY ADAPTER (FALLBACK)
// ==========================================

export class InMemoryHistoryAdapter implements DuplicateHistoryAdapter {
  readonly name = 'in-memory';
  private entries: HistoryEntry[] = [];
  private roomEntries = new Map<string, HistoryEntry[]>();
  private reservations = new Map<string, QuestionReservation>();

  constructor(
    private maxGlobalEntries = 2000,
    private maxRoomEntries = 200
  ) {}

  public isAvailable(): boolean {
    return true;
  }

  public async addEntries(newEntries: HistoryEntry[]): Promise<void> {
    const now = Date.now();
    for (const entry of newEntries) {
      this.entries.push(entry);

      if (entry.roomCode) {
        let roomList = this.roomEntries.get(entry.roomCode);
        if (!roomList) {
          roomList = [];
          this.roomEntries.set(entry.roomCode, roomList);
        }
        roomList.push(entry);

        // Bounded room capacity
        if (roomList.length > this.maxRoomEntries) {
          this.roomEntries.set(entry.roomCode, roomList.slice(-this.maxRoomEntries));
        }
      }
    }

    // Prune expired global entries or enforce max limit
    this.entries = this.entries
      .filter((e) => e.expiresAt > now)
      .slice(-this.maxGlobalEntries);
  }

  public async getRecentEntries(filter?: {
    roomCode?: string;
    type?: QuestionType;
  }): Promise<HistoryEntry[]> {
    const now = Date.now();

    if (filter?.roomCode) {
      const roomList = this.roomEntries.get(filter.roomCode) || [];
      const valid = roomList.filter((e) => e.expiresAt > now);
      if (filter.type) {
        return valid.filter((e) => e.type === filter.type);
      }
      return valid;
    }

    const valid = this.entries.filter((e) => e.expiresAt > now);
    if (filter?.type) {
      return valid.filter((e) => e.type === filter.type);
    }
    return valid;
  }

  public async addReservation(reservation: QuestionReservation): Promise<void> {
    this.pruneExpiredReservations();
    this.reservations.set(reservation.reservationId, reservation);
  }

  public async getReservation(reservationId: string): Promise<QuestionReservation | null> {
    this.pruneExpiredReservations();
    return this.reservations.get(reservationId) || null;
  }

  public async getActiveReservations(filter?: {
    roomCode?: string;
    type?: QuestionType;
  }): Promise<QuestionReservation[]> {
    this.pruneExpiredReservations();
    let res = Array.from(this.reservations.values());
    if (filter?.roomCode) {
      res = res.filter((r) => r.roomCode === filter.roomCode);
    }
    if (filter?.type) {
      res = res.filter((r) => r.type === filter.type);
    }
    return res;
  }

  public async removeReservation(reservationId: string): Promise<void> {
    this.reservations.delete(reservationId);
  }

  public async clearRoom(roomCode: string): Promise<void> {
    this.roomEntries.delete(roomCode);
    for (const [id, res] of this.reservations.entries()) {
      if (res.roomCode === roomCode) {
        this.reservations.delete(id);
      }
    }
  }

  public async clearAll(): Promise<void> {
    this.entries = [];
    this.roomEntries.clear();
    this.reservations.clear();
  }

  private pruneExpiredReservations(): void {
    const now = Date.now();
    for (const [id, res] of this.reservations.entries()) {
      if (res.expiresAt <= now) {
        this.reservations.delete(id);
      }
    }
  }
}

// ==========================================
// 4. REDIS ADAPTER (OPTIONAL DURABLE STORE)
// ==========================================

export class RedisHistoryAdapter implements DuplicateHistoryAdapter {
  readonly name = 'redis';
  private client: any = null; // ioredis Redis instance
  private fallback: InMemoryHistoryAdapter;
  private connected = false;
  private warnedOnce = false;

  constructor(
    private redisUrl: string,
    private maxGlobalEntries = 2000,
    private maxRoomEntries = 200
  ) {
    this.fallback = new InMemoryHistoryAdapter(maxGlobalEntries, maxRoomEntries);
    this.initRedis();
  }

  private async initRedis(): Promise<void> {
    try {
      // Dynamic import of ioredis to ensure safe instantiation
      const ioredisModule: any = await import('ioredis');
      const RedisConstructor = ioredisModule.Redis || ioredisModule.default || ioredisModule;
      this.client = new RedisConstructor(this.redisUrl, {
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null, // Do not hang or continuously retry if down
        lazyConnect: false,
      });

      this.client.on('connect', () => {
        this.connected = true;
        logger.info('[DuplicatePrevention] Connected to Redis history adapter');
      });

      this.client.on('error', (err: any) => {
        this.connected = false;
        if (!this.warnedOnce) {
          logger.warn(
            `[DuplicatePrevention] Redis unavailable (${err?.message || err}). Falling back to in-memory history.`
          );
          this.warnedOnce = true;
        }
      });
    } catch (err) {
      this.connected = false;
      if (!this.warnedOnce) {
        logger.warn(
          `[DuplicatePrevention] Failed to initialize Redis client (${err instanceof Error ? err.message : String(err)}). Using in-memory fallback.`
        );
        this.warnedOnce = true;
      }
    }
  }

  public isAvailable(): boolean {
    return this.connected && this.client !== null && this.client.status === 'ready';
  }

  public async addEntries(entries: HistoryEntry[]): Promise<void> {
    // Always keep fallback in sync
    await this.fallback.addEntries(entries);

    if (!this.isAvailable()) return;

    try {
      const pipeline = this.client.pipeline();
      for (const entry of entries) {
        const json = JSON.stringify(entry);
        const ttlSeconds = Math.max(1, Math.ceil((entry.expiresAt - Date.now()) / 1000));

        // Global list
        pipeline.lpush('mindclash:history:global', json);
        pipeline.ltrim('mindclash:history:global', 0, this.maxGlobalEntries - 1);

        // Room list
        if (entry.roomCode) {
          const roomKey = `mindclash:history:room:${entry.roomCode}`;
          pipeline.lpush(roomKey, json);
          pipeline.ltrim(roomKey, 0, this.maxRoomEntries - 1);
          pipeline.expire(roomKey, ttlSeconds);
        }
      }
      await pipeline.exec();
    } catch (err) {
      logger.warn('[DuplicatePrevention] Redis write error, used fallback', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  public async getRecentEntries(filter?: {
    roomCode?: string;
    type?: QuestionType;
  }): Promise<HistoryEntry[]> {
    if (!this.isAvailable()) {
      return this.fallback.getRecentEntries(filter);
    }

    try {
      const key = filter?.roomCode
        ? `mindclash:history:room:${filter.roomCode}`
        : 'mindclash:history:global';
      const rawList: string[] = await this.client.lrange(key, 0, -1);
      const now = Date.now();
      const entries: HistoryEntry[] = [];

      for (const item of rawList) {
        try {
          const parsed: HistoryEntry = JSON.parse(item);
          if (parsed.expiresAt > now) {
            if (!filter?.type || parsed.type === filter.type) {
              entries.push(parsed);
            }
          }
        } catch {
          // ignore corrupted JSON
        }
      }
      return entries;
    } catch (err) {
      logger.warn('[DuplicatePrevention] Redis read error, using fallback', {
        error: err instanceof Error ? err.message : String(err),
      });
      return this.fallback.getRecentEntries(filter);
    }
  }

  public async addReservation(reservation: QuestionReservation): Promise<void> {
    await this.fallback.addReservation(reservation);
    if (!this.isAvailable()) return;

    try {
      const key = `mindclash:reservation:${reservation.reservationId}`;
      const ttlSec = Math.max(1, Math.ceil((reservation.expiresAt - Date.now()) / 1000));
      await this.client.set(key, JSON.stringify(reservation), 'EX', ttlSec);
    } catch (err) {
      logger.warn('[DuplicatePrevention] Redis addReservation error', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  public async getReservation(reservationId: string): Promise<QuestionReservation | null> {
    if (!this.isAvailable()) {
      return this.fallback.getReservation(reservationId);
    }

    try {
      const key = `mindclash:reservation:${reservationId}`;
      const raw = await this.client.get(key);
      if (!raw) return this.fallback.getReservation(reservationId);
      return JSON.parse(raw);
    } catch {
      return this.fallback.getReservation(reservationId);
    }
  }

  public async getActiveReservations(filter?: {
    roomCode?: string;
    type?: QuestionType;
  }): Promise<QuestionReservation[]> {
    // Return from in-memory fallback which is kept synchronized
    return this.fallback.getActiveReservations(filter);
  }

  public async removeReservation(reservationId: string): Promise<void> {
    await this.fallback.removeReservation(reservationId);
    if (!this.isAvailable()) return;

    try {
      await this.client.del(`mindclash:reservation:${reservationId}`);
    } catch {
      // ignore
    }
  }

  public async clearRoom(roomCode: string): Promise<void> {
    await this.fallback.clearRoom(roomCode);
    if (!this.isAvailable()) return;

    try {
      await this.client.del(`mindclash:history:room:${roomCode}`);
    } catch {
      // ignore
    }
  }

  public async clearAll(): Promise<void> {
    await this.fallback.clearAll();
    if (!this.isAvailable()) return;

    try {
      const keys = await this.client.keys('mindclash:*');
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch {
      // ignore
    }
  }

  public async close(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        // ignore
      }
    }
  }
}

// ==========================================
// 5. DUPLICATE PREVENTION SERVICE
// ==========================================

export interface CandidateQuestion {
  text: string;
  correctAnswer?: string;
  category?: string;
  difficulty?: Difficulty;
}

export interface CheckAndReserveOptions {
  roomCode: string;
  type: QuestionType;
  candidates: CandidateQuestion[];
  source?: 'gemini' | 'groq' | 'openai' | 'offline';
  reservationTtlMs?: number; // default 5 minutes
  historyTtlMs?: number; // default 24 hours
}

export interface ReservationResult {
  success: boolean;
  reservationId?: string;
  entries?: HistoryEntry[];
  rejectedDuplicates?: Array<{
    candidate: CandidateQuestion;
    reason: 'exact' | 'fingerprint' | 'paraphrase' | 'intra_batch';
    matchedWith?: string;
  }>;
}

export class DuplicatePreventionService {
  private adapter: DuplicateHistoryAdapter;
  private historyTtlMs: number;
  private reservationTtlMs: number;

  constructor(customAdapter?: DuplicateHistoryAdapter) {
    if (customAdapter) {
      this.adapter = customAdapter;
    } else if (process.env.REDIS_URL) {
      this.adapter = new RedisHistoryAdapter(process.env.REDIS_URL);
    } else {
      this.adapter = new InMemoryHistoryAdapter();
    }

    this.historyTtlMs = parseInt(process.env.HISTORY_TTL_MS || '', 10) || 24 * 60 * 60 * 1000; // 24h
    this.reservationTtlMs = parseInt(process.env.RESERVATION_TTL_MS || '', 10) || 5 * 60 * 1000; // 5 min
  }

  public setAdapter(adapter: DuplicateHistoryAdapter): void {
    this.adapter = adapter;
  }

  public getAdapter(): DuplicateHistoryAdapter {
    return this.adapter;
  }

  /**
   * Validates candidates against intra-batch duplicates, existing room/global history,
   * and active reservations. If all are valid, reserves them with a lease.
   */
  public async checkAndReserve(options: CheckAndReserveOptions): Promise<ReservationResult> {
    const { roomCode, type, candidates, source, reservationTtlMs, historyTtlMs } = options;
    const now = Date.now();
    const effectiveResTtl = reservationTtlMs || this.reservationTtlMs;
    const effectiveHistTtl = historyTtlMs || this.historyTtlMs;

    // 1. Fetch relevant history (room-specific and recent global)
    const [roomHistory, globalHistory, activeReservations] = await Promise.all([
      this.adapter.getRecentEntries({ roomCode, type }),
      this.adapter.getRecentEntries({ type }),
      this.adapter.getActiveReservations({ type }),
    ]);

    // Build comparison pool of all past entries and currently reserved entries
    const reservedEntries = activeReservations
      // If reservation belongs to different room or is active, compare
      .flatMap((r) => r.entries);

    const comparisonEntries: HistoryEntry[] = [...roomHistory, ...globalHistory, ...reservedEntries];

    const acceptedEntries: HistoryEntry[] = [];
    const rejected: ReservationResult['rejectedDuplicates'] = [];

    // 2. Validate each candidate
    for (const cand of candidates) {
      const normText = normalizeText(cand.text);
      if (!normText) {
        rejected.push({ candidate: cand, reason: 'exact' });
        continue;
      }

      const stableId = generateStableId(type, cand.text);
      const fp = calculateFingerprint(cand.text);
      const tokens = extractKeywords(cand.text);

      // A. Check intra-batch duplication against accepted candidates
      let intraDuplicate = false;
      for (const accepted of acceptedEntries) {
        const check = areDuplicateOrParaphrase(
          cand.text,
          accepted.normalizedText,
          cand.correctAnswer,
          accepted.correctAnswer
        );
        if (check.isDuplicate) {
          rejected.push({
            candidate: cand,
            reason: 'intra_batch',
            matchedWith: accepted.normalizedText,
          });
          intraDuplicate = true;
          break;
        }
      }
      if (intraDuplicate) continue;

      // B. Check against comparison history & active reservations
      let historyDuplicate = false;
      for (const existing of comparisonEntries) {
        // Fast ID or fingerprint match
        if (existing.id === stableId || (existing.fingerprint && existing.fingerprint === fp)) {
          rejected.push({
            candidate: cand,
            reason: 'exact',
            matchedWith: existing.normalizedText,
          });
          historyDuplicate = true;
          break;
        }

        // Paraphrase check
        const check = areDuplicateOrParaphrase(
          cand.text,
          existing.normalizedText,
          cand.correctAnswer,
          existing.correctAnswer
        );
        if (check.isDuplicate) {
          rejected.push({
            candidate: cand,
            reason: check.reason || 'paraphrase',
            matchedWith: existing.normalizedText,
          });
          historyDuplicate = true;
          break;
        }
      }
      if (historyDuplicate) continue;

      // Candidate is valid and unique!
      acceptedEntries.push({
        id: stableId,
        type,
        fingerprint: fp,
        normalizedText: normText,
        tokens,
        correctAnswer: cand.correctAnswer ? normalizeText(cand.correctAnswer) : undefined,
        category: cand.category,
        difficulty: cand.difficulty,
        roomCode,
        source,
        recordedAt: now,
        expiresAt: now + effectiveHistTtl,
      });
    }

    // If any candidates failed, return rejected list without reserving
    if (rejected.length > 0 || acceptedEntries.length !== candidates.length) {
      return {
        success: false,
        rejectedDuplicates: rejected,
        entries: acceptedEntries,
      };
    }

    // 3. Create active reservation
    const reservationId = `res_${type}_${roomCode}_${Date.now()}_${crypto.randomInt(1000, 9999)}`;
    const reservation: QuestionReservation = {
      reservationId,
      roomCode,
      type,
      entries: acceptedEntries,
      reservedAt: now,
      expiresAt: now + effectiveResTtl,
    };

    await this.adapter.addReservation(reservation);

    return {
      success: true,
      reservationId,
      entries: acceptedEntries,
    };
  }

  /**
   * Commits reserved entries into durable/in-memory history for the room.
   */
  public async commitReservation(reservationId: string): Promise<void> {
    const reservation = await this.adapter.getReservation(reservationId);
    if (!reservation) return;

    await this.adapter.addEntries(reservation.entries);
    await this.adapter.removeReservation(reservationId);
  }

  /**
   * Releases an active reservation without committing (e.g. on cancellation, error, or retry).
   */
  public async releaseReservation(reservationId: string): Promise<void> {
    await this.adapter.removeReservation(reservationId);
  }

  /**
   * Cleans up room reservations and optionally room history when room is destroyed.
   */
  public async clearRoom(roomCode: string): Promise<void> {
    await this.adapter.clearRoom(roomCode);
  }

  public async clearAll(): Promise<void> {
    await this.adapter.clearAll();
  }
}

// Global singleton instance
export const duplicatePrevention = new DuplicatePreventionService();
