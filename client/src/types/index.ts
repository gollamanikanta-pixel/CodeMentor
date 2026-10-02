/**
 * Shared domain types for CodeMentor.
 *
 * These describe the language-independent shapes that flow between the
 * runner, the local analyzer, the quiz engine, the diagram layer and the UI.
 * Keeping them in one module lets every feature share a single source of truth
 * without importing implementation details.
 */

export type LanguageName =
  | 'Python'
  | 'JavaScript'
  | 'TypeScript'
  | 'HTML'
  | 'SQL'
  | 'C'
  | 'C++'
  | 'Java'
  | 'C#'
  | 'Go'
  | 'PHP'
  | 'Ruby'
  | 'Rust'
  | 'Kotlin';

/** Languages that ship a browser runner today. */
export type RunnableLanguage = 'Python' | 'JavaScript';

/** Languages the local (no-AI) analyzer understands. */
export type AnalyzableLanguage = 'Python' | 'JavaScript' | 'TypeScript' | 'HTML' | 'SQL';
/**
 * Compiled/secure-remote languages without a deep rule-based analyzer. They
 * still receive honest local *structural* guidance (shape, concepts, tips) so
 * "Analyze Locally" guides instead of silently doing nothing.
 */
export type StructuralLanguage = 'C' | 'C++' | 'Java' | 'C#' | 'Go' | 'PHP' | 'Ruby' | 'Rust' | 'Kotlin';
export type AnalysisLanguage = AnalyzableLanguage | StructuralLanguage;

export type LineConfidence = 'exact' | 'estimated' | 'unknown';
export type ErrorSeverity = 'error' | 'warning' | 'hint';
export type Confidence = 'high' | 'medium' | 'low';

export type RunStatus =
  | 'success'
  | 'syntax_error'
  | 'compilation_error'
  | 'runtime_error'
  | 'timeout'
  | 'time_limit_exceeded'
  | 'memory_limit_exceeded'
  | 'cancelled'
  | 'internal_error'
  | 'unavailable';

/** Transient worker phases shown to the learner while a run is in flight. */
export type ProgressStatus = 'preparing' | 'running';

export type ExecutionResult = {
  status: RunStatus;
  stdout: string;
  stderr: string;
  message: string;
  time: number | null;
  errorLine: number | null;
  errorLineConfidence: LineConfidence;
  executionMode: string;
  /** The exact stdin that was fed to this run, so the console can show it. */
  stdin?: string;
  /** Local workers echo input and prompts into stdout like an interactive terminal. */
  stdinEchoed?: boolean;
  /** Present for remote runs: compiler output, exit code and memory usage. */
  compileOutput?: string;
  exitCode?: number | null;
  memory?: number | null;
};

export type LearningStep = { step: number; text: string };

export type LearningError = {
  line: number | null;
  lineConfidence: LineConfidence;
  severity: ErrorSeverity;
  category: string;
  type: string;
  title: string;
  technicalMessage: string;
  whatHappened: string;
  whyItHappened: string;
  gentleHint: string;
  guidedHint: string;
  learningHint: string;
  conceptReminder: string;
  selfCheckQuestion: string;
  confidence: Confidence;
};

export type LineExplanation = {
  line: number;
  text: string;
  concept?: string;
};

export type DiagramKind =
  | 'array'
  | 'stack'
  | 'queue'
  | 'dictionary'
  | 'function'
  | 'recursion'
  | 'decision'
  | 'loop'
  | 'sequence';

/**
 * One step in the learner's own control flow, read from their source. Used to
 * draw a *program-specific* execution flow instead of one generic template, so
 * two different programs produce two different diagrams.
 */
export type FlowNodeKind = 'stmt' | 'input' | 'output' | 'return' | 'loop' | 'branch' | 'func';
export type FlowNode = {
  kind: FlowNodeKind;
  label: string;
  /**
   * The real condition text for a branch or loop, read from the source (e.g.
   * `sum > 50`, `i < n`, `n in numbers`). The diagram shows this, so two
   * programs with different conditions never share a label.
   */
  condition?: string;
  /** Body of a loop/branch/function, when the source nests one. */
  body?: FlowNode[];
  /** The `else` arm of a condition (or the `if` after an `else if`). */
  elseBody?: FlowNode[];
};

export type LocalDiagram = {
  kind: DiagramKind;
  title: string;
  caption: string;
  /**
   * Safe labels read from the analyzed source so the visual speaks the
   * learner's language ("more scores?" instead of "more items?"). Filled by
   * the analyzers; the visual layer renders them as plain text only.
   */
  details: {
    loopLabel: string;
    arrayLabel: string;
    functionLabel: string;
    conditionLabel: string;
    recursionLabel: string | null;
    /** Parsed control flow of the learner's own source (structure only). */
    flow: FlowNode[];
  };
};

export type LocalAnalysis = {
  source: 'local';
  language: AnalysisLanguage;
  summary: string;
  purpose: string;
  concepts: string[];
  lineExplanations: LineExplanation[];
  errors: LearningError[];
  debuggingSteps: string[];
  tips: string[];
  diagram: LocalDiagram;
  quizReadiness: { ready: boolean; concepts: string[] };
  warnings: string[];
};

export type QuizQuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'concept'
  | 'find_issue'
  | 'debugging_strategy'
  | 'output_prediction';

export type LocalQuestion = {
  id: string;
  type: QuizQuestionType;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  concept: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
};

export type StoredProject = {
  id: string;
  title: string;
  language: LanguageName;
  code: string;
  stdin: string;
  updatedAt: string;
  status?: string;
};

export type QuizRecord = {
  id: string;
  project: string;
  projectId?: string;
  language: LanguageName;
  difficulty: string;
  score: number;
  total: number;
  percentage: string;
  date: string;
  conceptsToReview: string[];
};

export type DeepAnalysis = {
  source: 'ai';
  summary: string;
  deeperExplanation: string;
  concepts: string[];
  errors: LearningError[];
  debuggingSteps: string[];
  tips: string[];
  additionalQuizQuestions: LocalQuestion[];
  warnings: string[];
  cached?: boolean;
  remaining?: number;
};
