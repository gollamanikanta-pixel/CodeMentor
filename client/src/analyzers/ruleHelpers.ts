import type { Confidence, LearningError, LineConfidence, RunStatus } from '../types';

export type AnalyzerContext = {
  source: string;
  lines: string[];
  status?: RunStatus;
  stderr?: string;
  message?: string;
  errorLine?: number | null;
  errorLineConfidence?: LineConfidence;
};

/** Build a fully-populated LearningError so no field is ever left undefined. */
export function makeError(partial: Partial<LearningError> & { type: string; title: string }): LearningError {
  return {
    line: null,
    lineConfidence: 'unknown',
    severity: 'warning',
    category: 'Learning opportunity',
    technicalMessage: 'Review the nearby operation and its inputs.',
    whatHappened: 'The program may meet an unexpected value or state here.',
    whyItHappened: 'This path does not seem to account for every input shape.',
    gentleHint: 'Look closely at the values this step receives.',
    guidedHint: 'Inspect the operation and the data immediately before it.',
    learningHint:
      'Think about the general rule this operation expects, then decide how your program should respond.',
    conceptReminder: 'Boundary conditions help programs behave predictably.',
    selfCheckQuestion: 'What input would exercise this edge case?',
    confidence: 'medium' as Confidence,
    ...partial,
  };
}

/**
 * Reduce a multi-line runtime traceback to the meaningful final exception line
 * so learners see the error itself rather than interpreter internals.
 */
export function summarizeError(text: string, maxChars = 300): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return (lines[lines.length - 1] ?? '').slice(0, maxChars);
}

/** First 1-based line matching a pattern, or null when nothing matches. */
export function findLine(lines: string[], pattern: RegExp): number | null {
  for (let index = 0; index < lines.length; index += 1) {
    if (pattern.test(lines[index])) return index + 1;
  }
  return null;
}

export function findLineIndex(lines: string[], pattern: RegExp): number {
  return lines.findIndex((line) => pattern.test(line));
}

