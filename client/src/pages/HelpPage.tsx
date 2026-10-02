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
  interactiveRunnerLanguages,
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
        Write or upload a program, choose an executable language, then click <strong>Run Code</strong>. When the program starts,
        type each requested value in the live console input and press Enter. Use <strong>Analyze Locally</strong> for concepts,
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
    title: 'Interactive Runner languages',
    body: (
      <p>
        <strong>{interactiveRunnerLanguages.join(', ')}</strong> are available in isolated E2B cloud sandboxes with outbound internet access
        disabled. Source code is sent to E2B through the configured backend runner; set an E2B API key and build the language template
        before running programs. JavaScript supports <code>input('Enter a number: ')</code>; the other languages use their standard
        stdin input functions. HTML is available through the Sandboxed Browser Preview, which blocks external resources.
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
    title: 'AI Deep Help fair use',
    body: (
      <p>
        AI is optional, backend-only and never called automatically. It only runs when you click <strong>Ask AI for Deeper Help</strong>
        and confirm. Cached results for the same code version are reused for free; the daily limit and cooldown are enforced by the
        server, and local guidance always remains available.
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
    'Which languages can run interactively?',
    'Python, JavaScript, C, C++, Java, C#, Go, PHP, Ruby, Rust and Kotlin use the configured E2B cloud runner. TypeScript and SQL support local analysis, while HTML uses a sandboxed browser preview.',
  ],
  [
    'What should I keep out of learning code?',
    'Passwords, personal details, tokens, database credentials and API keys. Treat every shared program as something others may read.',
  ],
  [
    'When would AI Deep Help be useful?',
    'When the local explanation is not quite enough. It is optional, uses fair-use limits, and cached explanations for the same code version do not consume a request.',
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
