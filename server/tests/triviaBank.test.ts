import { describe, it, expect } from 'vitest';
import { TRIVIA_BANK, getRandomTriviaQuestion } from '../src/modes/triviaBank.js';

describe('Phase 5: Trivia Bank & Question Selection Unit Tests', () => {
  it('1. Question bank contains at least 100 verified curated questions', () => {
    expect(TRIVIA_BANK.length).toBeGreaterThanOrEqual(100);
    // Specifically, we crafted 125 questions
    expect(TRIVIA_BANK.length).toBe(125);
  });

  it('2. Covers all 5 required categories with at least 20 questions each', () => {
    const requiredCategories = [
      'Science',
      'Technology',
      'General Knowledge',
      'Geography',
      'Entertainment',
    ] as const;

    const categoryCounts: Record<string, number> = {};
    TRIVIA_BANK.forEach((q) => {
      categoryCounts[q.category] = (categoryCounts[q.category] || 0) + 1;
    });

    requiredCategories.forEach((cat) => {
      expect(categoryCounts[cat]).toBeDefined();
      expect(categoryCounts[cat]).toBeGreaterThanOrEqual(20);
    });
  });

  it('3. Every question has 4 unique options, valid fields, and an explanation', () => {
    const ids = new Set<string>();

    TRIVIA_BANK.forEach((q) => {
      // Unique ID check
      expect(ids.has(q.id)).toBe(false);
      ids.add(q.id);

      // Non-empty question and explanation
      expect(q.question.trim().length).toBeGreaterThan(10);
      expect(q.explanation.trim().length).toBeGreaterThan(10);
      expect(q.correctAnswer.trim().length).toBeGreaterThan(0);

      // Exactly 3 incorrect answers
      expect(q.incorrectAnswers).toHaveLength(3);

      // All 4 answers are distinct
      const allFour = [q.correctAnswer, ...q.incorrectAnswers];
      const uniqueFour = new Set(allFour);
      expect(uniqueFour.size).toBe(4);
    });
  });

  it('4. getRandomTriviaQuestion randomizes answer order and matches correctIndex', () => {
    const observedIndices = new Set<number>();

    // Sample 50 questions and ensure correct answers are distributed across slots 0, 1, 2, 3
    for (let i = 0; i < 50; i++) {
      const q = getRandomTriviaQuestion(new Set());
      expect(q.options).toHaveLength(4);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThanOrEqual(3);

      const raw = TRIVIA_BANK.find((item) => item.id === q.id);
      expect(raw).toBeDefined();
      expect(q.options[q.correctIndex]).toBe(raw!.correctAnswer);

      observedIndices.add(q.correctIndex);
    }

    // Shuffling should have placed correct answers in all 4 slots across 50 runs
    expect(observedIndices.size).toBe(4);
  });

  it('5. Avoids repeating questions within one game session', () => {
    const usedIds = new Set<string>();
    const rounds = 10;

    for (let i = 0; i < rounds; i++) {
      const q = getRandomTriviaQuestion(usedIds);
      expect(usedIds.has(q.id)).toBe(false);
      usedIds.add(q.id);
    }

    expect(usedIds.size).toBe(rounds);
  });
});
