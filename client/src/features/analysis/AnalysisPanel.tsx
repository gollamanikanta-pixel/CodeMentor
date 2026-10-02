import { useState, type ReactNode } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CircleHelp,
  GitBranch,
  Lightbulb,
  ListChecks,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import type { ExecutionResult, LocalAnalysis, LearningError } from '../../types';
import type { HintLevel } from '../../settings/defaults';
import { Button, EmptyState, Pill, Tabs } from '../../components/ui';

export const ANALYSIS_TABS = ['Overview', 'Line by Line', 'Errors & Learning Hints', 'Tips', 'Visuals', 'Quiz'] as const;
export type AnalysisTab = (typeof ANALYSIS_TABS)[number];

export function AnalysisPanel({
  activeTab,
  onTabChange,
  analysis,
  execution,
  hintLevel,
  onAnalyze,
  onRetry,
  onJumpToLine,
  children,
}: {
  activeTab: AnalysisTab;
  onTabChange: (tab: AnalysisTab) => void;
  analysis: LocalAnalysis | null;
  execution: ExecutionResult | null;
  hintLevel: HintLevel;
  onAnalyze: () => void;
  onRetry: () => void;
  onJumpToLine: (line: number) => void;
  children: ReactNode;
}) {
  return (
    <section id="learning-analysis" className="analysis-card card" aria-label="Learning analysis">
      {/* Screen-reader announcement whenever a fresh analysis lands. */}
      <p role="status" aria-live="polite" className="sr-only">
        {analysis ? 'Analysis completed.' : ''}
      </p>
      <div className="card-heading">
        <div>
          <span className="eyebrow">LEARNING LAYER</span>
          <h2>Learning Assistant</h2>
        </div>
      </div>
      <Tabs tabs={ANALYSIS_TABS} active={activeTab} onChange={onTabChange} className="analysis-tabs" ariaLabel="Analysis sections" />
      {!analysis ? (
        <EmptyState
          icon={Sparkles}
          title="Ready when you are"
          action={
            <Button variant="soft" icon={WandSparkles} onClick={onAnalyze}>
              Analyze locally
            </Button>
          }
        >
          Write or upload code, then run it or choose <strong>Analyze Locally</strong> to begin learning.
        </EmptyState>
      ) : activeTab === 'Overview' ? (
        <OverviewTab analysis={analysis} />
      ) : activeTab === 'Line by Line' ? (
        <LineByLineTab analysis={analysis} onJumpToLine={onJumpToLine} />
      ) : activeTab === 'Errors & Learning Hints' ? (
        <ErrorsHintsTab
          analysis={analysis}
          hintLevel={hintLevel}
          execution={execution}
          onRetry={onRetry}
          onJumpToLine={onJumpToLine}
        />
      ) : activeTab === 'Tips' ? (
        <TipsTab analysis={analysis} />
      ) : (
        children
      )}
    </section>
  );
}

function OverviewTab({ analysis }: { analysis: LocalAnalysis }) {
  return (
    <div className="analysis-content">
      <div className={`analysis-summary ${analysis.errors.length ? 'warning' : 'success'}`}>
        <div className="summary-icon">
          {analysis.errors.length ? <Lightbulb size={19} /> : <Check size={19} />}
        </div>
        <div>
          <strong>{analysis.summary}</strong>
          <p>{analysis.purpose}</p>
        </div>
      </div>
      <div className="concept-list">
        <strong>Concepts to review</strong>
        {analysis.concepts.length ? (
          analysis.concepts.map((concept) => (
            <span key={concept}>
              <Check size={14} /> {concept}
            </span>
          ))
        ) : (
          <span>Add more statements so CodeMentor AI can detect concepts.</span>
        )}
      </div>
      <div className="analysis-footer">
        <span>
          <ShieldCheck size={14} /> Generated locally from your code
        </span>
      </div>
    </div>
  );
}

