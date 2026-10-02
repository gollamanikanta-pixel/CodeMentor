import type { DiagramKind, LocalAnalysis, LocalDiagram } from '../types';
import { buildProgramMermaid } from '../analyzers/programFlow';

/**
 * When source structure was parsed, prefer it for every kind. Concept diagrams
 * are only a fallback for structures that do not expose sequential steps.
 */
export type VisualKind = DiagramKind;

export type LocalVisual = {
  title: string;
  caption: string;
  accessibilityDescription: string;
  kind: VisualKind;
  generatedLocally: true;
};

export function safeVisual(kind: VisualKind): LocalVisual {
  return {
    title: 'Generated learning visual',
    caption: 'Generated locally from detected code structure.',
    accessibilityDescription: `A ${kind} learning visual generated from the detected program structure.`,
    kind,
    generatedLocally: true,
  };
}

export function toLocalVisual(diagram: LocalDiagram): LocalVisual {
  return {
    title: diagram.title,
    caption: diagram.caption,
    accessibilityDescription: `${diagram.title}. ${diagram.caption} This visual describes structure only and does not invent runtime values.`,
    kind: diagram.kind,
    generatedLocally: true,
  };
}

/**
 * Builds a Mermaid flowchart source from the local analysis. Only a small,
 * fixed vocabulary of node labels is used — optionally personalised with the
 * safe identifiers the analyzer extracted from the source — so nothing unsafe
 * from user code is ever injected as raw Mermaid/HTML.
 */
export function buildMermaidSource(analysis: LocalAnalysis | null): string | null {
  if (!analysis) return null;
  const conceptual = analysis.purpose || 'Program flow';
  const details = analysis.diagram.details;
  const loopLabel = sanitize(details?.loopLabel ?? 'items');
  const arrayLabel = sanitize(details?.arrayLabel ?? 'items');
  const functionLabel = sanitize(details?.functionLabel ?? 'function');
  const conditionLabel = sanitize(details?.conditionLabel ?? 'condition true?');
  const recursionLabel = details?.recursionLabel ? sanitize(details.recursionLabel) : null;

  const programFlow = buildProgramMermaid(details?.flow ?? [], details?.loopLabel ?? 'items');
  if (programFlow) return programFlow;

  switch (analysis.diagram.kind) {
    case 'loop':
      return [
        'flowchart TD',
        '  A(["Start"]) --> B["Prepare counter"]',
        `  B --> C{"More ${loopLabel}?"}`,
        '  C -->|Yes| D["Run the loop body"]',
        `  D --> E["Update ${loopLabel}"]`,
        '  E --> C',
        '  C -->|No| F["Continue"]',
        '  F --> G(["Report result"])',
      ].join('\n');
    case 'decision':
      return [
        'flowchart TD',
        `  A(["Start"]) --> B{"${conditionLabel}?"}`,
        '  B -->|Yes| C["First branch"]',
        '  B -->|No| D["Other branch"]',
        '  C --> E["Continue"]',
        '  D --> E',
        '  E --> F(["Report result"])',
      ].join('\n');
    case 'function':
      return [
        'flowchart LR',
        `  A["Input · ${functionLabel} parameters"] --> B["${functionLabel} body"]`,
        `  B --> C["${functionLabel} return value"]`,
        '  C --> D(["Output"])',
      ].join('\n');
    case 'recursion':
      return [
        'flowchart TD',
        `  A(["Call ${recursionLabel ?? functionLabel}()"]) --> B{"Base case reached?"}`,
        '  B -->|No| C["Do part of the work"]',
        `  C --> D["Call ${recursionLabel ?? functionLabel} again (smaller input)"]`,
        '  D --> B',
        '  B -->|Yes| E["Return the base result"]',
        '  E --> F(["Unwind the stack"])',
      ].join('\n');
    case 'array':
    case 'dictionary':
      return [
        'flowchart LR',
        `  A(["${arrayLabel} ready"]) --> B["Read a ${arrayLabel} value"]`,
        '  B --> C["Use the value"]',
        '  C --> D["Next step"]',
      ].join('\n');
    default:
      return [
        'flowchart LR',
        `  A(["${sanitize(conceptual).slice(0, 40)}"]) --> B["Process"]`,
        '  B --> C["Produce result"]',
      ].join('\n');
  }
}

/** Keep Mermaid labels to a safe, quotes-free vocabulary. */
function sanitize(value: string): string {
  return value.replace(/["{}[\]()<>|`]/g, '').trim() || 'step';
}
