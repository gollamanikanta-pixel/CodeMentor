import type { LearningError } from '../types';
import {
  bracketBalance,
  detectRecursion,
  findLine,
  makeError,
  PYTHON_KNOWN_ERRORS,
  summarizeError,
  type AnalyzerContext,
} from './ruleHelpers';

export type RuleResult = { errors: LearningError[]; concepts: string[]; warnings: string[] };

const CONCEPT_TESTS: Array<{ concept: string; test: (source: string) => boolean }> = [
  { concept: 'Functions', test: (s) => /^\s*def\s+\w+/m.test(s) },
  { concept: 'Loops', test: (s) => /\b(for|while)\b/.test(s) },
  { concept: 'Conditions', test: (s) => /\b(if|elif|else)\b/.test(s) },
  { concept: 'Return', test: (s) => /\breturn\b/.test(s) },
  { concept: 'Lists', test: (s) => /\[[^\]]*\]|list\(/.test(s) },
  { concept: 'Dictionaries', test: (s) => /\{[^}]*:|dict\(/.test(s) },
  { concept: 'Input', test: (s) => /\binput\(/.test(s) },
  { concept: 'Output', test: (s) => /\bprint\(/.test(s) },
  { concept: 'Imports', test: (s) => /^\s*(import|from)\s+\w+/m.test(s) },
  { concept: 'Comments', test: (s) => /#/.test(s) },
  { concept: 'Variables', test: (s) => /\w+\s*=\s*[^=]/.test(s) },
  // Structural shapes. These sit last so the everyday concepts keep their
  // existing order in the analysis panel.
  { concept: 'Recursion', test: (s) => detectRecursion(s) },
  { concept: 'Stacks', test: (s) => /\.append\(/.test(s) && /\.pop\(\s*\)/.test(s) },
  { concept: 'Queues', test: (s) => /\.popleft\(\s*\)/.test(s) || /\bdeque\b/.test(s) || /\.pop\(\s*0\s*\)/.test(s) },
];

export function detectPythonConcepts(source: string): string[] {
  const concepts: string[] = [];
  for (const { concept, test } of CONCEPT_TESTS) {
    if (test(source)) concepts.push(concept);
  }
  return concepts;
}

/** Map a runtime traceback to a known learning error when we recognise it. */
function runtimeErrorFromExecution(context: AnalyzerContext): LearningError | null {
  if (context.status !== 'runtime_error' && context.status !== 'syntax_error') return null;
  const text = `${context.stderr || ''}\n${context.message || ''}`;
  const kind = Object.keys(PYTHON_KNOWN_ERRORS).find((name) => text.includes(name));
  const isSyntax = context.status === 'syntax_error' || /SyntaxError|IndentationError/.test(text);
  const resolved: Partial<LearningError> & { type: string; title: string } =
    (kind ? PYTHON_KNOWN_ERRORS[kind] : null) ??
    (isSyntax
      ? PYTHON_KNOWN_ERRORS.SyntaxError
      : {
          type: 'RuntimeError',
          title: 'The program stopped while running',
          category: 'Runtime',
          whatHappened: 'The program raised an exception before it could finish.',
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

export function analyzePython(context: AnalyzerContext): RuleResult {
  const { source, lines } = context;
  const errors: LearningError[] = [];
  const warnings: string[] = [];
  const concepts = detectPythonConcepts(source);

  const executionError = runtimeErrorFromExecution(context);
  if (executionError) errors.push(executionError);

  // Unmatched brackets — a very common beginner syntax slip.
  const balance = bracketBalance(source.replace(/#.*$/gm, ''));
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
        whatHappened: 'An opening bracket may be missing its closing partner somewhere in the program.',
        whyItHappened: 'Brackets usually come in pairs; a missing or extra one breaks the structure.',
        gentleHint: 'Scan the program for brackets that do not look balanced.',
        guidedHint: 'Count each opening bracket and match it with the closing one on its own line.',
        learningHint: 'Balanced delimiters are a structural rule in nearly every language.',
        conceptReminder: 'Pairs of delimiters keep expressions well-formed.',
        selfCheckQuestion: 'Which opening bracket on this line has no closing partner yet?',
        confidence: 'medium',
      }),
    );
  }

  // A block opener that is not followed by an indented line.
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!/^\s*(def|for|while|if|elif|else|try|except|class|with)\b.*:\s*$/.test(line)) continue;
    const next = lines[index + 1];
    if (next !== undefined && next.trim() !== '' && !/^\s/.test(next)) {
      errors.push(
        makeError({
          type: 'IncompleteBlock',
          title: 'A block may be missing its indented body',
          category: 'Syntax',
          severity: 'error',
          line: index + 1,
          lineConfidence: 'estimated',
          technicalMessage: 'Expected an indented block after this line.',
          whatHappened: 'This line opens a block, but the next line is not indented inside it.',
          whyItHappened: 'A block needs the same minimum indentation, and the first body line is empty or unindented.',
          gentleHint: 'Look at the line directly below the one that ends with a colon.',
          guidedHint: 'Ensure at least one indented statement follows the colon.',
          learningHint: 'A colon means indentation is part of the syntax, not just style.',
          conceptReminder: 'Blocks must be indented, not empty.',
          selfCheckQuestion: 'Which statement is supposed to run inside this block?',
          confidence: 'medium',
        }),
      );
      break;
    }
  }

  // Mixed tabs and spaces.
  const hasTabs = /\t/.test(source);
  const hasIndentSpaces = /^ +/m.test(source);
  if (hasTabs && hasIndentSpaces) {
    const line = findLine(lines, /\t/);
    warnings.push('Mixed tabs and spaces detected — Python prefers consistent indentation.');
    errors.push(
      makeError({
        type: 'MixedIndentation',
        title: 'Tabs and spaces appear to be mixed',
        category: 'Syntax',
        line,
        lineConfidence: line ? 'estimated' : 'unknown',
        technicalMessage: 'Mixed indentation styles detected.',
        whatHappened: 'Some lines are indented with tabs while others use spaces.',
        whyItHappened: 'Editors may insert different whitespace, confusing the parser.',
        gentleHint: 'Pick one indentation style for the whole file.',
        guidedHint: 'Configure your editor to insert spaces instead of tabs.',
        learningHint: 'Consistent whitespace removes an entire class of confusing errors.',
        conceptReminder: 'Indentation is syntax in Python.',
        selfCheckQuestion: 'Which line uses a different whitespace character?',
        confidence: 'high',
      }),
    );
  }

  // Literal division by zero.
  const literalZero = findLine(lines, /\/\s*0(?![.\d])/);
  if (literalZero) {
    errors.push(
      makeError({
        ...PYTHON_KNOWN_ERRORS.ZeroDivisionError,
        severity: 'error',
        line: literalZero,
        lineConfidence: 'exact',
        technicalMessage: 'Literal division by zero.',
        confidence: 'high',
      }),
    );
  }

  // Denominator depends on a collection length (empty-collection risk).
  const lenDivision = findLine(lines, /\/\s*len\s*\(/);
  if (lenDivision) {
    errors.push(
      makeError({
        type: 'EmptyCollectionRisk',
        title: 'This calculation depends on a collection length',
        category: 'Logic',
        severity: 'warning',
        line: lenDivision,
        lineConfidence: 'estimated',
        technicalMessage: 'The denominator is derived from len().',
        whatHappened: 'If the collection is empty, the length is zero and the division fails.',
        whyItHappened: 'The code divides by a count without checking that the count can be greater than zero.',
        gentleHint: 'Think about what the denominator represents when the collection is empty.',
        guidedHint: 'Consider how the function should behave when there is nothing to average.',
        learningHint: 'Guard a calculation against the empty case before dividing.',
        conceptReminder: 'Boundary conditions keep math operations safe.',
        selfCheckQuestion: 'What should the function return when there are no items?',
        confidence: 'medium',
      }),
    );
  }

  // Off-by-one: indexing with len().
  const lenIndex = findLine(lines, /\w+\s*\[\s*len\s*\(/);
  if (lenIndex) {
    errors.push(
      makeError({
        type: 'PossibleOffByOne',
        title: 'This index may be one past the last item',
        category: 'Logic',
        line: lenIndex,
        lineConfidence: 'estimated',
        technicalMessage: 'Indexing with len() reaches past the final element.',
        whatHappened: 'Sequence positions start at 0, so the last valid index is length minus one.',
        whyItHappened: 'Using the length directly as an index goes one step too far.',
        gentleHint: 'Compare the index with the last valid position.',
        guidedHint: 'Recall the valid range of indices for a list of this length.',
        learningHint: 'Off-by-one errors are the classic indexing mistake.',
        conceptReminder: 'Valid indices run from 0 to length − 1.',
        selfCheckQuestion: 'What is the last valid index here?',
        confidence: 'medium',
      }),
    );
  }

  // Assignment used inside a condition (Python allows it syntactically, so this
  // is a hint, never an error).
  const assignmentInCondition = findLine(lines, /^\s*(if|while)\b[^=!<>]*[^=!<>]=[^=]/);
  if (assignmentInCondition) {
    errors.push(
      makeError({
        type: 'AssignmentInCondition',
        title: 'An assignment appears inside a condition',
        category: 'Logic',
        severity: 'hint',
        line: assignmentInCondition,
        lineConfidence: 'estimated',
        technicalMessage: 'A single = inside if/while.',
        whatHappened: 'A single equals sign assigns a value rather than comparing two values.',
        whyItHappened: 'It is easy to type = when a comparison was intended.',
        gentleHint: 'Check whether this line is meant to compare or to store a value.',
        guidedHint: 'Comparison operators use two equals signs; assignment uses one.',
        learningHint: 'Assignment and comparison are different operations.',
        conceptReminder: 'Conditions test values; they do not usually store them.',
        selfCheckQuestion: 'Did you mean to compare instead of assign?',
        confidence: 'low',
      }),
    );
  }

  const commentOnly = lines.filter((line) => line.trim()).length === 0;
  if (commentOnly) {
    warnings.push('The editor is empty — write or upload code to begin learning.');
  }

  return { errors, concepts, warnings };
}