function LineByLineTab({
  analysis,
  onJumpToLine,
}: {
  analysis: LocalAnalysis;
  onJumpToLine: (line: number) => void;
}) {
  return (
    <div className="analysis-content">
      <h3 className="section-subtitle">What each line is doing</h3>
      {analysis.lineExplanations.length ? (
        <ol className="line-list">
          {analysis.lineExplanations.map((entry) => (
            <li key={entry.line}>
              <button
                type="button"
                className="line-badge line-jump"
                onClick={() => onJumpToLine(entry.line)}
                aria-label={`Jump to line ${entry.line} in editor`}
              >
                Ln {entry.line}
              </button>
              <p>{entry.text}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">Add some statements and run Analyze Locally for a line-by-line walkthrough.</p>
      )}
      <div className="analysis-footer">
        <span>
          <ShieldCheck size={14} /> Generated locally from your code
        </span>
      </div>
    </div>
  );
}

function hintFor(error: LearningError, level: HintLevel): { label: string; text: string } {
  if (level === 'Gentle') return { label: 'Gentle hint · 1 of 3', text: error.gentleHint };
  if (level === 'Learning') return { label: 'Learning hint · 3 of 3', text: error.learningHint };
  return { label: 'Guided hint · 2 of 3', text: error.guidedHint };
}

export function ErrorsHintsTab({
  analysis,
  hintLevel,
  execution,
  onRetry,
  onJumpToLine,
}: {
  analysis: LocalAnalysis;
  hintLevel: HintLevel;
  execution: ExecutionResult | null;
  onRetry: () => void;
  onJumpToLine: (line: number) => void;
}) {
  const [index, setIndex] = useState(0);
  const errors = analysis.errors;
  const resolved = execution?.status === 'success' && errors.length === 0;

  if (!errors.length) {
    return (
      <div className="analysis-content">
        <div className="analysis-summary success">
          <div className="summary-icon">
            <Check size={19} />
          </div>
          <div>
            <strong>Great work—this error is no longer detected. You fixed it yourself.</strong>
            <p>
              {resolved
                ? 'Your latest run completed without a detected issue. Review the concepts below to keep the learning going.'
                : 'No likely issues were found by the local analyzer on this version of your code.'}
            </p>
          </div>
        </div>
        <div className="concept-list">
          <strong>Concepts to review</strong>
          {analysis.concepts.slice(0, 5).map((concept) => (
            <span key={concept}>
              <Check size={14} /> {concept}
            </span>
          ))}
        </div>
        <Button variant="soft" icon={RotateCcw} onClick={onRetry}>
          I Fixed It — Run Code Again
        </Button>
        <div className="analysis-footer">
          <span>
            <ShieldCheck size={14} /> Generated locally from your code
          </span>
        </div>
      </div>
    );
  }

  const error = errors[Math.min(index, errors.length - 1)];
  const errorLine = error.line;
  const hint = hintFor(error, hintLevel);
  const tone = error.severity === 'error' ? 'red' : error.severity === 'hint' ? 'indigo' : 'amber';

  return (
    <div className="analysis-content">
      <div className="analysis-summary warning">
        <div className="summary-icon">
          <Lightbulb size={19} />
        </div>
        <div>
          <strong>Let’s understand this error together.</strong>
          <p>
            {errors.length} learning {errors.length === 1 ? 'opportunity' : 'opportunities'} detected. Review each one, then try one
            small change.
          </p>
        </div>
      </div>

      {errors.length > 1 ? (
        <div className="error-pager" role="tablist" aria-label="Detected issues">
          {errors.map((item, itemIndex) => (
            <button
              key={`${item.type}-${item.line}-${itemIndex}`}
              role="tab"
              aria-selected={itemIndex === index}
              className={itemIndex === index ? 'active' : ''}
              onClick={() => setIndex(itemIndex)}
            >
              {itemIndex + 1}
            </button>
          ))}
        </div>
      ) : null}

      <article className="error-card">
        <div className="error-top">
          <Pill tone={tone}>{error.category}</Pill>
          {errorLine ? (
            <button
              type="button"
              className="line-jump"
              onClick={() => onJumpToLine(errorLine)}
              aria-label={`Jump to line ${errorLine} in editor`}
            >
              Jump to line {errorLine} · {error.lineConfidence}
            </button>
          ) : (
            <span>Line not certain · unknown</span>
          )}
        </div>
        <h3>{error.title}</h3>
        <p className="technical">
          {error.type} · {error.technicalMessage}
        </p>
        <div className="explanation">
          <strong>What happened</strong>
          <p>{error.whatHappened}</p>
          <strong>Why it happened</strong>
          <p>{error.whyItHappened}</p>
        </div>
        <div className="hint-box">
          <Lightbulb size={17} />
          <div>
            <strong>{hint.label}</strong>
            <p>{hint.text}</p>
          </div>
        </div>
        <div className="self-check">
          <CircleHelp size={16} />
          <span>Self-check: {error.selfCheckQuestion}</span>
        </div>
        <div className="concept-reminder">
          <GitBranch size={15} />
          <span>
            <strong>Concept to review:</strong> {error.conceptReminder}
          </span>
        </div>
        <div className="debug-steps">
          <strong>Debugging steps</strong>
          {analysis.debuggingSteps.map((step, stepIndex) => (
            <span key={step}>
              <i>{stepIndex + 1}</i> {step}
            </span>
          ))}
        </div>
      </article>

      <div className="hint-progression" aria-label="Hint uncertainty labels">
        <Pill tone="amber">Possible issue</Pill>
        <Pill tone="indigo">Suggestion</Pill>
        <Pill tone="cyan">Likely logic issue</Pill>
      </div>

      <Button variant="soft" icon={RotateCcw} onClick={onRetry}>
        I Fixed It — Run Code Again
      </Button>

      <p className="policy-note">
        <AlertCircle size={14} /> CodeMentor AI never writes the fix for you. Use these hints to make the change yourself, then run
        your current code again.
      </p>

      <div className="analysis-footer">
        <span>
          <ShieldCheck size={14} /> Generated locally from your code
        </span>
      </div>
    </div>
  );
}

function TipsTab({ analysis }: { analysis: LocalAnalysis }) {
  return (
    <div className="analysis-content">
      <h3 className="section-subtitle">Programming tips for this code</h3>
      <ul className="tips-list">
        {analysis.tips.map((tip) => (
          <li key={tip}>
            <Lightbulb size={15} /> {tip}
          </li>
        ))}
      </ul>
      {analysis.warnings.length ? (
        <div className="warning-list">
          <strong>Worth noting</strong>
          {analysis.warnings.map((warning) => (
            <span key={warning}>
              <CircleHelp size={14} /> {warning}
            </span>
          ))}
        </div>
      ) : null}
      <div className="next-steps">
        <ListChecks size={16} />
        <span>
          Next step: <strong>Generate a local quiz</strong> from these concepts to make them stick.
        </span>
        <ArrowRight size={14} />
      </div>
    </div>
  );
}
