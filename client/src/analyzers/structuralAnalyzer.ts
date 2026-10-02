import type {
  Confidence,
  LearningError,
  LineConfidence,
  LocalAnalysis,
  LocalDiagram,
  StructuralLanguage,
} from '../types';
import { extractVisualDetails } from './visualDetails';

/**
 * Honest *structural* analysis for the secure-remote (compiled) languages.
 *
 * CodeMentor never claims to fully parse C, C++ or Java in the browser. What
 * this module does is read the shape of the program — functions, loops,
 * conditionals, includes/imports, arrays — and turn it into concepts, line
 * notes, tips and a diagram. It never invents runtime behaviour and never
 * suggests corrections, which keeps the learning policy intact.
 */

type StructuralRuleResult = {
  concepts: string[];
  warnings: string[];
};

const LANGUAGE_NOTES: Record<StructuralLanguage, { entry: string; output: string; extra: string[] }> = {
  C: {
    entry: 'A `main` function is where a C program starts running.',
    output: 'Output is written with `printf` and friends from the standard library.',
    extra: [
      'Every `.c` file is compiled separately, then linked into one program.',
      'A header file (.h) shares declarations between source files.',
    ],
  },
  'C++': {
    entry: 'A `main` function is where a C++ program starts running.',
    output: 'Output is written through `std::cout` or `printf`.',
    extra: [
      'Headers such as `<iostream>` and `<vector>` bring in the standard library.',
      'Classes and the STL containers organise larger programs.',
    ],
  },
  Java: {
    entry: 'Execution begins in the `main` method of the entry class.',
    output: '`System.out.println` writes a line of output.',
    extra: [
      'Every public class usually lives in its own .java file matching the class name.',
      'The entry file/class must be selected correctly before running.',
    ],
  },
  'C#': {
    entry: 'Execution begins in the `Main` method.',
    output: '`Console.WriteLine` writes a line of output.',
    extra: ['Namespaces and classes group related code together.'],
  },
  Go: {
    entry: 'A `main` function in `package main` is where a Go program starts.',
    output: '`fmt.Println` writes output to the console.',
    extra: ['Imports must be used, or the compiler reports an error.'],
  },
  PHP: {
    entry: 'Statements run in order from the top of the file.',
    output: '`echo` and `print` write output.',
    extra: ['Variables start with `$` in PHP.'],
  },
  Ruby: {
    entry: 'Statements run in order from the top of the file.',
    output: '`puts` writes a line of output.',
    extra: ['Methods are defined with `def … end` blocks.'],
  },
  Rust: {
    entry: 'A `main` function is where a Rust program starts running.',
    output: '`println!` is a macro that writes a line of output.',
    extra: ['The Rust compiler explains most mistakes in detail — read its output calmly.'],
  },
  Kotlin: {
    entry: 'A `main` function is where a Kotlin program starts running.',
    output: '`println` writes a line of output.',
    extra: ['Kotlin infers many types, so `val` and `var` usually need no annotation.'],
  },
};

