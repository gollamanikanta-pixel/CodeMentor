import type { LearningError } from '../types';
import { bracketBalance, detectRecursion, findLine, JS_KNOWN_ERRORS, makeError, summarizeError, type AnalyzerContext } from './ruleHelpers';
import type { RuleResult } from './pythonRules';

const CONCEPT_TESTS: Array<{ concept: string; test: (source: string) => boolean }> = [
  { concept: 'Functions', test: (s) => /\bfunction\b|=>/.test(s) },
  { concept: 'Loops', test: (s) => /\b(for|while|do)\b/.test(s) },
  { concept: 'Conditions', test: (s) => /\b(if|else|switch|case)\b/.test(s) },
  { concept: 'Return', test: (s) => /\breturn\b/.test(s) },
  { concept: 'Arrays', test: (s) => /\[[^\]]*\]/.test(s) },
  { concept: 'Objects', test: (s) => /\{[^}]*:/.test(s) },
  { concept: 'Output', test: (s) => /console\.(log|info|warn|error)/.test(s) },
  { concept: 'Input', test: (s) => /\binput\s*\(|readline/.test(s) },
  { concept: 'Comparisons', test: (s) => /===|!==|==|!=/.test(s) },
  { concept: 'Variables', test: (s) => /\b(const|let|var)\b/.test(s) },
  { concept: 'Comments', test: (s) => /\/\/|\/\*/.test(s) },
  // Structural shapes. These sit last so the everyday concepts keep their
  // existing order in the analysis panel.
  { concept: 'Recursion', test: (s) => detectRecursion(s) },
  { concept: 'Stacks', test: (s) => /\.push\(/.test(s) && /\.pop\(\s*\)/.test(s) },
  { concept: 'Queues', test: (s) => /\.shift\(/.test(s) || /\.unshift\(/.test(s) },
];

export function detectJavascriptConcepts(source: string): string[] {
  const concepts: string[] = [];
  for (const { concept, test } of CONCEPT_TESTS) {
    if (test(source)) concepts.push(concept);
  }
  return concepts;
}

function runtimeErrorFromExecution(context: AnalyzerContext): LearningError | null {
  if (context.status !== 'runtime_error' && context.status !== 'syntax_error') return null;
  const text = `${context.stderr || ''}\n${context.message || ''}`;
  const kind = Object.keys(JS_KNOWN_ERRORS).find((name) => text.includes(name));
  const isSyntax = context.status === 'syntax_error' || /SyntaxError/.test(text);
  const resolved: Partial<LearningError> & { type: string; title: string } =
    (kind ? JS_KNOWN_ERRORS[kind] : null) ??
    (isSyntax
      ? JS_KNOWN_ERRORS.SyntaxError
      : {
          type: 'RuntimeError',
          title: 'The program stopped while running',
          category: 'Runtime',
          whatHappened: 'An exception was thrown before the program could finish.',
          whyItHappened: 'An operation met a value or state it could not handle.',
        });
  return makeError({
    ...resolved,
    severity: 'error',
    line: context.errorLine ?? null,
    lineConfidence: context.errorLineConfidence ?? 'unknown',
    technicalMessage: summarizeError(context.stderr || context.message || '') || resolved.title,
    confidence: context.errorLine ? 'high' : 'medium',
  });
}

export function analyzeJavascript(context: AnalyzerContext): RuleResult {
  const { source, lines } = context;
  const errors: LearningError[] = [];
  const warnings: string[] = [];
  const concepts = detectJavascriptConcepts(source);
  const stripped = source.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

  const executionError = runtimeErrorFromExecution(context);
  if (executionError) errors.push(executionError);

  const balance = bracketBalance(stripped);
  const unbalanced: string[] = [];
  if (balance.round !== 0) unbalanced.push('parentheses ( )');
  if (balance.square !== 0) unbalanced.push('square brackets [ ]');
  if (balance.curly !== 0) unbalanced.push('braces { }');
  if (unbalanced.length && !executionError) {
    const line = findLine(lines, /\(|\[|\{/);
    errors.push(
      makeError({
        type: 'UnbalancedBrackets',
        title: 'Some brackets may not be paired',
        category: 'Syntax',
        line,
        lineConfidence: line ? 'estimated' : 'unknown',
        technicalMessage: `Unmatched ${unbalanced.join(', ')} detected.`,
        whatHappened: 'An opening bracket may be missing its closing partner.',
        whyItHappened: 'Brackets must balance for the parser to understand the structure.',
        gentleHint: 'Look for a bracket whose partner is missing.',
        guidedHint: 'Match each opening bracket with the closing one.',
        learningHint: 'Well-formed code keeps every delimiter balanced.',
        conceptReminder: 'Balanced delimiters are required syntax.',
        selfCheckQuestion: 'Which bracket on this line is still waiting for its partner?',
        confidence: 'medium',
      }),
    );
  }

  // Loose equality hint.
  const looseEquals = findLine(lines, /[^=!<>]==[^=]|[^=!<>]!=[^=]/);
  if (looseEquals) {
    errors.push(
      makeError({
        type: 'LooseEquality',
        title: 'A loose comparison may give a surprising result',
        category: 'Logic',
        severity: 'hint',
        line: looseEquals,
        lineConfidence: 'estimated',
        technicalMessage: 'Loose equality (== or !=) detected.',
        whatHappened: 'Loose equality converts types before comparing, which can surprise beginners.',
        whyItHappened: 'Different types may still compare as equal, such as a number and its text form.',
        gentleHint: 'Think about whether both sides are the same type here.',
        guidedHint: 'Strict comparison checks type and value together.',
        learningHint: 'Strict comparisons make intent explicit and avoid hidden conversions.',
        conceptReminder: 'Comparing type and value together is usually safer.',
        selfCheckQuestion: 'Do you expect these two values to be the same type?',
        confidence: 'low',
      }),
    );
  }

  // Literal division by zero.
  const literalZero = findLine(lines, /\/\s*0(?![.\d])/);
  if (literalZero) {
    errors.push(
      makeError({
        type: 'DivisionByZero',
        title: 'This calculation divides by zero',
        category: 'Logic',
        severity: 'error',
        line: literalZero,
        lineConfidence: 'exact',
        technicalMessage: 'Literal division by zero.',
        whatHappened: 'Dividing a number by zero produces Infinity or NaN rather than a normal value.',
        whyItHappened: 'The denominator is a literal zero.',
        gentleHint: 'Look at the value used as the denominator.',
        guidedHint: 'Decide what the program should produce when the denominator is zero.',
        learningHint: 'Guard calculations against zero before dividing.',
        conceptReminder: 'Boundary conditions keep math safe.',
        selfCheckQuestion: 'What should this calculation return when the count is zero?',
        confidence: 'high',
      }),
    );
  }

  // Length-based division risk (empty array).
  const lengthDivision = findLine(lines, /\/\s*[A-Za-z_$][\w$]*\.length/);
  if (lengthDivision) {
    errors.push(
      makeError({
        type: 'EmptyArrayRisk',
        title: 'This calculation depends on an array length',
        category: 'Logic',
        line: lengthDivision,
        lineConfidence: 'estimated',
        technicalMessage: 'The denominator comes from .length.',
        whatHappened: 'If the array is empty, the length is zero and the result becomes NaN or Infinity.',
        whyItHappened: 'The code divides by a length without checking for the empty case.',
        gentleHint: 'Consider what this denominator is when the array has no items.',
        guidedHint: 'Think about how the result should behave for an empty array.',
        learningHint: 'Check collection size before dividing by it.',
        conceptReminder: 'Empty collections are common boundary cases.',
        selfCheckQuestion: 'What should happen when the array is empty?',
        confidence: 'medium',
      }),
    );
  }

  // Off-by-one: index <= arr.length inside a loop bound.
  const offByOne = findLine(lines, /<=\s*[A-Za-z_$][\w$]*\.length/);
  if (offByOne) {
    errors.push(
      makeError({
        type: 'PossibleOffByOne',
        title: 'This loop bound may run one step too far',
        category: 'Logic',
        line: offByOne,
        lineConfidence: 'estimated',
        technicalMessage: 'A loop compares with <= length.',
        whatHappened: 'The last pass of the loop would use an index equal to the length, which is past the end.',
        whyItHappened: 'Valid indices run from 0 to length minus one.',
        gentleHint: 'Compare the loop condition with the last valid index.',
        guidedHint: 'Think about whether the bound should be less than the length.',
        learningHint: 'Off-by-one errors usually come from using the length as an index.',
        conceptReminder: 'Valid array indices run from 0 to length − 1.',
        selfCheckQuestion: 'What is the final index this loop reaches?',
        confidence: 'medium',
      }),
    );
  }

  // Assignment inside a condition.
  const assignmentInCondition = findLine(lines, /^\s*(if|while)\s*\([^)]*[^=!<>]=[^=]/);
  if (assignmentInCondition) {
    errors.push(
      makeError({
        type: 'AssignmentInCondition',
        title: 'An assignment may have been used instead of a comparison',
        category: 'Logic',
        severity: 'hint',
        line: assignmentInCondition,
        lineConfidence: 'estimated',
        technicalMessage: 'Single = found inside if/while.',
        whatHappened: 'A single equals sign assigns rather than compares.',
        whyItHappened: 'It is easy to type = when a comparison was intended.',
        gentleHint: 'Check whether this condition is meant to compare values.',
        guidedHint: 'Comparison uses two or three equals signs.',
        learningHint: 'Assignment and comparison are different operations.',
        conceptReminder: 'Conditions test values.',
        selfCheckQuestion: 'Did you mean to compare here?',
        confidence: 'low',
      }),
    );
  }

  // Missing semicolon is only ever a gentle suggestion, never an error.
  if (/\bconsole\.log\([^)]*\)\s*;/.test(source) === false && /console\.log\(/.test(source)) {
    warnings.push('Adding semicolons consistently can make statements easier to scan.');
  }

  if (!source.trim()) warnings.push('The editor is empty — write or upload code to begin learning.');

  return { errors, concepts, warnings };
}