/** Index of the `}` that closes the `{` just before `from`, or null. */
function matchBrace(source: string, from: number): number | null {
  let depth = 1;
  for (let index = from; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return null;
}

/**
 * Locates function bodies without a full parser: brace-matched `function f() {}`,
 * indentation-matched Python `def f():`, and shorthand `const f = (...) => ...`.
 * Only forms we can delimit confidently are returned.
 */
function functionBodies(source: string): Array<{ name: string; body: string }> {
  const bodies: Array<{ name: string; body: string }> = [];

  for (const match of source.matchAll(/\bfunction\s+(\w+)\s*\([^)]*\)\s*\{/g)) {
    const start = (match.index ?? 0) + match[0].length;
    const end = matchBrace(source, start);
    if (end !== null) bodies.push({ name: match[1], body: source.slice(start, end) });
  }

  for (const match of source.matchAll(/^([ \t]*)def\s+(\w+)\s*\([^)]*\)[^\n]*:[ \t]*$/gm)) {
    const indent = match[1].length;
    const rest = source.slice((match.index ?? 0) + match[0].length).split('\n').slice(1);
    const body: string[] = [];
    for (const line of rest) {
      if (line.trim() === '') {
        body.push(line);
        continue;
      }
      if (((line.match(/^[ \t]*/) ?? [''])[0]).length <= indent) break;
      body.push(line);
    }
    bodies.push({ name: match[2], body: body.join('\n') });
  }

  for (const match of source.matchAll(/\b(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>/g)) {
    const start = (match.index ?? 0) + match[0].length;
    const rest = source.slice(start);
    const brace = rest.indexOf('{');
    const lineEnd = rest.indexOf('\n');
    if (brace >= 0 && (lineEnd === -1 || brace < lineEnd)) {
      const end = matchBrace(source, start + brace + 1);
      if (end !== null) bodies.push({ name: match[1], body: source.slice(start + brace, end) });
      continue;
    }
    const stops = [lineEnd, rest.indexOf(';')].filter((position) => position >= 0);
    bodies.push({ name: match[1], body: rest.slice(0, stops.length ? Math.min(...stops) : rest.length) });
  }

  return bodies;
}

/**
 * Detects a function that calls itself.
 *
 * Counting name occurrences globally is not enough: a normal `def f()` that is
 * called once from elsewhere looks identical to a recursive one. So each body is
 * located first and only then searched for a self-call.
 *
 * Conservative by design — if a body cannot be delimited it is skipped rather
 * than guessed at, so a miss only means the call-stack visual is not offered.
 */
export function detectRecursion(source: string): boolean {
  return functionBodies(source).some(({ name, body }) => new RegExp(`\\b${name}\\s*\\(`).test(body));
}

/** Count of each bracket type; nonzero means something is unbalanced. */
export function bracketBalance(source: string): { round: number; square: number; curly: number } {
  const count = (open: string, close: string) => {
    const opens = source.split(open).length - 1;
    const closes = source.split(close).length - 1;
    return opens - closes;
  };
  return {
    round: count('(', ')'),
    square: count('[', ']'),
    curly: count('{', '}'),
  };
}

export type KnownError = {
  type: string;
  title: string;
  category: string;
  whatHappened: string;
  whyItHappened: string;
  gentleHint: string;
  guidedHint: string;
  learningHint: string;
  conceptReminder: string;
  selfCheckQuestion: string;
  concept: string;
};

export const PYTHON_KNOWN_ERRORS: Record<string, KnownError> = {
  SyntaxError: {
    type: 'SyntaxError',
    title: 'The parser could not finish reading the program',
    category: 'Syntax',
    whatHappened: 'Python stopped before running because part of the program did not match Python’s grammar.',
    whyItHappened: 'A delimiter, keyword, or line structure may be incomplete near the reported area.',
    gentleHint: 'Read the reported line slowly and compare it with the line above.',
    guidedHint: 'Check that every opening bracket has a partner and that blocks end with a colon.',
    learningHint:
      'Syntax errors happen before execution, so fixing the structure lets the rest of your logic finally run.',
    conceptReminder: 'Python reads structure (indentation and punctuation) before it runs behaviour.',
    selfCheckQuestion: 'Which symbol on this line might be missing its partner?',
    concept: 'Syntax',
  },
  IndentationError: {
    type: 'IndentationError',
    title: 'A block’s indentation looks inconsistent',
    category: 'Syntax',
    whatHappened: 'Python could not tell which statements belong inside a block.',
    whyItHappened: 'Spaces and tabs may be mixed, or a line inside a block is not indented.',
    gentleHint: 'Look at the whitespace at the start of this line and the one above.',
    guidedHint: 'Every line inside the same block should use the same number of spaces.',
    learningHint: 'Indentation is meaningful in Python: it is how the language groups statements.',
    conceptReminder: 'Consistent indentation keeps blocks readable and valid.',
    selfCheckQuestion: 'Do all lines of this block start at the same depth?',
    concept: 'Indentation',
  },
  NameError: {
    type: 'NameError',
    title: 'A name is used before it exists',
    category: 'Runtime',
    whatHappened: 'The program referenced a variable or function that was not defined at that point.',
    whyItHappened: 'The name may be misspelled, defined later, or never assigned on this path.',
    gentleHint: 'Find where this name is created, and whether that happens before this line.',
    guidedHint: 'Compare the spelling of this name with its definition.',
    learningHint: 'Names become available only after they are assigned or defined at runtime.',
    conceptReminder: 'Order matters: define before you use.',
    selfCheckQuestion: 'Where does this name first receive a value?',
    concept: 'Variables',
  },
  TypeError: {
    type: 'TypeError',
    title: 'An operation received an unexpected type',
    category: 'Runtime',
    whatHappened: 'Something was combined or called with a value of the wrong type.',
    whyItHappened: 'A function may return a different type than expected, or two incompatible values were combined.',
    gentleHint: 'Trace what type each value has right before this operation.',
    guidedHint: 'Check whether a value is text where a number is expected, or the reverse.',
    learningHint: 'Values carry types, and operations usually expect a specific type.',
    conceptReminder: 'Type mismatches are a common source of runtime surprises.',
    selfCheckQuestion: 'What type does each side of this operation actually hold?',
    concept: 'Data types',
  },
  ZeroDivisionError: {
    type: 'ZeroDivisionError',
    title: 'A calculation divided by zero',
    category: 'Runtime',
    whatHappened: 'The program tried to divide by a value that turned out to be zero.',
    whyItHappened: 'The denominator came from an empty collection or a variable that reached zero.',
    gentleHint: 'Inspect the value used as the denominator right before the division.',
    guidedHint: 'Think about what should happen when the denominator is zero.',
    learningHint: 'Guard calculations against the zero case before performing them.',
    conceptReminder: 'Boundary conditions keep math operations safe.',
    selfCheckQuestion: 'When could this denominator become zero?',
    concept: 'Conditions',
  },
  IndexError: {
    type: 'IndexError',
    title: 'An index pointed outside the sequence',
    category: 'Runtime',
    whatHappened: 'The program asked for a position that the list does not have.',
    whyItHappened: 'Valid positions run from 0 to length minus one, and this one is past the end.',
    gentleHint: 'Compare the smallest and largest valid index with the one being used.',
    guidedHint: 'Check whether the index equals the length of the collection.',
    learningHint: 'Off-by-one mistakes are the most common indexing slip.',
    conceptReminder: 'Sequence positions start at zero.',
    selfCheckQuestion: 'Is this index inside the valid range for the current length?',
    concept: 'Lists',
  },
  KeyError: {
    type: 'KeyError',
    title: 'A dictionary key was not found',
    category: 'Runtime',
    whatHappened: 'The program looked up a key that does not exist in the dictionary.',
    whyItHappened: 'The key may be missing, misspelled, or added only on another path.',
    gentleHint: 'Check which keys the dictionary is guaranteed to contain.',
    guidedHint: 'Consider how your program should behave when a key is absent.',
    learningHint: 'Dictionary access assumes the key exists; safe access needs a fallback.',
    conceptReminder: 'Dictionaries map known keys to values.',
    selfCheckQuestion: 'Which keys are always present at this point?',
    concept: 'Dictionaries',
  },
  ValueError: {
    type: 'ValueError',
    title: 'A value had the right type but the wrong content',
    category: 'Runtime',
    whatHappened: 'A function received a value it could not interpret, such as non-numeric text where a number was needed.',
    whyItHappened: 'The input did not match what the conversion function expected.',
    gentleHint: 'Look at what the input actually contains before it is converted.',
    guidedHint: 'Think about validating input before converting it.',
    learningHint: 'Validate content, not only type, before transforming values.',
    conceptReminder: 'Input validation makes programs resilient.',
    selfCheckQuestion: 'What would this conversion receive for unexpected input?',
    concept: 'Input',
  },
  ImportError: {
    type: 'ImportError',
    title: 'A module could not be imported',
    category: 'Runtime',
    whatHappened: 'Python could not load a module the program depends on.',
    whyItHappened: 'The module may be misspelled or unavailable in this environment.',
    gentleHint: 'Check the module name and whether the environment provides it.',
    guidedHint: 'Confirm the spelling and think about what to do if the import fails.',
    learningHint: 'Imports are dependencies; programs should handle missing ones gracefully.',
    conceptReminder: 'Every import is an external dependency.',
    selfCheckQuestion: 'Is this module guaranteed to be available?',
    concept: 'Imports',
  },
};

export const JS_KNOWN_ERRORS: Record<string, KnownError> = {
  SyntaxError: {
    ...PYTHON_KNOWN_ERRORS.SyntaxError,
    whatHappened: 'JavaScript stopped parsing because part of the program did not match the language grammar.',
    whyItHappened: 'A bracket, quote, or statement may be incomplete near the reported area.',
    concept: 'Syntax',
  },
  ReferenceError: {
    ...PYTHON_KNOWN_ERRORS.NameError,
    category: 'Runtime',
    concept: 'Variables',
  },
  TypeError: {
    ...PYTHON_KNOWN_ERRORS.TypeError,
    whatHappened: 'A value was used in a way its type does not support, such as reading a property of undefined.',
    concept: 'Data types',
  },
  RangeError: {
    type: 'RangeError',
    title: 'A value was outside the allowed range',
    category: 'Runtime',
    whatHappened: 'A number or length went beyond what the operation allows.',
    whyItHappened: 'A size, index, or numeric value may be invalid or negative.',
    gentleHint: 'Check the numeric value this operation receives.',
    guidedHint: 'Think about the valid range the operation accepts.',
    learningHint: 'Each operation has limits; respecting them prevents crashes.',
    conceptReminder: 'Boundaries apply to numbers too.',
    selfCheckQuestion: 'What is the largest value this operation accepts?',
    concept: 'Numbers',
  },
};
