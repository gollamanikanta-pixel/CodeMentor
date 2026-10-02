import type {
  AnalysisLanguage,
  AnalyzableLanguage,
  DiagramKind,
  ExecutionResult,
  LineExplanation,
  LocalAnalysis,
  StructuralLanguage,
} from '../types';
import { analyzePython } from './pythonRules';
import { analyzeJavascript } from './javascriptRules';
import { analyzeTypescript } from './typescriptRules';
import { analyzeHtml } from './htmlRules';
import { analyzeSql } from './sqlRules';
import { analyzeStructurally } from './structuralAnalyzer';
import { extractVisualDetails } from './visualDetails';
import type { RuleResult } from './pythonRules';

export type { RuleResult } from './pythonRules';

export type AnalyzeOptions = {
  explanationLevel?: 'Beginner' | 'Intermediate' | 'Advanced';
  hintLevel?: 'Gentle' | 'Guided' | 'Learning';
};

function explainLine(line: string, language: AnalyzableLanguage): LineExplanation['text'] {
  const trimmed = line.trim();
  if (trimmed === '') return 'A blank line — useful for grouping ideas and improving readability.';
  if (language === 'HTML') {
    if (/<(header|main|footer|nav|section|article)\b/i.test(line)) return 'A semantic landmark that tells browsers and assistive technology what this region is for.';
    if (/<img\b/i.test(line)) return 'An image element; its alternative text is what non-visual learners receive.';
    if (/<form\b|<input\b|<button\b|<label\b/i.test(line)) return 'Part of a form, where visitors enter or submit information.';
    if (/<script\b/i.test(line)) return 'A script that makes the page interactive.';
    if (/<style\b|<link\b/i.test(line)) return 'Styling that changes how this page looks.';
    if (/<\//.test(line)) return 'Closes an element, ending the region it opened.';
  }
  if (/^\s*#|\/\/|\/\*|--/.test(line)) return 'A comment. Comments explain intent; they do not affect how the program runs.';
  if (language === 'Python' && /^\s*def\s+\w+/.test(line)) return 'Defines a reusable function that can be called with inputs.';
  if (language !== 'Python' && /\bfunction\b|=>/.test(line)) return 'Defines a reusable function or arrow function.';
  if (/^\s*(for|while)\b/.test(line)) return 'Starts a loop that repeats work for each value or while a condition holds.';
  if (/^\s*(if|elif|else|switch|case)\b/.test(line)) return 'A decision point: different code runs depending on a condition.';
  if (/\breturn\b/.test(line)) return 'Returns a result back to whoever called this function.';
  if (/\b(print|console)\b/.test(line)) return 'Sends a value to the output so you can see what happened.';
  if (/\b(input|prompt)\b/.test(line)) return 'Reads a value supplied by the user or by the program input panel.';
  if (/\b(import|from|require)\b/.test(line) || /^\s*using\b/.test(line)) return 'Brings in another module or library the program depends on.';
  if (/\bselect\b/i.test(line)) return 'Selects the columns this query will return.';
  if (/\bfrom\b/i.test(line)) return 'Names the table the query reads from.';
  if (/\bwhere\b/i.test(line)) return 'Filters which rows take part in this query.';
  if (/\b(group\s+by|order\s+by)\b/i.test(line)) return 'Groups or sorts the resulting rows.';
  if (/(\+=|-=|\*=|\/=|=)/.test(line)) return 'Stores or updates a value in a variable.';
  return 'Performs a step in the program’s logic.';
}

const DIAGRAM_TITLES: Record<DiagramKind, string> = {
  array: 'Indexed list view',
  stack: 'Stack view',
  queue: 'Queue view',
  dictionary: 'Key and value view',
  function: 'Input → process → output',
  recursion: 'Call stack view',
  decision: 'Decision flow',
  loop: 'Iteration flow',
  sequence: 'Program flow',
};

/**
 * Each caption states the rule the diagram is meant to teach, so a learner reads
 * the same idea in words and in shape.
 */
const DIAGRAM_CAPTIONS: Record<DiagramKind, string> = {
  array: 'A collection keeps its items in order, and each position has an index starting at zero.',
  stack: 'A stack grows and shrinks from one end, so the most recent item is the first one removed.',
  queue: 'A queue adds at the back and removes from the front, so items are handled in arrival order.',
  dictionary: 'A dictionary stores values under unique keys, so you look values up by name instead of position.',
  function: 'Arguments go in, the body runs in its own scope, and one result comes back out.',
  recursion: 'Each call pauses until the call it made returns, so the stack unwinds from the deepest case.',
  decision: 'Only one branch runs for a given input, and both branches rejoin afterwards.',
  loop: 'The condition is tested before every pass, so the body repeats until it becomes false.',
  sequence: 'These statements run in order from top to bottom, with no branching detected.',
};

/**
 * Picks the single most explanatory diagram. The order below is a deliberate
 * specificity ladder: a recursive call stack teaches more than the loop inside
 * it, and a described structure teaches more than the plain sequence fallback.
 */
function chooseDiagram(
  result: RuleResult,
  language: AnalyzableLanguage,
  details: ReturnType<typeof extractVisualDetails>,
): { kind: DiagramKind; title: string; caption: string; details: ReturnType<typeof extractVisualDetails> } {
  const concepts = result.concepts;
  let kind: DiagramKind = 'sequence';

  if (language === 'SQL' || concepts.includes('Subqueries')) {
    kind = 'sequence';
  } else if (concepts.includes('Recursion')) {
    kind = 'recursion';
  } else if (concepts.includes('Queues')) {
    kind = 'queue';
  } else if (concepts.includes('Stacks')) {
    kind = 'stack';
  } else if (concepts.includes('Loops')) {
    kind = 'loop';
  } else if (concepts.includes('Conditions')) {
    kind = 'decision';
  } else if (concepts.includes('Functions')) {
    kind = 'function';
  } else if (concepts.includes('Dictionaries') || concepts.includes('Objects')) {
    kind = 'dictionary';
  } else if (concepts.includes('Lists') || concepts.includes('Arrays')) {
    kind = 'array';
  }

  return { kind, title: DIAGRAM_TITLES[kind], caption: DIAGRAM_CAPTIONS[kind], details };
}

function buildAnalysis(
  language: AnalyzableLanguage,
  source: string,
  result: RuleResult,
  execution: ExecutionResult | null,
): LocalAnalysis {
  const visualDetails = extractVisualDetails(source);
  const lines = source.split(/\r?\n/);
  const lineExplanations: LineExplanation[] = lines
    .map((line, index) => ({ line: index + 1, text: explainLine(line, language) }))
    .filter((entry) => lines[entry.line - 1].trim() !== '')
    .slice(0, 40);

  const hasErrors = result.errors.some((error) => error.severity === 'error');
  const summary = hasErrors
    ? 'Let’s understand this together. The local analyzer found something worth reviewing before the next run.'
    : execution?.status === 'success'
      ? 'Your program ran successfully. Review the concepts below to deepen what you already did well.'
      : result.errors.length
        ? 'Your code has a clear structure. There are a few gentle suggestions to explore.'
        : 'Your code has a clean structure. Keep experimenting and check the concepts below.';

  const purpose = result.concepts.includes('Functions')
    ? 'This program defines reusable logic and applies it to produce an output.'
    : language === 'SQL'
      ? 'This query reads data from a table, shapes it, and returns a result set.'
      : 'This program stores, transforms, and reports information step by step.';

  const debuggingSteps = [
    'Read the technical message calmly before changing anything.',
    'Inspect the highlighted area and the values it receives.',
    'Describe the expected behaviour for an edge case in your own words.',
    'Try one small change, then run the current editor code again.',
  ];

  const tips = [
    'Name values by the role they play so the intent stays clear.',
    'Change one thing at a time and re-run to confirm the effect.',
    'Use small, meaningful output while learning so you can see progress.',
  ];

  return {
    source: 'local',
    language,
    summary,
    purpose,
    concepts: result.concepts.slice(0, 8),
    lineExplanations,
    errors: result.errors.slice(0, 8),
    debuggingSteps,
    tips,
    diagram: chooseDiagram(result, language, visualDetails),
    quizReadiness: {
      ready: result.concepts.length > 0 || result.errors.length > 0,
      concepts: result.concepts.slice(0, 8),
    },
    warnings: result.warnings,
  };
}

/**
 * Runs the rule-based analyzer entirely in the browser. No network calls, no AI
 * and no code rewriting — it only describes what it observes.
 */
export function analyzeLocally(
  source: string,
  language: AnalysisLanguage,
  execution: ExecutionResult | null = null,
  _options: AnalyzeOptions = {},
): LocalAnalysis {
  const context = {
    source,
    lines: source.split(/\r?\n/),
    status: execution?.status,
    stderr: execution?.stderr,
    message: execution?.message,
    errorLine: execution?.errorLine,
    errorLineConfidence: execution?.errorLineConfidence,
  };

  let result: RuleResult;
  switch (language) {
    case 'Python':
      result = analyzePython(context);
      break;
    case 'JavaScript':
      result = analyzeJavascript(context);
      break;
    case 'TypeScript':
      result = analyzeTypescript(context);
      break;
    case 'HTML':
      result = analyzeHtml(context);
      break;
    case 'SQL':
      result = analyzeSql(context);
      break;
    default:
      // Compiled languages get honest structural guidance instead of a silent
      // no-op: shape, concepts, entry-point checks and provider run signals.
      return analyzeStructurally(source, language as StructuralLanguage, execution);
  }

  return buildAnalysis(language, source, result, execution);
}

/**
 * Every language has at least structural analysis. The deep rule engines stay
 * limited to the five languages they truly understand.
 */
export const analyzerSupports = (language: string): boolean =>
  ['Python', 'JavaScript', 'TypeScript', 'HTML', 'SQL'].includes(language) ||
  ['C', 'C++', 'Java', 'C#', 'Go', 'PHP', 'Ruby', 'Rust', 'Kotlin'].includes(language);
