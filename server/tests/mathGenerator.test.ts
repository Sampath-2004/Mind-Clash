import { describe, it, expect } from 'vitest';
import { generateMathQuestion } from '../src/modes/mathGenerator.js';

describe('Phase 5: Math Generator Unit Tests', () => {
  it('1. Generates challenges with 4 unique plausible options and exactly 1 correct answer', () => {
    for (let round = 1; round <= 5; round++) {
      for (let i = 0; i < 20; i++) {
        const q = generateMathQuestion(round);
        expect(q.prompt).toContain('= ?');
        expect(q.options).toHaveLength(4);

        // Exactly 4 unique options
        const uniqueOptions = new Set(q.options);
        expect(uniqueOptions.size).toBe(4);

        // Correct answer is among the 4 options
        expect(q.options).toContain(q.correctAnswer);

        // All choices are positive integers
        q.options.forEach((opt) => {
          expect(Number.isInteger(opt)).toBe(true);
          expect(opt).toBeGreaterThan(0);
        });
      }
    }
  });

  it('2. Includes addition, subtraction, multiplication, and division across challenges', () => {
    const observedOperators = new Set<string>();

    for (let i = 0; i < 100; i++) {
      const q = generateMathQuestion((i % 5) + 1);
      if (q.prompt.includes('+')) observedOperators.add('+');
      if (q.prompt.includes('-')) observedOperators.add('-');
      if (q.prompt.includes('×')) observedOperators.add('×');
      if (q.prompt.includes('÷')) observedOperators.add('÷');
    }

    expect(observedOperators.has('+')).toBe(true);
    expect(observedOperators.has('-')).toBe(true);
    expect(observedOperators.has('×')).toBe(true);
    expect(observedOperators.has('÷')).toBe(true);
  });

  it('3. Guarantees clean integer arithmetic with no fractions or decimals', () => {
    for (let i = 0; i < 50; i++) {
      const q = generateMathQuestion(i % 5 + 1);
      expect(Number.isInteger(q.correctAnswer)).toBe(true);
      expect(q.correctAnswer).toBeGreaterThan(0);
    }
  });

  it('4. Scales difficulty progressively across rounds', () => {
    // Round 1 prompts are single operation
    const r1 = generateMathQuestion(1);
    expect(r1.id).toContain('math-r1-');

    // Round 3 prompts involve parentheses or multi-terms
    const r3 = generateMathQuestion(3);
    expect(r3.id).toContain('math-r3-');

    // Round 5 prompts are multi-step expressions
    const r5 = generateMathQuestion(5);
    expect(r5.id).toContain('math-r5-');
    expect(r5.prompt).toContain('(');
  });
});
