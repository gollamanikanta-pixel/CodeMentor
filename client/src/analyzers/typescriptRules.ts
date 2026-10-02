import type { LearningError } from '../types';
import { findLine, makeError, type AnalyzerContext } from './ruleHelpers';
import { analyzeJavascript } from './javascriptRules';
import type { RuleResult } from './pythonRules';

const TS_CONCEPTS: Array<{ concept: string; test: (source: string) => boolean }> = [
  { concept: 'Types', test: (s) => /\b(type|interface)\b/.test(s) },
  { concept: 'Type annotations', test: (s) => /:\s*(string|number|boolean|any|unknown)\b/.test(s) },
  { concept: 'Generics', test: (s) => /<[A-Z]\w*>/.test(s) },
  { concept: 'Enums', test: (s) => /\benum\b/.test(s) },
];

/**
 * TypeScript is a superset of JavaScript, so we reuse the JavaScript rules for
 * structural checks and layer TypeScript-specific structural hints on top.
 * Execution stays disabled: this analysis is static and local only.
 */
export function analyzeTypescript(context: AnalyzerContext): RuleResult {
  const base = analyzeJavascript(context);
  const { source, lines } = context;
  const concepts = [...base.concepts];
  for (const { concept, test } of TS_CONCEPTS) {
    if (test(source) && !concepts.includes(concept)) concepts.push(concept);
  }
  const errors: LearningError[] = [...base.errors];

  const anyUsage = findLine(lines, /:\s*any\b/);
  if (anyUsage) {
    errors.push(
      makeError({
        type: 'AnyType',
        title: 'The any type reduces the help you get',
        category: 'Types',
        severity: 'hint',
        line: anyUsage,
        lineConfidence: 'exact',
        technicalMessage: 'Explicit any annotation detected.',
        whatHappened: 'A value is typed as any, so the compiler cannot check how it is used.',
        whyItHappened: 'Any silences type checking, which can hide mistakes.',
        gentleHint: 'Think about what shape this value really has.',
        guidedHint: 'Consider a more specific type or a defined type alias.',
        learningHint: 'Specific types let the compiler catch mistakes for you.',
        conceptReminder: 'Types describe the shape of your data.',
        selfCheckQuestion: 'What operations does this value actually support?',
        confidence: 'medium',
      }),
    );
  }

  const nonNull = findLine(lines, /[A-Za-z_$][\w$]*!\s*[.[]/);
  if (nonNull) {
    errors.push(
      makeError({
        type: 'NonNullAssertion',
        title: 'A value is asserted as non-null',
        category: 'Types',
        severity: 'hint',
        line: nonNull,
        lineConfidence: 'estimated',
        technicalMessage: 'Non-null assertion (!) detected.',
        whatHappened: 'The code tells TypeScript to trust that a value is present.',
        whyItHappened: 'Assertions skip the check that would otherwise catch a missing value.',
        gentleHint: 'Ask whether this value is truly always present at runtime.',
        guidedHint: 'Consider handling the missing case explicitly.',
        learningHint: 'Assertions move safety from the compiler to you.',
        conceptReminder: 'Optional values should be handled, not asserted away.',
        selfCheckQuestion: 'Can this value ever be absent at runtime?',
        confidence: 'low',
      }),
    );
  }

  const warnings = [...base.warnings];
  warnings.push('TypeScript runs in local analysis only; execution is planned.');

  return { errors, concepts, warnings };
}
