/**
 * Diagram detail extraction.
 *
 * The generic "loop" or "function" diagram is far more useful when it speaks
 * the learner's language — "more scores?" instead of "more items?". This module
 * reads safe identifiers out of the analyzed source (no runtime values, no
 * invented data) so the visual layer can personalise labels.
 *
 * Every extractor is defensive: identifiers are truncated and restricted to
 * word characters by the caller, and every field has a calm fallback, so a
 * surprising match can never inject anything unsafe into SVG text or Mermaid.
 */
import type { FlowNode } from '../types';
import { parseProgramFlow } from './programFlow';

export type VisualDetails = {
  /** Parsed control flow of the learner's own source (structure only). */
  flow: FlowNode[];
  /** Variable a loop iterates over, e.g. `scores` → "more scores?". */
  loopLabel: string;
  /** Variable that looks like a collection, e.g. `marks` for an array view. */
  arrayLabel: string;
  /** First user-defined function/method name, e.g. `average`. */
  functionLabel: string;
  /** Short text of the first `if` condition, e.g. `total > 0`. */
  conditionLabel: string;
  /** A function that calls itself, when one is detected. */
  recursionLabel: string | null;
};

const IDENT = () => '[A-Za-z_][A-Za-z0-9_]{0,30}';
/** Keeps only word characters/spaces and truncates — labels are plain text. */
const safe = (value: string | undefined, fallback: string): string => {
  const cleaned = (value ?? '').replace(/[^\w ,.<>:+*/-]/g, '').trim();
  return (cleaned || fallback).slice(0, 24);
};

const KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'print', 'println', 'echo',
  'puts', 'scanf', 'printf', 'function', 'def', 'fn', 'func', 'val', 'var',
  'let', 'const', 'new', 'public', 'static', 'void', 'int', 'double', 'float',
  'class', 'struct', 'import', 'using', 'package', 'include', 'System', 'Console',
]);

function firstMatch(source: string, patterns: RegExp[]): RegExpExecArray | null {
  for (const pattern of patterns) {
    const match = pattern.exec(source);
    if (match) return match;
  }
  return null;
}

export function extractVisualDetails(source: string): VisualDetails {
  // for x in … | for (let x … | for (x = … | foreach (var x …
  const loop = firstMatch(source, [
    new RegExp(`\\bfor\\s+(${IDENT()})\\s+\\bin\\b`),
    new RegExp(`\\bforeach\\s*\\(\\s*[\\w<>,\\s]+\\s+(${IDENT()})\\s*\\b`),
    new RegExp(`\\bfor\\s*\\(\\s*(?:let|const|var|int|auto)\\s+(${IDENT()})`),
    new RegExp(`\\bfor\\s*\\(\\s*(${IDENT()})\\s*=`),
  ]);
  const loopLabel = safe(loop?.[1], 'items');

  const array = firstMatch(source, [
    new RegExp(`\\b(?:const|let|var|val)\\s+(${IDENT()})\\s*=\\s*\\[`),
    new RegExp(`\\b(${IDENT()})\\s*=\\s*\\[`),
    new RegExp(`\\b(?:int|double|float|char)\\s+(${IDENT()})\\s*\\[`),
    new RegExp(`\\b(?:String|int\\[\\]|double\\[\\])\\s*\\[\\]\\s*(${IDENT()})`),
    new RegExp(`\\bstd::vector\\s*<[^>]+>\\s+(${IDENT()})`),
    new RegExp(`\\b(${IDENT()})\\s*\\[\\s*\\d+\\s*\\]\\s*=`),
  ]);
  const arrayLabel = safe(array?.[1], 'items');

  const fn = firstMatch(source, [
    new RegExp(`\\bdef\\s+(${IDENT()})`),
    new RegExp(`\\bfn\\s+(${IDENT()})`),
    new RegExp(`\\bfunc\\s+(${IDENT()})`),
    new RegExp(`\\bfunction\\s+(${IDENT()})`),
    new RegExp(`\\b(?:const|let|var)\\s+(${IDENT()})\\s*=\\s*(?:async\\s*)?\\(`),
    new RegExp(`\\b(?:public|private|protected)?\\s*static\\s+[\\w<>\\[\\]]+\\s+(${IDENT()})\\s*\\(`),
    new RegExp(`\\b(?:int|void|double|float|char|bool|string)\\s+(${IDENT()})\\s*\\([^)]*\\)\\s*\\{`),
  ]);
  const functionLabelRaw = fn?.[1] ?? '';
  const functionLabel = functionLabelRaw && !KEYWORDS.has(functionLabelRaw) ? safe(functionLabelRaw, 'function') : 'function';

  const cond = firstMatch(source, [
    /\bif\s*\(\s*([^()]{1,40}?)\s*\)/,
    /\bif\s+([^:\n{]{1,40}?)\s*:/,
    /\bwhile\s*\(\s*([^()]{1,40}?)\s*\)/,
  ]);
  const conditionLabel = safe(cond?.[1], 'condition true?');

  // A function that calls itself by name inside the same source.
  let recursionLabel: string | null = null;
  if (functionLabel !== 'function') {
    const calls = source.match(new RegExp(`\\b${functionLabel}\\s*\\(`, 'g')) ?? [];
    if (calls.length >= 2) recursionLabel = functionLabel;
  }

  return { flow: parseProgramFlow(source), loopLabel, arrayLabel, functionLabel, conditionLabel, recursionLabel };
}