function structuralLineNote(trimmed: string, language: StructuralLanguage): string | null {
  if (/^\s*(#|\/\/)/.test(trimmed)) return 'A comment. Comments explain intent; they do not affect how the program runs.';
  if (/^\s*\/\*|\*\/|^\s*\*/.test(trimmed)) return 'A comment block. Comments explain intent; they do not affect how the program runs.';
  if (/^\s*#\s*include\b/.test(trimmed)) return 'Brings in a C/C++ header so its declarations can be used here.';
  if (/^\s*(import|using|package)\b/.test(trimmed)) return 'Names the modules, namespaces or package this file belongs to.';
  if (/\b(int|void)\s+\w+\s*\([^)]*\)\s*\{/.test(trimmed) || /^\s*(def|fn|func)\b/.test(trimmed))
    return 'Defines a reusable function that can be called with inputs.';
  if (/\bclass\s+\w+/.test(trimmed) || /\bstruct\s+\w+/.test(trimmed) || /\binterface\s+\w+/.test(trimmed))
    return 'Defines a type that groups related data and behaviour.';
  if (/^\s*(for|while)\b/.test(trimmed)) return 'Starts a loop that repeats work while a condition holds.';
  if (/^\s*(if|else|switch|case|match)\b/.test(trimmed)) return 'A decision point: different code runs depending on a condition.';
  if (/\breturn\b/.test(trimmed)) return 'Returns a result back to whoever called this function.';
  if (
    /printf|cout|println|puts\b|echo\b|Println|Console\.Write|System\.out/.test(trimmed)
  )
    return `Output statement: ${LANGUAGE_NOTES[language].output}`;
  if (/\bscanf|cin\b|readLine|Scanner|fgets/.test(trimmed))
    return 'Reads a value supplied by the user or by the program input panel.';
  if (/(=)/.test(trimmed) && !/(==|!=|>=|<=)/.test(trimmed)) return 'Stores or updates a value in a variable.';
  return null;
}

/** One calm learning error for a compile failure the provider reported. */
function compileError(execution: { status?: string; compileOutput?: string; message?: string; errorLine?: number | null; errorLineConfidence?: LineConfidence }): LearningError | null {
  if (execution.status !== 'compilation_error') return null;
  const line = typeof execution.errorLine === 'number' && execution.errorLine > 0 ? execution.errorLine : null;
  return {
    line,
    lineConfidence: line ? (execution.errorLineConfidence ?? 'estimated') : 'unknown',
    severity: 'error',
    category: 'Compile Error',
    type: 'CompilationError',
    title: 'The compiler reported an error',
    technicalMessage: (execution.message || 'The secure runner could not compile this version of the program.').slice(0, 300),
    whatHappened:
      'The compiler read the whole file and stopped before the program could run. The compile output shows the exact message and line it was reading.',
    whyItHappened:
      'Compilers are strict about syntax: a missing semicolon, bracket or misspelled keyword stops the whole file from compiling.',
    gentleHint: 'Open the Compile Output tab and read the first error message slowly — compilers usually point near the real spot.',
    guidedHint:
      'Check the reported line and the one just before it. Compare brackets, semicolons and names against a working example of the same construct.',
    learningHint:
      'Compile errors are the safest errors to have: nothing ran, nothing was damaged, and the message names a location. Reading compiler messages calmly is a core professional skill.',
    conceptReminder: 'Syntax rules are the grammar of the language — the compiler is a very literal reader.',
    selfCheckQuestion: 'Can I read the first compile error out loud and say which line it points to?',
    confidence: 'high' as Confidence,
  };
}

function runtimeError(execution: { status?: string; message?: string; stderr?: string; errorLine?: number | null; errorLineConfidence?: LineConfidence }): LearningError | null {
  if (execution.status !== 'runtime_error') return null;
  const line = typeof execution.errorLine === 'number' && execution.errorLine > 0 ? execution.errorLine : null;
  return {
    line,
    lineConfidence: line ? (execution.errorLineConfidence ?? 'estimated') : 'unknown',
    severity: 'error',
    category: 'Runtime Error',
    type: 'RuntimeError',
    title: 'The program stopped while running',
    technicalMessage: (execution.message || 'The program raised an error while it was running.').slice(0, 300),
    whatHappened: 'The program compiled and started, but stopped part-way through. The Errors tab shows the message it produced.',
    whyItHappened:
      'Runtime errors usually mean a value was not what the code expected: an empty input, an out-of-range index, or a failed allocation.',
    gentleHint: 'Check the input values and the line the error points to — what value arrived there?',
    guidedHint:
      'Add a small print before the failing line to show the value in question, run again, and compare what you expected with what appeared.',
    learningHint:
      'Runtime errors are logic teachers: the code was legal, but a value broke an assumption. Testing edge cases (empty input, zero, maximum size) catches most of them.',
    conceptReminder: 'Every assumption your code makes about its inputs is a place a runtime error can appear.',
    selfCheckQuestion: 'What value did I assume this variable holds, and where could that assumption break?',
    confidence: 'high' as Confidence,
  };
}

function timeoutWarning(execution: { status?: string }): LearningError | null {
  if (execution.status !== 'timeout') return null;
  return {
    line: null,
    lineConfidence: 'unknown',
    severity: 'hint',
    category: 'Resource Limit',
    type: 'Timeout',
    title: 'The run was stopped at the time limit',
    technicalMessage: 'The program ran longer than the learning time limit and was stopped.',
    whatHappened: 'The secure runner stopped the program so shared resources stay fair for every learner.',
    whyItHappened: 'The most common cause is a loop whose condition never becomes false, or work that grows too fast with input size.',
    gentleHint: 'Look for a loop condition that might always stay true.',
    guidedHint: 'Trace one pass of each loop by hand: what exactly changes each time, and will the condition ever become false?',
    learningHint:
      'Every loop needs something that moves it toward its end condition — a counter, a shrinking value, or a sentinel. This is the heart of algorithm design.',
    conceptReminder: 'Loop progress: for each pass, ask "what changed?" If nothing changed, the loop cannot end.',
    selfCheckQuestion: 'For my loop, what value changes on every pass, and how close does it bring me to the exit condition?',
    confidence: 'high' as Confidence,
  };
}

export function analyzeStructurally(
  source: string,
  language: StructuralLanguage,
  execution: Parameters<typeof compileError>[0] | null = null,
): LocalAnalysis {
  const lines = source.split(/\r?\n/);
  const notes = LANGUAGE_NOTES[language];

  const concepts: string[] = [];
  const warnings: string[] = [];
  const text = source;

  if (/\b(function|def|fn|func)\b|\b(int|void|public\s+static)\s+\w+\s*\(/.test(text)) concepts.push('Functions');
  if (/\bfor\s*\(|\bwhile\s*\(|\bforeach\b/.test(text)) concepts.push('Loops');
  if (/\bif\s*\(|\belse\b|\bswitch\b|\bmatch\b/.test(text)) concepts.push('Conditions');
  if (/\[\s*\]|std::vector|Array|List|\w+\[\d+\]/.test(text)) concepts.push('Arrays');
  if (/\bclass\s+\w+|\bstruct\s+\w+|\binterface\s+\w+/.test(text)) concepts.push('Types & structures');
  if (/\bprintf|cout|println|puts|echo|Println|Console\.Write|System\.out/.test(text)) concepts.push('Output');
  if (/\bscanf|cin\b|Scanner|readLine|fgets/.test(text)) concepts.push('Program input');
  if (/#\s*include|^\s*import\b|^\s*using\b/m.test(text)) concepts.push('Modules & headers');

  if (!/^(#include|package|using|import|\s*\/\*|\s*\/\/|\s*$)/m.test(source) && language === 'Java' && !/\bclass\s+\w+/.test(source)) {
    warnings.push('No class declaration was detected — Java code usually lives inside a class whose file matches the class name.');
  }
  if (!/\bmain\b/.test(source) && ['C', 'C++', 'Go', 'Rust', 'Kotlin'].includes(language)) {
    warnings.push('No `main` function was detected. The secure runner needs an entry point to start your program.');
  }
  if (language === 'Java' && !/\bmain\b/.test(source)) {
    warnings.push('No `public static void main` method was detected — the JVM starts programs there.');
  }
  const openBraces = (source.match(/{/g) ?? []).length;
  const closeBraces = (source.match(/}/g) ?? []).length;
  if (openBraces !== closeBraces) {
    warnings.push(
      `There are ${openBraces} opening and ${closeBraces} closing braces. Braces usually come in pairs, so this may be an incomplete block — or a brace inside a string or comment.`,
    );
  }

  const lineExplanations = lines
    .map((line, index) => {
      const trimmed = line.trim();
      const note =
        trimmed === ''
          ? null
          : (structuralLineNote(trimmed, language) ?? 'Performs a step in the program’s logic.');
      return { line: index + 1, text: note ?? '' };
    })
    .filter((entry) => entry.text !== '')
    .slice(0, 40);

  const errors: LearningError[] = [];
  const compile = compileError(execution ?? {});
  if (compile) errors.push(compile);
  const runtime = runtimeError(execution ?? {});
  if (runtime) errors.push(runtime);
  const timeout = timeoutWarning(execution ?? {});
  if (timeout) errors.push(timeout);

  let kind: LocalDiagram['kind'] = 'sequence';
  if (concepts.includes('Loops')) kind = 'loop';
  else if (concepts.includes('Conditions')) kind = 'decision';
  else if (concepts.includes('Functions')) kind = 'function';
  else if (concepts.includes('Arrays')) kind = 'array';

  const diagramTitles: Record<LocalDiagram['kind'], string> = {
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
  const diagramCaptions: Record<LocalDiagram['kind'], string> = {
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

  const hasErrors = errors.some((error) => error.severity === 'error');
  const summary = hasErrors
    ? `Let’s understand this together. The ${language} run reported a problem worth reviewing.`
    : errors.length
      ? `Your ${language} structure is clear. There is a gentle resource note below.`
      : `Your ${language} structure reads clearly. Review the concepts below and keep experimenting.`;

  const purpose = [
    notes.entry,
    notes.extra[0],
  ].join(' ');

  const tips = [
    ...notes.extra,
    'Change one thing at a time, then run the current editor code again.',
    'Read compiler messages calmly — they name a file, a line and a reason.',
    'Test one edge case on purpose: empty input, zero, or the largest value you allow.',
  ].slice(0, 5);

  const debuggingSteps = [
    'Read the run message calmly before changing anything.',
    'Find the reported line and the statement just before it.',
    'Print the values that line receives, one at a time.',
    'Try one small change, then run the current editor code again.',
  ];

  return {
    source: 'local',
    language,
    summary,
    purpose,
    concepts: concepts.slice(0, 8),
    lineExplanations,
    errors,
    debuggingSteps,
    tips,
    diagram: {
      kind,
      title: diagramTitles[kind],
      caption: diagramCaptions[kind],
      details: extractVisualDetails(source),
    },
    quizReadiness: { ready: concepts.length > 0, concepts: concepts.slice(0, 8) },
    warnings,
  };
}
