import { useState, type ReactNode } from 'react';
import {
  Bot,
  BookOpen,
  ChevronRight,
  CircleHelp,
  Code2,
  Keyboard,
  Lightbulb,
  ShieldCheck,
  Server,
} from 'lucide-react';
import { Pill } from '../components/ui';
import {
  comingSoonLanguageNames,
  localRunnerLanguages,
} from '../data/languages';

const SECTIONS: Array<{ icon: typeof BookOpen; title: string; body: ReactNode }> = [
  {
    icon: BookOpen,
    title: 'What is CodeMentor AI?',
    body: (
      <p>
        CodeMentor AI is a guided learning and debugging workspace. It identifies likely issues, explains what happened and why, and
        gives you progressive hints so you can make the change yourself. It guides rather than auto-fixes your code.
      </p>
    ),
  },
  {
    icon: Code2,
    title: 'Playground guide',
    body: (
      <p>
        Write a Python or JavaScript program, add any input under <strong>Program Input</strong>, then click <strong>Run Code</strong>.
        Runs happen locally in isolated browser runtimes. Use <strong>Analyze Locally</strong> for concepts,
        line-by-line explanations, visuals
        and quizzes. <strong>I Fixed It — Run Code Again</strong> runs only the code currently in the editor.
      </p>
    ),
  },
  {
    icon: Lightbulb,
    title: 'Errors & Learning Hints',
    body: (
      <p>
        For each detected issue you get the category, a possible line, the technical message, what happened, why, a progressive hint
        (gentle, guided or learning), a concept to review, a self-check question and debugging steps. CodeMentor AI never shows corrected
        code, patches, diffs or an Apply Fix control.
      </p>
    ),
  },
  {
    icon: Server,
    title: 'Browser-based execution',
    body: (
      <p>
        {localRunnerLanguages.join(' and ')} run in isolated browser runtimes, so their source is not uploaded to an execution service. Python runs in a
        worker and downloads its Pyodide runtime from jsDelivr; Python programs can make their own network requests. JavaScript runs in a
        worker inside a sandboxed iframe with network access blocked. Add standard input before running. HTML/CSS/JavaScript web projects are rendered
        in a separate sandboxed browser preview. C, C++, and Java run through the configured isolated execution service when it reports
        the language ready; their source and input are sent only after you choose Run Code.
      </p>
    ),
  },
  {
    icon: BookOpen,
    title: 'Coming soon languages',
    body: (
      <p>
        <strong>{comingSoonLanguageNames.join(', ')}</strong> are shown in the language menu as coming soon and cannot be selected or run yet.
      </p>
    ),
  },
  {
    icon: Bot,
    title: 'AI Deep Help',
    body: (
      <p>
        AI is optional, backend-only and never called automatically. It only runs when you click <strong>Ask AI for Deeper Help</strong>
        and confirm. Cached results for the same code version are reused. CodeMentor does not impose a daily request cap or cooldown;
        your AI provider's availability, quotas and billing still apply, and local guidance always remains available.
      </p>
    ),
  },
  {
    icon: ShieldCheck,
    title: 'Privacy and safe coding',
    body: (
      <p>
        Do not enter passwords, personal information, tokens, database credentials or API keys in learning code. Your settings, drafts,
        projects and quiz history stay in this browser. Secrets are never exposed to the frontend.
      </p>
    ),
  },
];

const SHORTCUTS = [
  ['Ctrl/Cmd + Enter', 'Run the current code'],
  ['Esc', 'Close an open dialog'],
  ['Tab', 'Indent inside the editor'],
  ['Ctrl/Cmd + S', 'Save the project locally'],
];

const FAQS = [
  [
    'How does CodeMentor AI teach instead of auto-fixing?',
    'It identifies likely issues, explains what happened and why, and gives progressive hints and self-check questions. It never returns corrected code, exact fixes, patches or diffs.',
  ],
  [
    'Which languages can run?',
    'Python and JavaScript run locally in isolated browser runtimes. JavaScript runs in a network-restricted sandbox; Python runs in a worker and Python programs can make network requests. C, C++, and Java run through the configured isolated execution service when the language is reported ready; source and input are sent only after you choose Run Code. HTML web projects use a separate sandboxed browser preview. Other listed languages are coming soon.',
  ],
  [
    'What should I keep out of learning code?',
    'Passwords, personal details, tokens, database credentials and API keys. Treat every shared program as something others may read.',
  ],
  [
    'When would AI Deep Help be useful?',
    'When the local explanation is not quite enough. It is optional, has no CodeMentor-imposed request cap or cooldown, and cached explanations for the same code version are reused. Your AI provider’s quotas and billing still apply.',
  ],
];

export function HelpPage() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="content-page help-page">
      <div className="help-hero">
        <div>
          <span className="eyebrow">A KINDER WAY TO DEBUG</span>
          <h1>
            Help when you need it.
            <br />
            <em>Clarity when you don’t.</em>
          </h1>
          <p>
            CodeMentor AI guides you; it does not auto-fix your code. Here are the essentials for a thoughtful learning session.
          </p>
        </div>
        <div className="help-orbit" aria-hidden="true">
          <CircleHelp size={42} />
        </div>
      </div>

      <div className="help-grid">
        <div className="help-main">
          {SECTIONS.map(({ icon: Icon, title, body }) => (
            <section className="help-section" key={title}>
              <div className="help-section-icon">
                <Icon size={22} aria-hidden="true" />
              </div>
              <div>
                <h2>{title}</h2>
                {body}
              </div>
            </section>
          ))}
          <section className="help-section">
            <div className="help-section-icon">
              <Keyboard size={22} aria-hidden="true" />
            </div>
            <div>
              <h2>Keyboard shortcuts</h2>
              <ul className="shortcut-list">
                {SHORTCUTS.map(([keys, description]) => (
                  <li key={keys}>
                    <kbd>{keys}</kbd> {description}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        <div className="faq-card card">
          <span className="eyebrow">QUICK ANSWERS</span>
          <h2>Frequently asked</h2>
          {FAQS.map(([question, answer], index) => (
            <div key={question} className="faq-item">
              <button aria-expanded={open === index} onClick={() => setOpen(open === index ? null : index)}>
                {question}
                <ChevronRight size={16} aria-hidden="true" className={open === index ? 'rotated' : ''} />
              </button>
              {open === index ? <p>{answer}</p> : null}
            </div>
          ))}
          <div className="fair-use">
            <Pill tone="violet">
              <Bot size={12} aria-hidden="true" /> Use Local Guidance First
            </Pill>
          </div>
        </div>
      </div>
    </div>
  );
}
