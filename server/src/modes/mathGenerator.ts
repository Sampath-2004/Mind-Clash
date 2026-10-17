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
    // Medium: Multiplication, exact division, and simple multi-step work (progressive scaling)
    const opType = roundNumber >= 4 ? 2 : crypto.randomInt(0, 3);
    if (opType === 0) {
      // Multiplication times tables up to 12
      const a = crypto.randomInt(4, 12);
      const b = crypto.randomInt(4, 12);
      const ans = a * b;
      problem = {
        prompt: `${a} × ${b} = ?`,
        correctAnswer: ans,
        plausibleDistractors: [ans + a, ans - b, ans + 2, ans - 4, ans + 10],
      };
    } else if (opType === 1) {
      // Exact division
      const divisor = crypto.randomInt(3, 10);
      const quotient = crypto.randomInt(4, 12);
      const dividend = divisor * quotient;
      problem = {
        prompt: `${dividend} ÷ ${divisor} = ?`,
        correctAnswer: quotient,
        plausibleDistractors: [quotient + 1, quotient - 1, quotient + 2, quotient - 2],
      };
    } else {
      // Combined 2-step: (a × b) + c or (a × b) - c
      const isAdd = crypto.randomInt(0, 2) === 0;
      const a = crypto.randomInt(4, 9);
      const b = crypto.randomInt(3, 8);
      if (isAdd) {
        const c = crypto.randomInt(5, 25);
        const ans = a * b + c;
        problem = {
          prompt: `(${a} × ${b}) + ${c} = ?`,
          correctAnswer: ans,
          plausibleDistractors: [a * (b + c), a * b + c + 10, a * b + c - 2, ans + 4],
        };
      } else {
        const prod = a * b;
        const c = crypto.randomInt(1, Math.max(2, prod - 3));
        const ans = prod - c;
        problem = {
          prompt: `(${a} × ${b}) - ${c} = ?`,
          correctAnswer: ans,
          plausibleDistractors: [ans + 10, ans - 10, ans + c, ans - 2],
        };
      }
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
