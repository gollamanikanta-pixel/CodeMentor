import type { FlowNode } from '../types';

/**
 * Program-specific execution flow.
 *
 * The generic templates in `visualContract` explain a *concept* (a loop, a
 * stack, a branch) and therefore look the same for every program of that shape.
 * This module instead reads the learner's own statements, in order, and builds a
 * real control-flow graph from them — so a linear script, an `if/else` program
 * and a `for` loop each draw a visibly different diagram, with the learner's own
 * variables and calls as labels.
 *
 * Everything here is structural: no runtime values are invented, labels are
 * truncated and stripped of Mermaid-significant characters, and no corrected
 * code is ever produced.
 */

const IDENT = '[A-Za-z_][A-Za-z0-9_]*';

/** Statement keywords that must never be mistaken for a function name. */
const CONTROL = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'foreach', 'else', 'do', 'return',
  'case', 'break', 'continue', 'try', 'using', 'include', 'import', 'from',
  'package', 'def', 'fn', 'func', 'function', 'print', 'printf', 'puts', 'cout',
  'scanf', 'cin', 'echo', 'new', 'public', 'private', 'protected', 'static',
  'final', 'select', 'where', 'insert', 'update', 'delete',
]);

type Row = { indent: number; text: string };

/** Removes comments while preserving directives like `#include` and `#define`. */
function stripComment(line: string): string {
  let out = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
  const trimmed = out.trimStart();
  if (trimmed.startsWith('#')) {
    const directive = /^#\s*(include|define|if|ifdef|ifndef|ifndef|pragma|endif|else|elif|undef|error|line)\b/;
    if (!directive.test(trimmed)) return '';
  }
  return out;
}

/** Collapses source into indented rows, dropping brace-only lines. */
function toRows(source: string): Row[] {
  const rows: Row[] = [];
  for (const physical of source.split(/\r?\n/)) {
    const noComment = stripComment(physical);
    if (!noComment.trim()) continue;
    const indent = noComment.length - noComment.trimStart().length;
    let text = noComment.trim();
    // A `} ...` line closes the previous block; keep its content at the same
    // indentation so `} else {` matches its `if`.
    if (text.startsWith('}')) text = text.replace(/^[}]+/, '').trim();
    if (!text) continue;
    if (/^[{}]+$/.test(text)) continue;
    rows.push({ indent, text });
  }
  return rows;
}

