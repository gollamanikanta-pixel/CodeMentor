import type { AnalyzableLanguage, LanguageName } from '../types';

export type ExecutionMode =
  | 'interactive_hosted'
  | 'browser_python'
  | 'browser_javascript'
  | 'browser_html_preview'
  | 'browser_transpile_planned'
  | 'sql_sandbox_planned'
  | 'secure_remote'
  | 'coming_soon';

export type LanguageKey =
  | 'python'
  | 'javascript'
  | 'typescript'
  | 'html'
  | 'sql'
  | 'c'
  | 'cpp'
  | 'java'
  | 'csharp'
  | 'go'
  | 'php'
  | 'ruby'
  | 'rust'
  | 'kotlin';

export type LanguageConfig = {
  key: LanguageKey;
  displayName: LanguageName;
  extensions: string[];
  monacoLanguage: string;
  executionMode: ExecutionMode;
  statusLabel: string;
  statusDescription: string;
  executionEnabled: boolean;
  analysisSupported: boolean;
  providerLanguage?: string;
  starter: string;
};

const SECURE_MESSAGE =
  'The hosted interactive runner is not configured. Follow the E2B runner setup instructions in README.md.';

/**
 * The exact capability statement required in the Help centre, secure-runner
 * status UI and language descriptions for compiled languages.
 */
export const RUNNER_CAPABILITY_STATEMENT =
  'CodeMentor runs most supported console and multi-file learning projects in isolated environments. Some projects may be limited by compiler versions, security, runtime, memory, package, network, or platform requirements.';

const SECURE_META: Record<
  string,
  { displayName: LanguageName; extensions: string[]; monacoLanguage: string }
> = {
  c: { displayName: 'C', extensions: ['.c', '.h'], monacoLanguage: 'c' },
  cpp: { displayName: 'C++', extensions: ['.cpp', '.cc', '.cxx', '.hpp'], monacoLanguage: 'cpp' },
  java: { displayName: 'Java', extensions: ['.java'], monacoLanguage: 'java' },
  csharp: { displayName: 'C#', extensions: ['.cs'], monacoLanguage: 'csharp' },
  go: { displayName: 'Go', extensions: ['.go'], monacoLanguage: 'go' },
  php: { displayName: 'PHP', extensions: ['.php'], monacoLanguage: 'php' },
  ruby: { displayName: 'Ruby', extensions: ['.rb'], monacoLanguage: 'ruby' },
  rust: { displayName: 'Rust', extensions: ['.rs'], monacoLanguage: 'rust' },
  kotlin: { displayName: 'Kotlin', extensions: ['.kt'], monacoLanguage: 'kotlin' },
};

const SECURE_STARTERS: Record<string, string> = {
  c: '#include <stdio.h>\n\nint main(void) {\n  printf("Hello, learner!\\n");\n  return 0;\n}',
  cpp: '#include <iostream>\n\nint main() {\n  std::cout << "Hello, learner!" << std::endl;\n  return 0;\n}',
  java: 'class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello, learner!");\n  }\n}',
  csharp: 'using System;\n\nclass Program {\n  static void Main() {\n    Console.WriteLine("Hello, learner!");\n  }\n}',
  go: 'package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("Hello, learner!")\n}',
  php: '<?php\necho "Hello, learner!";',
  ruby: 'puts "Hello, learner!"',
  rust: 'fn main() {\n  println!("Hello, learner!");\n}',
  kotlin: 'fun main() {\n  println("Hello, learner!")\n}',
};

const HTML_STARTER = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>My learning page</title>
  </head>
  <body>
    <header><h1>Hello, learner!</h1></header>
    <main>
      <p id="message">Edit this page, then choose Run Preview.</p>
      <button id="learn">Try the interaction</button>
    </main>
    <script>
      document.querySelector('#learn').addEventListener('click', function () {
        document.querySelector('#message').textContent = 'You changed the page with JavaScript!';
      });
    </script>
  </body>
