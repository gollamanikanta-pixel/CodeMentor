import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Check,
  Code2,
  GitBranch,
  Lightbulb,
  ListChecks,
  Moon,
  Play,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, IconButton, Pill } from '../components/ui';
import { Logo } from '../components/Logo';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../settings/SettingsContext';
import {
  comingSoonLanguageNames,
  interactiveRunnerLanguages,
  previewLanguages,
} from '../data/languages';

const FEATURES = [
  { icon: Play, tone: 'indigo', title: 'Run supported code', text: 'Run programs in isolated containers and respond to input live.' },
  { icon: Lightbulb, tone: 'amber', title: 'Learn line by line', text: 'Turn confusing errors into calm, actionable learning moments.' },
  { icon: GitBranch, tone: 'cyan', title: 'Visualize your logic', text: 'See the shape of loops, functions and decisions as you learn.' },
  { icon: ListChecks, tone: 'violet', title: 'Practice with quizzes', text: 'Generate thoughtful questions from your own code and concepts.' },
];

export function LandingPage() {
  const { resolved, toggle } = useTheme();
  const { user } = useAuth();
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  // Access model: signed-out visitors are routed to register/login, signed-in
  // learners go straight to their workspace.
  const startHref = user ? '/dashboard' : '/register';
  const playgroundHref = user ? '/playground' : '/login?next=%2Fplayground';

  return (
    <div className="landing">
      <header className="landing-nav">
        <Logo to="/" />
        <nav aria-label="Primary">
          <Link to="/">Home</Link>
          <button onClick={() => scrollTo('features')}>Features</button>
          <button onClick={() => scrollTo('how')}>How it works</button>
        </nav>
        <div className="landing-actions">
          <IconButton label={resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={toggle}>
            {resolved === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </IconButton>
          <Link to={startHref} className="btn btn-primary">
            Start Learning <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <Pill tone="indigo" className="hero-eyebrow">
            <span className="pulse" aria-hidden="true" /> AI-ASSISTED PROGRAMMING LEARNING
          </Pill>
          <h1>
            Understand every bug.
            <br />
            <em>Build real coding confidence.</em>
          </h1>
          <p>
            CodeMentor AI helps students run code, understand errors, visualize logic, and learn through guided practice—not
            shortcuts.
          </p>
          <div className="hero-buttons">
            <Link to={startHref} className="btn btn-primary">
              <Play size={16} aria-hidden="true" /> Start Learning
            </Link>
            <Link to={playgroundHref} className="btn btn-soft">
              Explore the Workspace <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="hero-value-chips" aria-label="Learning principles">
            <span><ShieldCheck size={14} aria-hidden="true" /> Guided, not auto-fixed</span>
            <span><Code2 size={14} aria-hidden="true" /> Local-first learning</span>
            <span><Lightbulb size={14} aria-hidden="true" /> Built for students</span>
          </div>
        </div>
        <HeroVisual />
      </section>

      <section id="features" className="feature-section">
        <div className="section-kicker">BUILT FOR THE WAY YOU LEARN</div>
        <h2>
          Progress feels better when
          <br />
          you can <em>see the why.</em>
        </h2>
        <div className="feature-grid">
          {FEATURES.map(({ icon: Icon, tone, title, text }) => (
            <div className="feature-card" key={title}>
              <div className={`feature-icon ${tone}`}>
                <Icon />
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
              <ArrowRight size={17} className="feature-arrow" aria-hidden="true" />
            </div>
          ))}
        </div>
      </section>

      <section className="language-section">
        <div className="section-kicker">HONEST ABOUT WHAT RUNS</div>
        <h2>Six supported languages. More are coming soon.</h2>
        <div className="language-grid">
          <LanguageCard title="Hosted Interactive Runner" tone="indigo" icon={ShieldCheck} items={interactiveRunnerLanguages} note="Uses E2B cloud sandboxes; source code is sent to that service when you run." />
          <LanguageCard title="Sandboxed Browser Preview" tone="green" icon={Code2} items={previewLanguages} note="Preview HTML safely in your browser. External resources are blocked." />
          <LanguageCard title="Coming soon" tone="amber" icon={AlertCircle} items={comingSoonLanguageNames} note="These languages will become available in a future release." />
        </div>
      </section>

      <section className="local-first">
        <div className="section-kicker">LOCAL-FIRST LEARNING</div>
        <h2>Learn locally. Ask AI only when you need more help.</h2>
        <p>
          CodeMentor AI checks common issues locally first. AI Deep Help is optional and only used when you explicitly ask for deeper
          guidance.
        </p>
        <Link to={playgroundHref} className="btn btn-primary">
          Try the playground <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>

      <section id="how" className="how-section">
        <div className="how-copy">
          <div className="section-kicker">HOW IT WORKS</div>
          <h2>
            Three calm steps
            <br />
            to <em>better code.</em>
          </h2>
          <p>CodeMentor AI keeps you in the driver’s seat. It guides, explains and asks questions — it never writes the fix for you.</p>
        </div>
        <div className="steps">
          {[
            ['01', 'Write or upload code', 'Bring your own practice program into a calm, focused workspace.'],
            ['02', 'Understand errors and logic', 'Get hints, visual explanations and questions — never a shortcut.'],
            ['03', 'Learn, practice and improve', 'Turn every run into momentum with quizzes and saved projects.'],
          ].map(([n, title, text]) => (
            <div className="step" key={n}>
              <span>{n}</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer>
        <Logo to="/" />
        <span>“Understand Code. Visualize Logic. Learn Better.”</span>
        <div>
          <Link to="/dashboard">Workspace</Link>
          <Link to="/login">Log in</Link>
          <Link to="/register">Create account</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </div>
      </footer>
    </div>
  );
}

function LanguageCard({
  title,
  tone,
  icon: Icon,
  items,
  note,
}: {
  title: string;
  tone: 'green' | 'amber' | 'indigo';
  icon: typeof Check;
  items: string[];
  note: string;
}) {
  return (
    <div className="language-card">
      <div className="language-card-head">
        <Pill tone={tone}>
          <Icon size={13} aria-hidden="true" /> {title}
        </Pill>
      </div>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>{note}</p>
    </div>
  );
}

function HeroVisual() {
  return (
    <div className="hero-visual" aria-hidden="true">
      <div className="glow" />
      <div className="mock-editor">
        <div className="mock-top">
          <div className="window-dots">
            <i />
            <i />
            <i />
          </div>
          <span>average.py</span>
          <Pill tone="cyan">Python · Example</Pill>
        </div>
        <div className="mock-body">
          <div className="code-lines">
            <div>
              <b>01</b>
              <span>
                <i>def</i> average(scores):
              </span>
            </div>
            <div>
              <b>02</b>
              <span className="indent">total = sum(scores)</span>
            </div>
            <div className="line-active">
              <b>03</b>
              <span className="indent">return total / len(scores)</span>
              <AlertCircle size={14} />
            </div>
            <div>
              <b>04</b>
            </div>
            <div>
              <b>05</b>
              <span>marks = [82, 91, 76, 88]</span>
            </div>
            <div>
              <b>06</b>
              <span>
                <i>print</i>(<strong>"Class average:"</strong>, average(marks))
              </span>
            </div>
          </div>
          <div className="hint-popover">
            <div className="hint-title">
              <span>
                <Lightbulb size={14} /> Learning hint
              </span>
              <span className="hint-step">1 / 3</span>
            </div>
            <strong>What might happen here?</strong>
            <p>Think about what the denominator represents when the list is empty.</p>
          </div>
        </div>
        <div className="mock-footer">
          <span>
            <span className="status-dot green-dot" /> Local guidance example
          </span>
          <span>Ln 3, Col 20</span>
        </div>
      </div>
      <div className="mini-flow">
        <div className="flow-label">
          <GitBranch size={13} /> Logic flow
        </div>
        <div className="flow-row">
          <span>scores</span>
          <ArrowRight size={13} />
          <span className="flow-accent">sum ÷ count</span>
          <ArrowRight size={13} />
          <span>average</span>
        </div>
      </div>
      <div className="mini-progress-card">
        <BarChart3 size={14} />
        <span>Quiz progress preview</span>
        <div className="progress">
          <i style={{ width: '45%' }} />
        </div>
      </div>
    </div>
  );
}