/** A short, single-line label safe to render as plain text. */
function shortLabel(raw: string): string {
  const text = raw
    .replace(/\s*\{\s*$/, '')
    .replace(/:\s*$/, '')
    .replace(/;\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, 38);
}

type Else = { kind: 'if'; condition: string } | { kind: 'else' };

/**
 * Recognises an `else` / `else if` (and Python's `elif`), returning the branch
 * condition when there is one. This is what lets an `else if` chain draw a real
 * second decision instead of a single flat arm.
 */
function parseElse(text: string): Else | null {
  const value = text.replace(/\s*\{\s*$/, '').trim();
  if (!value) return null;
  if (/^elif\b/.test(value)) return { kind: 'if', condition: conditionOf(value) };
  if (/^else\s+if\b/.test(value)) return { kind: 'if', condition: conditionOf(value.replace(/^else\s+if/, 'if')) };
  if (/^else\b/.test(value)) return { kind: 'else' };
  return null;
}

/** Extracts the real condition from an `if`/`while`/`for` statement. */
function conditionOf(text: string): string {
  const paren = text.match(/^\s*(?:if|while|for|foreach|elif|else\s+if)\s*\(([^)]{1,60})\)/i);
  if (paren) return paren[1].trim();
  const python = text.match(/^\s*(?:if|while)\s*([^:]{1,60}):/i);
  if (python) return python[1].trim();
  // `for x in y:` / `for x in y {` / `for x = 0; ...`
  const forIn = text.match(/^\s*(?:for|foreach)\s+(.+?)\s*(?::|\{|$)/i);
  if (forIn) return forIn[1].trim();
  /*
   * Colon-less fallback. `classify` strips a trailing `:` before we get here, so
   * Python's `if score > 50:` arrives as `if score > 50`. Without this the
   * operator would be lost and the diagram would read `if score 50`.
   */
  const bare = text.match(/^\s*(?:if|while|for|foreach|elif)\s+(.+)$/i);
  if (bare) return bare[1].replace(/\s*:\s*$/, '').trim();
  return '';
}

function classify(raw: string): FlowNode | null {
  const hadBrace = /\{\s*$/.test(raw);
  const text = raw.replace(/\s*\{\s*$/, '').replace(/:\s*$/, '').replace(/;\s*$/, '').trim();
  if (!text) return null;
  // Imports and preprocessor directives are setup, not program logic.
  if (
    text.startsWith('#') ||
    /^(import|using|package|from|namespace|class|struct|interface|module)\b/.test(text) ||
    /^<\?(?:php)?\s*$/i.test(text) ||
    /^\?>$/.test(text)
  ) return null;
  const label = shortLabel(text);

  // Function definition: def/fn/func/function, or a typed C/Java signature.
  const named = text.match(/^(?:def|fn|fun|func|function)\s+([A-Za-z_]\w*)/);
  if (named) return { kind: 'func', label: named[1] };
  if (hadBrace) {
    const signature = text.match(/([A-Za-z_]\w*)\s*\([^)]*\)\s*$/);
    if (signature && !CONTROL.has(signature[1]) && text.includes(`${signature[1]}(`)) {
      return { kind: 'func', label: signature[1] };
    }
  }

  if (/^(for|while|do|foreach)\b/.test(text)) {
    const condition = conditionOf(text);
    return { kind: 'loop', label, ...(condition ? { condition } : {}) };
  }
  if (/^if\b/.test(text)) {
    const condition = conditionOf(text);
    return { kind: 'branch', label, ...(condition ? { condition } : {}) };
  }
  if (/^return\b/.test(text)) return { kind: 'return', label: label.replace(/^return\s*/, '') || 'value' };
  if (
    /\b(scanf|fgets|gets|cin\s*>>|input\s*\(|readLine\s*\(|read_line\s*\(|readln\s*\(|Scanner|Console\.Read|prompt\s*\(|readline\s*\(|fmt\.Scan(?:ln|f)?\b)/i.test(text) ||
    /\b[A-Za-z_$][\w$]*\s*\.\s*next(?:Int|Long|Line|Double|Float|Boolean|Byte|Short)?\s*\(/i.test(text)
  ) {
    return { kind: 'input', label };
  }
  if (/\b(printf|print|puts|cout\s*<<|Console\.Write|System\.out\.print|echo|println|write\s*\(|console\.log|fmt\.Print(?:ln|f)?\b)/i.test(text)) {
    return { kind: 'output', label };
  }
  return { kind: 'stmt', label };
}

function nextIndent(rows: Row[], index: number, base: number): number {
  return index < rows.length && rows[index].indent > base ? rows[index].indent : base + 1;
}

/**
 * Finds the decision an `else`/`elif` belongs to: the deepest branch arm that
 * already has a condition but no other arm yet. This is what makes an
 * `if / else if / else` ladder nest correctly instead of collapsing.
 */
function findOpenBranch(steps: FlowNode[]): FlowNode | null {
  const last = steps[steps.length - 1];
  if (!last || last.kind !== 'branch') return null;
  const inner = last.elseBody?.[0];
  if (inner && inner.kind === 'branch' && !inner.elseBody) return findOpenBranch([inner]) ?? inner;
  return last;
}

function parseBlock(rows: Row[], start: number, base: number): [FlowNode[], number] {
  const steps: FlowNode[] = [];
  let i = start;
  while (i < rows.length) {
    const row = rows[i];
    if (row.indent < base) break;
    if (row.indent > base) {
      const stray = classify(row.text);
      if (stray) steps.push(stray);
      i += 1;
      continue;
    }

    if (/^(?:class|namespace)\b/.test(row.text) && /\{\s*$/.test(row.text)) {
      const [body, next] = parseBlock(rows, i + 1, nextIndent(rows, i + 1, base));
      steps.push(...body);
      i = next;
      continue;
    }

    const elsePart = parseElse(row.text);
    if (elsePart) {
      const [body, next] = parseBlock(rows, i + 1, nextIndent(rows, i + 1, base));
      const previous = steps[steps.length - 1];
      // `else if` / `elif` becomes a nested decision, so a chain of conditions
      // reads as a real ladder instead of one flat "no" arm.
      const arm: FlowNode[] =
        elsePart.kind === 'if'
          ? [{ kind: 'branch', label: elsePart.condition, condition: elsePart.condition, body }]
          : body;
      /*
       * `else if` must chain onto the *deepest* open decision. A plain `else`
       * after an `elif` belongs to that inner branch, not to the outer `if` —
       * without this the ladder's final arm overwrites the `elif` arm.
       */
      const openBranch = findOpenBranch(steps);
      if (openBranch && (elsePart.kind === 'else' || !openBranch.elseBody)) openBranch.elseBody = arm;
      else if (previous && previous.kind === 'branch') previous.elseBody = arm;
      else steps.push({ kind: 'branch', label: 'otherwise', elseBody: arm });
      i = next;
      continue;
    }

    const node = classify(row.text);
    if (!node) {
      i += 1;
      continue;
    }

    if (node.kind === 'loop' || node.kind === 'branch' || node.kind === 'func') {
      const [body, next] = parseBlock(rows, i + 1, nextIndent(rows, i + 1, base));
      node.body = body;
      // `main` (or a script's only function) is the entry point, so inline its
      // body into the flow rather than drawing a detached definition.
      if (node.kind === 'func' && /^main$/i.test(node.label)) steps.push(...body);
      else steps.push(node);
      i = next;
      continue;
    }

    steps.push(node);
    i += 1;
  }
  return [steps, i];
}

/** Parses the learner's source into an ordered control-flow list. */
export function parseProgramFlow(source: string): FlowNode[] {
  if (!source || !source.trim()) return [];
  if (/^\s*(?:<!doctype\s+html|<html\b|<body\b)/i.test(source)) {
    const scripts = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)]
      .map((match) => normalizeInlineScript(match[1].trim()))
      .filter(Boolean);
    if (scripts.length) return parseRows(scripts.join('\n'));

    const body = source.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i)?.[1] ?? source;
    const visibleText = body
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim();
    return visibleText ? [{ kind: 'output', label: `render: ${visibleText.slice(0, 38)}` }] : [];
  }
  if (/^\s*(?:SELECT|WITH)\b/i.test(source)) {
    const clauses = source
      .replace(/--.*$/gm, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(/\b(?=(?:SELECT|FROM|JOIN|WHERE|GROUP\s+BY|HAVING|ORDER\s+BY|LIMIT|OFFSET|UNION)\b)/i)
      .map((clause) => clause.trim().replace(/;$/, ''))
      .filter(Boolean);
    return clauses.slice(0, 40).map((label) => ({ kind: 'stmt', label: shortLabel(label) }));
  }
  return parseRows(source);
}

function normalizeInlineScript(source: string): string {
  const isInline = !/\r?\n/.test(source);
  let result = '';
  let quote = '';
  let escaped = false;
  let parentheses = 0;

  for (const character of source) {
    result += character;
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'" || character === '`') quote = character;
    else if (character === '(') parentheses += 1;
    else if (character === ')') parentheses = Math.max(0, parentheses - 1);
    else if (character === ';' && parentheses === 0) result += '\n';
  }

  result = result
    .replace(/\{\s*(?=(?:if|for|while|return|const|let|var|console\.|document\.|[A-Za-z_$][\w$]*\s*\())/g, '{\n  ')
    .replace(/\}\s*(?=else\b)/g, '}\n');
  return isInline ? result.replace(/\n[ \t]*(?=(?:if|for|while|else)\b)/g, '\n') : result;
}

function parseRows(source: string): FlowNode[] {
  const [steps] = parseBlock(toRows(source), 0, 0);
  return steps.slice(0, 40);
}

/** Plain-text labels of the top-level steps, for summary UI. */
export function flowLabels(flow: FlowNode[]): string[] {
  return flow.map((node) => `${prefix(node.kind)}${node.label}`).filter((label) => label.trim() !== '');
}

const MAX_SUMMARY_STEPS = 5;

/**
 * A calm, plain-language walkthrough of the learner's own control flow, so the
 * diagram is understandable even before the shapes make sense. Every clause is
 * derived from the parsed structure — nothing is invented.
 */
export function describeFlow(flow: FlowNode[]): string {
  if (!flow.length) return '';
  const parts: string[] = [];
  let loops = 0;
  let branches = 0;

  const walk = (steps: FlowNode[], depth: number) => {
    if (depth > 2) return;
    for (const node of steps) {
      if (node.kind === 'loop') {
        loops += 1;
        walk(node.body ?? [], depth + 1);
      } else if (node.kind === 'branch') {
        branches += 1;
        walk(node.body ?? [], depth + 1);
        walk(node.elseBody ?? [], depth + 1);
      } else if (node.kind === 'func') {
        walk(node.body ?? [], depth + 1);
      }
    }
  };
  walk(flow, 0);

  const reads = flow.some((node) => node.kind === 'input');
  const writes = flow.some((node) => node.kind === 'output');

  parts.push(reads ? 'It reads the input you provide' : 'It starts by setting up its values');
  if (loops && branches) {
    parts.push(`then repeats work in ${loops === 1 ? 'a loop' : `${loops} loops`} and chooses between paths in ${branches === 1 ? 'one decision' : `${branches} decisions`}`);
  } else if (loops) {
    parts.push(`then repeats work in ${loops === 1 ? 'a loop' : `${loops} loops`} until the condition stops being true`);
  } else if (branches) {
    parts.push(`then chooses between paths in ${branches === 1 ? 'one decision' : `${branches} decisions`}`);
  } else {
    parts.push('then runs its steps in order, one after another');
  }
  if (writes) parts.push('and finally reports the result');

  const steps = flow
    .slice(0, MAX_SUMMARY_STEPS)
    .map((node) => (node.condition ? conditionText(node.condition) : mermaidText(node.label)));
  const overview = `${parts.join(' ')}.`;
  return steps.length ? `${overview} Steps: ${steps.join(' → ')}.` : overview;
}

function prefix(kind: FlowNode['kind']): string {
  if (kind === 'input') return 'read: ';
  if (kind === 'output') return 'show: ';
  if (kind === 'return') return 'return ';
  if (kind === 'func') return 'def ';
  return '';
}

/**
 * Turns a raw statement into short, plain diagram text.
 *
 * Two things matter here. Mermaid-significant characters are stripped so no
 * source can break the diagram, and the code-shaped parts are made readable:
 * string literals are surfaced (`printf("Sum is greater than 50\n")` becomes
 * `show: Sum is greater than 28…` style plain text), escape sequences and
 * argument lists are dropped, so a learner reads what the program says instead
 * of punctuation soup.
 */
export function mermaidText(value: string): string {
  let text = value ?? '';
  // Prefer the first string literal — it is the human-readable part of a call.
  const literal = text.match(/"((?:[^"\\]|\\.)*)"/);
  if (literal) {
    const cleaned = literal[1]
      .replace(/\\[nrt]/g, ' ')
      .replace(/\\"/g, '"')
      .replace(/\\[a-z]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned) text = cleaned;
  }
  const cleaned = text
    .replace(/["`']/g, '')
    .replace(/[{}[\]()<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || 'step').slice(0, 44);
}

/**
 * Labels an input step. Unlike output, the useful information is *what* is
 * being read, not the format string — `read: scanf %d` teaches nothing, while
 * `read: n` names the variable the learner will use.
 */
function inputText(statement: string): string {
  const text = statement.trim();
  // C/C++ address-of: `scanf("%d", &n)` names the variable being filled.
  const addressOf = text.match(/&\s*(?:mut\s+)?([A-Za-z_]\w*)/);
  if (addressOf) return 'read: ' + addressOf[1];
  // Stream extraction: `cin >> name`.
  const extracted = text.match(/>>\s*([A-Za-z_]\w*)/);
  if (extracted) return 'read: ' + extracted[1];
  // Assignment target: `age = int(input(...))`.
  const assigned = text.match(
    /^(?:(?:const|let|var|val|final|int|long|double|float|boolean|string|String|char|auto|mut)\s+)*\$?([A-Za-z_]\w*)\s*(?::\s*[^=]+)?\s*=/,
  );
  if (assigned) return 'read: ' + assigned[1];
  return 'read: ' + mermaidText(text);
}

/** Keeps output steps readable without showing printf conversion markers. */
function outputText(statement: string): string {
  const message = mermaidText(statement)
    .replace(/%(?:[-+#0 ]*)(?:\d+|\*)?(?:\.(?:\d+|\*))?(?:hh|h|ll|l|L|z|j|t)?[diuoxXfFeEgGaAcspn%]/g, '')
    .trim();
  return `show: ${message || 'output'}`.slice(0, 44);
}

/**
 * Makes a condition readable in plain text. Comparisons are preserved because
 * `sum > 50` teaches far more than `if sum 50`.
 */
function conditionText(condition: string): string {
  const map: Record<string, string> = {
    '===': 'is exactly',
    '!==': 'is not exactly',
    '>=': 'is at least',
    '<=': 'is at most',
    '==': 'equals',
    '!=': 'is not',
    '&&': 'and',
    '||': 'or',
    '>': 'is greater than',
    '<': 'is less than',
  };
  let text = condition.replace(/\b(True|False|true|false|null|None|nil)\b/g, (match) => match.toLowerCase());
  // Longest operators first so `>=` is never read as `>`.
  for (const op of ['===', '!==', '>=', '<=', '==', '!=', '&&', '||', '>', '<']) {
    text = text.split(op).join(` ${map[op]} `);
  }
  text = text
    .replace(/\b(in)\b/g, 'in')
    .replace(/\s+/g, ' ')
    .trim();
  // Keep it as a question the learner can answer: "is sum greater than 50?".
  return text.replace(/^is /, 'is ').replace(/\.$/, '').slice(0, 60);
}

type EndPoint = { id: string; label?: string };
type Ends = { first: string; exits: EndPoint[] };

const edge = (from: EndPoint, to: string): string =>
  `  ${from.id} -->${from.label ? `|${from.label}|` : ''} ${to}`;

/**
 * Renders the parsed flow as a Mermaid flowchart. Loops become a diamond with a
 * back-edge, branches a diamond with two arms, and every leaf keeps the
 * learner's own statement text — so different programs draw different shapes.
 */
export function buildProgramMermaid(flow: FlowNode[], loopSubject = 'items'): string | null {
  if (!flow.length) return null;
  const defs: string[] = [];
  const edges: string[] = [];
  let counter = 0;
  const nextId = () => `N${(counter += 1)}`;

  /**
   * Every node also joins a semantic class (`io`, `calc`, `decide`, …) so the
   * diagram can colour each kind of step consistently and read at a glance.
   */
  const emitNode = (id: string, shape: 'rect' | 'diamond' | 'terminal', label: string, className?: string) => {
    const suffix = className ? `:::${className}` : '';
    if (shape === 'diamond') defs.push(`  ${id}{"${label}"}${suffix}`);
    else if (shape === 'terminal') defs.push(`  ${id}(["${label}"])${suffix}`);
    else defs.push(`  ${id}["${label}"]${suffix}`);
  };

  /** The class that best describes a step, used only for colour. */
  const classFor = (kind: FlowNode['kind']): string => {
    if (kind === 'input') return 'io';
    if (kind === 'output') return 'io';
    if (kind === 'loop' || kind === 'branch') return 'decide';
    if (kind === 'return') return 'ret';
    if (kind === 'func') return 'func';
    return 'calc';
  };

  const emitChain = (steps: FlowNode[]): Ends | null => {
    let first: string | null = null;
    let previous: Ends | null = null;
    for (const step of steps) {
      const current = emit(step);
      if (!first) first = current.first;
      if (previous) for (const exit of previous.exits) edges.push(edge(exit, current.first));
      previous = current;
    }
    if (!first || !previous) return null;
    return { first, exits: previous.exits };
  };

  const emit = (node: FlowNode): Ends => {
    if (node.kind === 'loop') {
      const id = nextId();
      // Show the learner's real condition when we could read one.
      const subject = node.condition
        ? `keep going while ${conditionText(node.condition)}?`
        : `more ${mermaidText(node.label || loopSubject)}?`;
      emitNode(id, 'diamond', mermaidText(subject), 'decide');
      const body = emitChain(node.body ?? []);
      if (body) {
        edges.push(`  ${id} -->|yes| ${body.first}`);
        for (const exit of body.exits) edges.push(edge(exit, id));
      } else {
        edges.push(`  ${id} -->|yes| ${id}`);
      }
      return { first: id, exits: [{ id, label: 'no' }] };
    }

    if (node.kind === 'branch') {
      const id = nextId();
      const question = node.condition ? conditionText(node.condition) : mermaidText(node.label);
      emitNode(id, 'diamond', mermaidText(question), 'decide');
      const thenChain = emitChain(node.body ?? []);
      const elseChain = emitChain(node.elseBody ?? []);
      if (thenChain) edges.push(`  ${id} -->|yes| ${thenChain.first}`);
      if (elseChain) edges.push(`  ${id} -->|no| ${elseChain.first}`);
      const exits: EndPoint[] = [];
      if (thenChain) exits.push(...thenChain.exits);
      if (elseChain) exits.push(...elseChain.exits);
      if (!thenChain && !elseChain) return { first: id, exits: [{ id }] };
      if (!thenChain) exits.push({ id, label: 'yes' });
      if (!elseChain) exits.push({ id, label: 'no' });
      return { first: id, exits };
    }

    if (node.kind === 'func') {
      const id = nextId();
      emitNode(id, 'rect', `function ${mermaidText(node.label)}`, 'func');
      const body = emitChain(node.body ?? []);
      if (!body) return { first: id, exits: [{ id }] };
      edges.push(edge({ id }, body.first));
      return { first: id, exits: body.exits };
    }

    const id = nextId();
    // Input steps name the variable being read rather than the format string.
    const text =
      node.kind === 'input'
        ? inputText(node.label)
        : node.kind === 'output'
          ? outputText(node.label)
          : mermaidText(`${prefix(node.kind)}${node.label}`);
    emitNode(id, 'rect', text, classFor(node.kind));
    return { first: id, exits: [{ id }] };
  };

  const chain = emitChain(flow);
  if (!chain) return null;

  defs.unshift('  START(["Start"]):::terminal');
  defs.push('  END(["End"]):::terminal');
  edges.unshift(`  START --> ${chain.first}`);
  for (const exit of chain.exits) edges.push(edge(exit, 'END'));

  /*
   * A semantic palette: input/output reads as cyan, computation as indigo,
   * decisions as amber, returns as green. The colours are what make a long flow
   * scannable — the learner can see where the program reads, decides and
   * reports without reading every label.
   */
  const styles = [
    '  classDef terminal fill:#0f172a,stroke:#55d8e6,stroke-width:1.5px,color:#e4ebf8;',
    '  classDef io fill:#0e2a33,stroke:#55d8e6,stroke-width:1.5px,color:#d8f6fa;',
    '  classDef calc fill:#1b2440,stroke:#7c8cff,stroke-width:1.5px,color:#e4ebf8;',
    '  classDef decide fill:#33260f,stroke:#f3be6d,stroke-width:1.5px,color:#ffe6bd;',
    '  classDef ret fill:#0f2a1c,stroke:#7fd7b0,stroke-width:1.5px,color:#d6f5e6;',
    '  classDef func fill:#241a3a,stroke:#c6b2ff,stroke-width:1.5px,color:#ece4ff;',
  ];

  return ['flowchart TD', ...defs, ...edges, ...styles].join('\n');
}