</html>`;

export const languageConfigs: LanguageConfig[] = [
  {
    key: 'python',
    displayName: 'Python',
    extensions: ['.py'],
    monacoLanguage: 'python',
    executionMode: 'interactive_hosted',
    statusLabel: 'Hosted interactive runner',
    statusDescription: 'Runs in an isolated hosted sandbox through the configured E2B runner.',
    executionEnabled: true,
    analysisSupported: true,
    starter:
      'def average(scores):\n    total = sum(scores)\n    return total / len(scores)\n\nmarks = [82, 91, 76, 88]\nprint("Class average:", average(marks))',
  },
  {
    key: 'javascript',
    displayName: 'JavaScript',
    extensions: ['.js', '.mjs'],
    monacoLanguage: 'javascript',
    executionMode: 'interactive_hosted',
    statusLabel: 'Hosted interactive runner',
    statusDescription: 'Runs in an isolated hosted sandbox through the configured E2B runner.',
    executionEnabled: true,
    analysisSupported: true,
    starter:
      'const scores = [82, 91, 76, 88];\nconst average = scores.reduce((sum, score) => sum + score, 0) / scores.length;\n\nconsole.log("Class average:", average);',
  },
  {
    key: 'typescript',
    displayName: 'TypeScript',
    extensions: ['.ts'],
    monacoLanguage: 'typescript',
    executionMode: 'browser_transpile_planned',
    statusLabel: 'Local analysis only',
    statusDescription:
      'TypeScript execution is planned. You can write and save code while safe transpilation support is developed.',
    executionEnabled: false,
    analysisSupported: true,
    starter:
      'type Student = { name: string; score: number };\n\nconst learner: Student = { name: "Mina", score: 92 };\n\nconsole.log(learner.name);',
  },
  {
    key: 'html',
    displayName: 'HTML',
    extensions: ['.html', '.htm'],
    monacoLanguage: 'html',
    executionMode: 'browser_html_preview',
    statusLabel: 'Sandboxed Browser Preview',
    statusDescription:
      'Renders your HTML, CSS and JavaScript in an isolated preview. External resources are blocked and nothing is uploaded.',
    // Preview is not a worker run, so the plain Run button stays disabled; the
    // Preview panel raises its own "Run Preview" control.
    executionEnabled: false,
    analysisSupported: true,
    starter: HTML_STARTER,
  },
  {
    key: 'sql',
    displayName: 'SQL',
    extensions: ['.sql'],
    monacoLanguage: 'sql',
    executionMode: 'sql_sandbox_planned',
    statusLabel: 'Local analysis only',
    statusDescription:
      'SQL query execution is planned. A safe practice database engine is needed before queries can run.',
    executionEnabled: false,
    analysisSupported: true,
    starter:
      'SELECT concept, AVG(score) AS average_score\nFROM quiz_attempts\nGROUP BY concept\nORDER BY average_score DESC;',
  },
  ...(['c', 'cpp', 'java', 'csharp', 'go', 'php', 'ruby', 'rust', 'kotlin'] as LanguageKey[]).map(
    (key): LanguageConfig => ({
      key,
      ...SECURE_META[key],
      executionMode: 'interactive_hosted',
      statusLabel: 'Hosted interactive runner',
      statusDescription: SECURE_MESSAGE,
      // The interactive runner executes source in an isolated hosted sandbox.
      executionEnabled: true,
      analysisSupported: false,
      providerLanguage: key,
      starter: SECURE_STARTERS[key],
    }),
  ),
];

export const languageByDisplayName = Object.fromEntries(
  languageConfigs.map((item) => [item.displayName, item]),
) as Record<LanguageName, LanguageConfig>;

export const languageNames = languageConfigs.map((item) => item.displayName);

export const availableLanguageNames: LanguageName[] = ['Python', 'JavaScript', 'Java', 'C', 'C++', 'HTML'];

export const comingSoonLanguageNames = languageNames.filter(
  (name) => !availableLanguageNames.includes(name),
);

export function isLanguageAvailable(language: LanguageName): boolean {
  return availableLanguageNames.includes(language);
}

export function languageOptionLabel(language: LanguageName): string {
  return isLanguageAvailable(language) ? language : `${language} (Coming soon)`;
}

export const runnableLanguages: LanguageName[] = languageConfigs
  .filter((item) => item.executionEnabled && isLanguageAvailable(item.displayName))
  .map((item) => item.displayName);

export const analyzableLanguages: AnalyzableLanguage[] = languageConfigs
  .filter((item) => item.analysisSupported)
  .map((item) => item.displayName as AnalyzableLanguage);

export const interactiveRunnerLanguages: LanguageName[] = [
  'Python',
  'JavaScript',
  'C',
  'C++',
  'Java',
];
export const multiFileExecutionLanguages: LanguageName[] = ['C', 'C++', 'Java'];
export const previewLanguages = ['HTML'];
export const plannedAnalysisLanguages = ['TypeScript', 'SQL'];

export function getLanguage(displayName: LanguageName): LanguageConfig {
  return languageByDisplayName[displayName];
}

export function detectLanguageFromFilename(filename: string): LanguageConfig | undefined {
  const extension = `.${filename.split('.').pop()?.toLowerCase() || ''}`;
  return languageConfigs.find((item) => item.extensions.includes(extension));
}

export function isRunnable(language: LanguageName): language is 'Python' | 'JavaScript' {
  return language === 'Python' || language === 'JavaScript';
}

export function isInteractiveRunnable(language: LanguageName): boolean {
  return isLanguageAvailable(language) && getLanguage(language)?.executionMode === 'interactive_hosted';
}

/** HTML renders in the sandboxed preview rather than a code worker. */
export function isPreviewable(language: LanguageName): language is 'HTML' {
  return language === 'HTML';
}

/** Delegated to the configured secure provider (never run on this backend). */
export function isSecureRemote(language: LanguageName): boolean {
  return getLanguage(language)?.executionMode === 'secure_remote';
}

export function isAnalyzable(language: LanguageName): language is AnalyzableLanguage {
  return getLanguage(language)?.analysisSupported === true;
}
