import crypto from 'crypto';
import { MathQuestionServer, DEFAULT_QUESTION_DURATION_MS } from '@mind-clash/shared';

interface ProblemTemplate {
  prompt: string;
  correctAnswer: number;
  plausibleDistractors: number[];
}

/**
 * Generates an arithmetic challenge with scaled difficulty based on the round number.
 * Guarantees integer division (no decimals), strictly positive results, and 4 plausible choices.
 */
export function generateMathQuestion(roundNumber: number = 1): MathQuestionServer {
  const level = Math.max(1, Math.min(5, roundNumber));
  let problem: ProblemTemplate;

  switch (level) {
    case 1: {
      // Level 1 (Easy / Warmup): Clean single operations
      const opType = crypto.randomInt(0, 4);
      if (opType === 0) {
        // Addition: 2-digit numbers
        const a = crypto.randomInt(15, 60);
        const b = crypto.randomInt(12, 50);
        const ans = a + b;
        problem = {
          prompt: `${a} + ${b} = ?`,
          correctAnswer: ans,
          plausibleDistractors: [ans - 10, ans + 10, ans - 2, ans + 2, a + b - 1],
        };
      } else if (opType === 1) {
        // Subtraction: positive difference
        const b = crypto.randomInt(12, 45);
        const diff = crypto.randomInt(10, 40);
        const a = b + diff;
        problem = {
          prompt: `${a} - ${b} = ?`,
          correctAnswer: diff,
          plausibleDistractors: [diff + 10, diff - 2, diff + 2, diff - 10],
        };
      } else if (opType === 2) {
        // Multiplication: times tables up to 12
        const a = crypto.randomInt(4, 12);
        const b = crypto.randomInt(4, 12);
        const ans = a * b;
        problem = {
          prompt: `${a} × ${b} = ?`,
          correctAnswer: ans,
          plausibleDistractors: [ans + a, ans - b, ans + 2, ans - 4],
        };
      } else {
        // Clean Division
        const divisor = crypto.randomInt(3, 10);
        const quotient = crypto.randomInt(4, 12);
        const dividend = divisor * quotient;
        problem = {
          prompt: `${dividend} ÷ ${divisor} = ?`,
          correctAnswer: quotient,
          plausibleDistractors: [quotient + 1, quotient - 1, quotient + 2, quotient - 2],
        };
      }
      break;
    }

    case 2: {
      // Level 2 (Medium): Combined 2-operation arithmetic
      const opType = crypto.randomInt(0, 3);
      if (opType === 0) {
        // a * b + c
        const a = crypto.randomInt(5, 11);
        const b = crypto.randomInt(4, 9);
        const c = crypto.randomInt(10, 35);
        const ans = a * b + c;
        problem = {
          prompt: `(${a} × ${b}) + ${c} = ?`,
          correctAnswer: ans,
          plausibleDistractors: [a * (b + c), a * b + c + 10, a * b + c - 4, ans + 2],
        };
      } else if (opType === 1) {
        // a * b - c
        const a = crypto.randomInt(6, 12);
        const b = crypto.randomInt(4, 9);
        const c = crypto.randomInt(5, 20);
        const ans = a * b - c;
        problem = {
          prompt: `(${a} × ${b}) - ${c} = ?`,
          correctAnswer: ans,
          plausibleDistractors: [ans + 10, ans - 10, ans + c, ans - 2],
        };
      } else {
        // Division + Addition: (dividend / divisor) + c
        const divisor = crypto.randomInt(3, 9);
        const quotient = crypto.randomInt(5, 12);
        const dividend = divisor * quotient;
        const c = crypto.randomInt(15, 45);
        const ans = quotient + c;
        problem = {
          prompt: `(${dividend} ÷ ${divisor}) + ${c} = ?`,
          correctAnswer: ans,
          plausibleDistractors: [ans + 10, ans - 5, quotient + c + 2, ans - 2],
        };
      }
      break;
    }

    case 3: {
      // Level 3 (Challenging): Parentheses & Priority operations
      const opType = crypto.randomInt(0, 3);
      if (opType === 0) {
        // (a + b) * c
        const a = crypto.randomInt(6, 18);
        const b = crypto.randomInt(4, 15);
        const c = crypto.randomInt(3, 7);
        const ans = (a + b) * c;
        problem = {
          prompt: `(${a} + ${b}) × ${c} = ?`,
          correctAnswer: ans,
          plausibleDistractors: [a + b * c, ans + c, ans - c, ans + 10], // a + b * c is precedence mistake
        };
      } else if (opType === 1) {
        // (a - b) * c
        const b = crypto.randomInt(5, 15);
        const diff = crypto.randomInt(4, 12);
        const a = b + diff;
        const c = crypto.randomInt(4, 8);
        const ans = diff * c;
        problem = {
          prompt: `(${a} - ${b}) × ${c} = ?`,
          correctAnswer: ans,
          plausibleDistractors: [a - b * c, ans + c, ans - c, ans + 4],
        };
      } else {
        // (dividend / divisor) * multiplier
        const divisor = crypto.randomInt(4, 8);
        const quotient = crypto.randomInt(4, 11);
        const dividend = divisor * quotient;
        const multiplier = crypto.randomInt(3, 6);
        const ans = quotient * multiplier;
        problem = {
          prompt: `(${dividend} ÷ ${divisor}) × ${multiplier} = ?`,
          correctAnswer: ans,
          plausibleDistractors: [ans + multiplier, ans - multiplier, ans + 6, ans - 4],
        };
      }
      break;
    }

    case 4: {
      // Level 4 (Hard): Dual-product & dual-operation calculations
      const opType = crypto.randomInt(0, 3);
      if (opType === 0) {
        // (a * b) + (c * d)
        const a = crypto.randomInt(4, 9);
        const b = crypto.randomInt(4, 9);
        const c = crypto.randomInt(3, 8);
        const d = crypto.randomInt(3, 8);
        const ans = a * b + c * d;
        problem = {
          prompt: `(${a} × ${b}) + (${c} × ${d}) = ?`,
          correctAnswer: ans,
          plausibleDistractors: [ans + 10, ans - 10, (a + c) * (b + d), ans + 4],
        };
      } else if (opType === 1) {
        // (dividend / divisor) + (c * d)
        const divisor = crypto.randomInt(3, 8);
        const quotient = crypto.randomInt(5, 12);
        const dividend = divisor * quotient;
        const c = crypto.randomInt(4, 9);
        const d = crypto.randomInt(4, 8);
        const ans = quotient + c * d;
        problem = {
          prompt: `(${dividend} ÷ ${divisor}) + (${c} × ${d}) = ?`,
          correctAnswer: ans,
          plausibleDistractors: [ans + 5, ans - 5, quotient * c * d, ans + 10],
        };
      } else {
        // (a * b) - (c * d) with guaranteed positive result
        const a = crypto.randomInt(7, 12);
        const b = crypto.randomInt(6, 10);
        const product1 = a * b; // 42 to 120
        const c = crypto.randomInt(3, 6);
        const d = crypto.randomInt(3, 6);
        const product2 = c * d; // 9 to 36
        const ans = product1 - product2;
        problem = {
          prompt: `(${a} × ${b}) - (${c} × ${d}) = ?`,
          correctAnswer: ans,
          plausibleDistractors: [ans + 10, ans - 10, product1 + product2, ans + 2],
        };
      }
      break;
    }

    default: {
      // Level 5 (Master): 3-step rapid mental arithmetic
      const divisor = crypto.randomInt(3, 9);
      const quotient = crypto.randomInt(4, 12);
      const dividend = divisor * quotient;
      const a = crypto.randomInt(6, 12);
      const b = crypto.randomInt(4, 8);
      const c = crypto.randomInt(8, 25);
      const ans = quotient + a * b - c;
      problem = {
        prompt: `(${dividend} ÷ ${divisor}) + (${a} × ${b}) - ${c} = ?`,
        correctAnswer: ans,
        plausibleDistractors: [ans + 10, ans - 10, ans + c, ans - 4],
      };
      break;
    }
  }

  // Construct 4 unique, strictly positive options
  const target = problem.correctAnswer;
  const optionsSet = new Set<number>();
  optionsSet.add(target);

  // First try the custom plausible distractors
  for (const d of problem.plausibleDistractors) {
    if (d > 0 && d !== target) {
      optionsSet.add(d);
    }
    if (optionsSet.size >= 4) break;
  }

  // If still fewer than 4 unique distractors, fill with balanced offsets
  if (optionsSet.size < 4) {
    const candidateOffsets = [-1, 1, -2, 2, -3, 3, -5, 5, -10, 10, -4, 4, -6, 6];
    for (const offset of candidateOffsets) {
      const cand = target + offset;
      if (cand > 0 && cand !== target) {
        optionsSet.add(cand);
      }
      if (optionsSet.size >= 4) break;
    }
  }

  // Shuffle the 4 choices
  const options = Array.from(optionsSet).slice(0, 4);
  for (let i = options.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [options[i], options[j]] = [options[j], options[i]];
  }

  return {
    id: `math-r${level}-${Date.now()}-${crypto.randomInt(100, 999)}`,
    prompt: problem.prompt,
    options,
    correctAnswer: target,
    durationMs: DEFAULT_QUESTION_DURATION_MS,
  };
}
