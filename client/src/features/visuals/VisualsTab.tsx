import { useState } from 'react';
import { GitBranch, Maximize2, Minimize2, ShieldCheck, Sparkles } from 'lucide-react';
import type { LocalAnalysis } from '../../types';
import { IconButton, Pill } from '../../components/ui';
import { MermaidDiagram } from '../../diagrams/MermaidDiagram';
import {
  ArrayVisual,
  DecisionVisual,
  DictionaryVisual,
  FunctionFlowVisual,
  LoopVisual,
  QueueVisual,
  RecursionStackVisual,
  SequenceVisual,
  StackVisual,
} from '../../diagrams/svgVisuals';
import { buildMermaidSource } from '../../diagrams/visualContract';
import { describeFlow, flowLabels } from '../../analyzers/programFlow';

/** The diagram that best explains each structure the analyzer can detect. */
function SvgForKind({ analysis }: { analysis: LocalAnalysis }) {
  const details = analysis.diagram.details;
  switch (analysis.diagram.kind) {
    case 'array':
      return <ArrayVisual values={Array.from({ length: 5 }, (_, index) => `${details?.arrayLabel ?? 'item'}[${index}]`)} />;
    case 'stack':
      return <StackVisual />;
    case 'queue':
      return <QueueVisual />;
    case 'dictionary':
      return <DictionaryVisual />;
    case 'function':
      return <FunctionFlowVisual label={`${details?.functionLabel ?? 'function'} body`} />;
    case 'recursion':
      return <RecursionStackVisual label={details?.recursionLabel ?? details?.functionLabel ?? 'call'} />;
    case 'loop':
      return <LoopVisual label={details?.loopLabel ?? 'items'} />;
    case 'decision':
      return <DecisionVisual />;
    default:
      return <SequenceVisual steps={details?.flow ? flowLabels(details.flow) : []} />;
  }
}

const KIND_LABELS: Record<string, string> = {
  array: 'Data structure',
  stack: 'Data structure',
  queue: 'Data structure',
  dictionary: 'Data structure',
  function: 'Function structure',
  recursion: 'Call structure',
  loop: 'Iterating logic',
  decision: 'Branching logic',
  sequence: 'Sequential flow',
};

/** File-name style caption for the diagram frame, matching the editor chrome. */
const FRAME_TITLES: Record<string, string> = {
  array: 'collection.svg',
  stack: 'stack.svg',
  queue: 'queue.svg',
  dictionary: 'map.svg',
  function: 'function.svg',
  recursion: 'call-stack.svg',
  loop: 'loop.svg',
  decision: 'branch.svg',
  sequence: 'flow.svg',
};

export function VisualsTab({ analysis }: { analysis: LocalAnalysis | null }) {
  const [fullscreen, setFullscreen] = useState(false);

  if (!analysis) {
    return (
      <div className="visual-panel">
        <p className="muted">
          Analyze your code locally to generate a visual explanation of its structure. Nothing leaves this browser.
        </p>
      </div>
    );
  }

  const mermaid = buildMermaidSource(analysis);
  const ExpandIcon = fullscreen ? Minimize2 : Maximize2;
  const kind = analysis.diagram.kind;
  // A plain-language reading of the learner's own flow, so the diagram explains
  // itself in words as well as shapes.
  const summary = describeFlow(analysis.diagram.details?.flow ?? []);

  return (
    <div className={`visual-panel ${fullscreen ? 'fullscreen' : ''}`}>
      <div className="visual-head">
        <div>
          <Pill tone="cyan">
            <Sparkles size={12} aria-hidden="true" /> {KIND_LABELS[kind] ?? 'Structure view'}
          </Pill>
          <h3>{analysis.diagram.title}</h3>
          <p>{analysis.diagram.caption}</p>
        </div>
        <IconButton
          label={fullscreen ? 'Exit fullscreen visual' : 'Expand visual'}
          onClick={() => setFullscreen((value) => !value)}
          aria-expanded={fullscreen}
        >
          <ExpandIcon size={17} />
        </IconButton>
      </div>

      <figure className="diagram-frame">
        <figcaption className="diagram-frame-head">
          <span className="window-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="diagram-frame-title">{FRAME_TITLES[kind] ?? 'structure.svg'}</span>
        </figcaption>
        <div className="diagram-frame-body">
          <div className="svg-host">
            <SvgForKind analysis={analysis} />
          </div>
        </div>
        <div className="diagram-legend" aria-hidden="true">
          <span>
            <i className="swatch-structure" /> Structure
          </span>
          <span>
            <i className="swatch-active" /> Part in focus
          </span>
          <span>
            <i className="swatch-flow" /> Order of execution
          </span>
        </div>
      </figure>

      <div className="mermaid-block">
        <h4>Execution flow</h4>
        <MermaidDiagram source={mermaid} title={analysis.diagram.title} />
        <div className="flow-legend" aria-hidden="true">
          <span>
            <i className="lg-io" /> Input / output
          </span>
          <span>
            <i className="lg-calc" /> Calculation
          </span>
          <span>
            <i className="lg-decide" /> Decision
          </span>
          <span>
            <i className="lg-ret" /> Result
          </span>
        </div>
      </div>

      {summary ? (
        <div className="flow-summary">
          <strong>In plain words</strong>
          <p>{summary}</p>
        </div>
      ) : null}

      <div className="why-help">
        <GitBranch size={15} aria-hidden="true" />
        <span>
          <strong>Why this helps</strong> Seeing the shape of your logic makes the relationship between your data and the next step
          easier to reason about — and easier to explain to someone else.
        </span>
      </div>

      <div className="analysis-footer">
        <span>
          <ShieldCheck size={14} aria-hidden="true" /> Structure only — no runtime values are invented.
        </span>
      </div>
    </div>
  );
}
