import crypto from 'crypto';
import { MathQuestionServer, Difficulty, DEFAULT_QUESTION_DURATION_MS } from '@mind-clash/shared';

interface ProblemTemplate {
  prompt: string;
  correctAnswer: number;
  plausibleDistractors: number[];
}

/**
 * Generates an arithmetic challenge scaled by match difficulty and round progression.
 * Guarantees deterministic calculation, integer division (no decimals), strictly positive results,
 * unambiguous readable expressions, and 4 distinct plausible choices.
 */
export function generateMathQuestion(
  roundNumber: number = 1,
  difficulty: Difficulty = 'medium'
): MathQuestionServer {
  let problem: ProblemTemplate;

  if (difficulty === 'easy') {
    // Easy: Small integers (5-35) and simple single addition or subtraction
    const opType = crypto.randomInt(0, 2);
    if (opType === 0) {
      // Addition
      const a = crypto.randomInt(6, 28);
      const b = crypto.randomInt(5, 25);
      const ans = a + b;
      problem = {
        prompt: `${a} + ${b} = ?`,
        correctAnswer: ans,
        plausibleDistractors: [ans - 1, ans + 1, ans + 10, ans - 10, a + b + 2],
      };
    } else {
      // Subtraction (strictly positive)
      const b = crypto.randomInt(5, 22);
      const diff = crypto.randomInt(6, 25);
      const a = b + diff;
      problem = {
        prompt: `${a} - ${b} = ?`,
        correctAnswer: diff,
        plausibleDistractors: [diff + 1, diff - 1, diff + 10, diff - 10, diff + 2],
      };
    }
  } else if (difficulty === 'medium') {
    // Medium: Broader operand variety and multi-step arithmetic (multiplication, exact division, 2-step expressions)
    // 5 diverse problem varieties:
    // 0: Multiplication with extended operands (tables up to 15)
    // 1: Exact division with larger dividends (up to 180)
    // 2: Multi-step: (a × b) ± c
    // 3: Multi-step: (dividend ÷ divisor) ± c
    // 4: Combined multi-step: (a × b) + (dividend ÷ divisor)
    // Late rounds (roundNumber >= 4) strictly scale to multi-step expressions
    const opType = roundNumber >= 4 ? crypto.randomInt(2, 5) : crypto.randomInt(0, 5);

    if (opType === 0) {
      // Extended multiplication with wider operand variety (e.g. 14 × 7, 13 × 8)
      const a = crypto.randomInt(6, 16);
      const b = crypto.randomInt(4, 13);
      const ans = a * b;
      problem = {
        prompt: `${a} × ${b} = ?`,
        correctAnswer: ans,
        plausibleDistractors: [ans + a, ans - b, ans + 10, ans - 10, (a + 1) * b],
      };
    } else if (opType === 1) {
      // Exact division with larger dividends
      const divisor = crypto.randomInt(4, 13);
      const quotient = crypto.randomInt(6, 17);
      const dividend = divisor * quotient;
      problem = {
        prompt: `${dividend} ÷ ${divisor} = ?`,
        correctAnswer: quotient,
        plausibleDistractors: [quotient + 1, quotient - 1, quotient + 2, quotient - 2, quotient + 5],
      };
    } else if (opType === 2) {
      // Combined 2-step: (a × b) + c or (a × b) - c with broader operands
      const isAdd = crypto.randomInt(0, 2) === 0;
      const a = crypto.randomInt(5, 13);
      const b = crypto.randomInt(4, 11);
      const prod = a * b;
      if (isAdd) {
        const c = crypto.randomInt(7, 36);
        const ans = prod + c;
        problem = {
          prompt: `(${a} × ${b}) + ${c} = ?`,
          correctAnswer: ans,
          plausibleDistractors: [a * (b + c), prod + c + 10, prod + c - 10, ans + 4, ans - 6],
        };
      } else {
        const c = crypto.randomInt(3, Math.max(4, prod - 5));
        const ans = prod - c;
        problem = {
          prompt: `(${a} × ${b}) - ${c} = ?`,
          correctAnswer: ans,
          plausibleDistractors: [ans + 10, ans - 10, ans + c, ans - 4, ans + 6],
        };
      }
    } else if (opType === 3) {
      // Multi-step exact division with offset: (dividend ÷ divisor) ± c
      const divisor = crypto.randomInt(3, 11);
      const quotient = crypto.randomInt(7, 21);
      const dividend = divisor * quotient;
      const isAdd = crypto.randomInt(0, 2) === 0;
      if (isAdd) {
        const c = crypto.randomInt(6, 28);
        const ans = quotient + c;
        problem = {
          prompt: `(${dividend} ÷ ${divisor}) + ${c} = ?`,
          correctAnswer: ans,
          plausibleDistractors: [ans + 10, ans - 10, quotient + c + 2, quotient * c, ans - 3],
        };
      } else {
        const c = crypto.randomInt(2, Math.max(3, quotient - 2));
        const ans = quotient - c;
        problem = {
          prompt: `(${dividend} ÷ ${divisor}) - ${c} = ?`,
          correctAnswer: ans,
          plausibleDistractors: [ans + 10, ans - 10, quotient + c, ans + 2, ans - 2],
        };
      }
    } else {
      // Combined multi-step: (a × b) + (dividend ÷ divisor)
      const a = crypto.randomInt(4, 10);
      const b = crypto.randomInt(3, 8);
      const divDivisor = crypto.randomInt(3, 8);
      const divQuotient = crypto.randomInt(3, 10);
      const divDividend = divDivisor * divQuotient;
      const ans = a * b + divQuotient;
      problem = {
        prompt: `(${a} × ${b}) + (${divDividend} ÷ ${divDivisor}) = ?`,
        correctAnswer: ans,
        plausibleDistractors: [ans + 10, ans - 10, a * b + divDividend, ans + 2, ans - 4],
      };
    }
  } else {
    // Hard: Larger values, multi-step expressions, and nested operations
    const opType = crypto.randomInt(0, 3);
    if (opType === 0) {
      // Two multiplications combined: (a × b) + (c × d)
      const a = crypto.randomInt(5, 12);
      const b = crypto.randomInt(4, 10);
      const c = crypto.randomInt(3, 8);
      const d = crypto.randomInt(3, 7);
      const ans = a * b + c * d;
      problem = {
        prompt: `(${a} × ${b}) + (${c} × ${d}) = ?`,
        correctAnswer: ans,
        plausibleDistractors: [ans + 10, ans - 10, a * b + c, ans + 4, ans - 6],
      };
    } else if (opType === 1) {
      // Parenthetical multiplication: (a + b) × c
      const a = crypto.randomInt(7, 18);
      const b = crypto.randomInt(6, 16);
      const c = crypto.randomInt(4, 9);
      const ans = (a + b) * c;
      problem = {
        prompt: `(${a} + ${b}) × ${c} = ?`,
        correctAnswer: ans,
        plausibleDistractors: [a + b * c, ans + 10, ans - 10, (a + b) * (c + 1)],
      };
    } else {
      // Division with subtraction / offset: (dividend ÷ divisor) + c or - c
      const divisor = crypto.randomInt(4, 9);
      const quotient = crypto.randomInt(12, 35);
      const dividend = divisor * quotient;
      const c = crypto.randomInt(6, 20);
      const ans = quotient + c;
      problem = {
        prompt: `(${dividend} ÷ ${divisor}) + ${c} = ?`,
        correctAnswer: ans,
        plausibleDistractors: [ans + 10, ans - 10, quotient * c, ans + 2],
      };
    }
  }

  // Filter distinct distractors that do not equal the correct answer
  const uniqueDistractors: number[] = [];
  for (const d of problem.plausibleDistractors) {
    if (d !== problem.correctAnswer && d > 0 && !uniqueDistractors.includes(d)) {
      uniqueDistractors.push(d);
    }
    if (uniqueDistractors.length === 3) break;
  }

  // Fallback if needed to guarantee 3 distinct distractors
  let delta = 1;
  while (uniqueDistractors.length < 3) {
    const candidateHigh = problem.correctAnswer + delta;
    const candidateLow = problem.correctAnswer - delta;
    if (!uniqueDistractors.includes(candidateHigh)) {
      uniqueDistractors.push(candidateHigh);
    }
    if (uniqueDistractors.length < 3 && candidateLow > 0 && !uniqueDistractors.includes(candidateLow)) {
      uniqueDistractors.push(candidateLow);
    }
    delta++;
  }

  // Shuffle options
  const options = [problem.correctAnswer, ...uniqueDistractors.slice(0, 3)];
  for (let i = options.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [options[i], options[j]] = [options[j], options[i]];
  }

  return {
    id: `math-r${roundNumber}-${difficulty}-${Date.now()}-${crypto.randomInt(100, 999)}`,
    prompt: problem.prompt,
    options,
    correctAnswer: problem.correctAnswer,
    durationMs: DEFAULT_QUESTION_DURATION_MS,
  };
}
