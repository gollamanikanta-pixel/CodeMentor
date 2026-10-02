import type { LearningError } from '../types';
import { findLine, makeError, type AnalyzerContext } from './ruleHelpers';
import type { RuleResult } from './pythonRules';

const CONCEPT_TESTS: Array<{ concept: string; test: (source: string) => boolean }> = [
  { concept: 'SELECT', test: (s) => /\bselect\b/i.test(s) },
  { concept: 'Filtering', test: (s) => /\bwhere\b/i.test(s) },
  { concept: 'Ordering', test: (s) => /\border\s+by\b/i.test(s) },
  { concept: 'Grouping', test: (s) => /\bgroup\s+by\b/i.test(s) },
  { concept: 'Aggregation', test: (s) => /\b(count|sum|avg|min|max)\s*\(/i.test(s) },
  { concept: 'Joins', test: (s) => /\b(join|inner|left|right|full)\b/i.test(s) },
  { concept: 'Subqueries', test: (s) => /\(\s*select\b/i.test(s) },
];

export function detectSqlConcepts(source: string): string[] {
  const concepts: string[] = [];
  for (const { concept, test } of CONCEPT_TESTS) if (test(source)) concepts.push(concept);
  return concepts;
}

export function analyzeSql(context: AnalyzerContext): RuleResult {
  const { source, lines } = context;
  const errors: LearningError[] = [];
  const warnings: string[] = [];
  const concepts = detectSqlConcepts(source);
  const hasSelect = /\bselect\b/i.test(source);
  const hasFrom = /\bfrom\b/i.test(source);

  if (hasSelect && !hasFrom) {
    const line = findLine(lines, /\bselect\b/i);
    errors.push(
      makeError({
        type: 'MissingFrom',
        title: 'This query selects without a table',
        category: 'Structure',
        line,
        lineConfidence: line ? 'exact' : 'unknown',
        technicalMessage: 'SELECT found without FROM.',
        whatHappened: 'SELECT chooses columns, but it needs a source table to read them from.',
        whyItHappened: 'The FROM clause may be missing or incomplete.',
        gentleHint: 'Ask yourself where these columns come from.',
        guidedHint: 'Each selected column belongs to a table named after it.',
        learningHint: 'SELECT and FROM usually travel together.',
        conceptReminder: 'Queries read data from tables.',
        selfCheckQuestion: 'Which table holds these columns?',
        confidence: 'high',
      }),
    );
  }

  const hasAggregate = /\b(count|sum|avg|min|max)\s*\(/i.test(source);
  const hasGroupBy = /\bgroup\s+by\b/i.test(source);
  const selectsNonAggregate = /\bselect\b[^;]*\b[a-z_][\w]*\b[^;]*\bfrom\b/i.test(source);
  if (hasAggregate && !hasGroupBy && selectsNonAggregate) {
    const line = findLine(lines, /\bselect\b/i);
    errors.push(
      makeError({
        type: 'AggregateWithColumns',
        title: 'Aggregates and plain columns are mixed without grouping',
        category: 'Aggregation',
        line,
        lineConfidence: line ? 'estimated' : 'unknown',
        technicalMessage: 'Aggregate function used alongside a column without GROUP BY.',
        whatHappened: 'An aggregate collapses many rows into one, which conflicts with listing individual columns.',
        whyItHappened: 'The query may need to group rows by the non-aggregated column.',
        gentleHint: 'Think about how the rows should be summarised.',
        guidedHint: 'Columns that are not aggregated usually belong in a grouping clause.',
        learningHint: 'GROUP BY decides which rows each aggregate summarises.',
        conceptReminder: 'Aggregates need a scope to work over.',
        selfCheckQuestion: 'Should these rows be grouped before aggregating?',
        confidence: 'medium',
      }),
    );
  }

  const joinWithoutOn = /\bjoin\b[^;]*?\b(on|using)\b/i.test(source) === false && /\bjoin\b/i.test(source);
  if (joinWithoutOn) {
    const line = findLine(lines, /\bjoin\b/i);
    errors.push(
      makeError({
        type: 'JoinWithoutCondition',
        title: 'A join has no matching condition',
        category: 'Joins',
        line,
        lineConfidence: line ? 'estimated' : 'unknown',
        technicalMessage: 'JOIN without ON or USING detected.',
        whatHappened: 'Without a matching condition, a join pairs rows in ways that are rarely intended.',
        whyItHappened: 'The ON clause may be missing.',
        gentleHint: 'Ask which column connects the two tables.',
        guidedHint: 'Think about the shared key between both tables.',
        learningHint: 'Joins match rows using a shared key.',
        conceptReminder: 'A join needs a relationship.',
        selfCheckQuestion: 'Which columns should match between these tables?',
        confidence: 'medium',
      }),
    );
  }

  if (/\b(delete|update)\b/i.test(source) && !/\bwhere\b/i.test(source)) {
    const line = findLine(lines, /\b(delete|update)\b/i);
    errors.push(
      makeError({
        type: 'UnfilteredWrite',
        title: 'A write statement has no filter',
        category: 'Safety',
        severity: 'error',
        line,
        lineConfidence: line ? 'exact' : 'unknown',
        technicalMessage: 'DELETE or UPDATE without WHERE.',
        whatHappened: 'Without a filter this statement would affect every row in the table.',
        whyItHappened: 'The WHERE clause may be missing.',
        gentleHint: 'Think about which rows you actually mean to change.',
        guidedHint: 'Describe the condition that identifies those rows.',
        learningHint: 'Filters protect data from unintended wide changes.',
        conceptReminder: 'Filters limit which rows a statement touches.',
        selfCheckQuestion: 'Which rows do you intend to affect?',
        confidence: 'high',
      }),
    );
  }

  if (/\bselect\s+\*/i.test(source)) {
    const line = findLine(lines, /\bselect\s+\*/i);
    warnings.push('SELECT * is convenient while exploring but lists exact columns better in practice.');
    void line;
  }

  if (!source.trim()) warnings.push('The editor is empty — write or upload a query to begin learning.');
  warnings.push('SQL runs in local analysis only; a safe practice database is planned.');

  return { errors, concepts, warnings };
}
