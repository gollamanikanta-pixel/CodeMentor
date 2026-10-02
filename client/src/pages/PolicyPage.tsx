import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Logo } from '../components/Logo';

const CONTENT = {
  privacy: {
    eyebrow: 'PRIVACY',
    title: 'Privacy at CodeMentor AI',
    intro:
      'CodeMentor AI keeps drafts and local learning tools in your browser. When you run a console program, its source is sent to the self-hosted runner you configure.',
    sections: [
      {
        heading: 'What stays on your machine',
        body: 'Your editor draft, local analysis, quiz history and preferences live in your browser storage. Console program source and live input are sent to E2B through the configured interactive runner only when you click Run Code. E2B executes programs in isolated cloud sandboxes with outbound internet access disabled. HTML previews remain in a sandboxed browser iframe.',
      },
      {
        heading: 'What an account stores',
        body: 'If you register, we store your name, email, a password hash, your settings, the multi-file projects you explicitly save, execution records, and quiz history. Passwords are hashed with bcrypt and never stored in plain text.',
      },
      {
        heading: 'Sessions and security',
        body: 'Sessions use an httpOnly cookie. A CSRF token is required for any state-changing request. Secrets such as AI or execution-provider keys live only on the server and are never sent to the browser.',
      },
      {
        heading: 'What we never do',
        body: 'We never sell your data, never log your source in production, and never store passwords or tokens in browser storage.',
      },
    ],
  },
  terms: {
    eyebrow: 'TERMS',
    title: 'Terms of use',
    intro:
      'CodeMentor AI is a learning tool. It guides you to find and fix your own mistakes — it does not write corrected code for you.',
    sections: [
      {
        heading: 'Fair learning use',
        body: 'Use CodeMentor AI to learn. AI Deep Help has no CodeMentor-imposed daily cap or cooldown, but Gemini availability, quotas, and billing apply. Secure remote execution may have service limits.',
      },
      {
        heading: 'Code you submit',
        body: 'Only run code you are entitled to run. Do not submit malware, attempt to escape a sandbox, attack infrastructure, or use the secure runner for anything other than learning programs.',
      },
      {
        heading: 'No guaranteed support',
        body: 'CodeMentor AI runs most supported console and multi-file learning projects in isolated environments. Some projects may be limited by compiler versions, security, runtime, memory, package, network, or platform requirements.',
      },
      {
        heading: 'Accounts',
        body: 'Keep your password private. You are responsible for activity under your account. You can delete your saved projects at any time from My Projects.',
      },
    ],
  },
} as const;

export function PolicyPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const content = CONTENT[kind];
  return (
    <div className="policy-page">
      <div className="policy-nav">
        <Logo to="/" />
        <Link to="/" className="btn btn-soft btn-sm">
          <ArrowLeft size={15} aria-hidden="true" /> Back home
        </Link>
      </div>
      <article className="policy-card card">
        <span className="eyebrow">{content.eyebrow}</span>
        <h1>{content.title}</h1>
        <p className="policy-intro">{content.intro}</p>
        {content.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
          </section>
        ))}
        <p className="policy-footnote">
          <ShieldCheck size={14} aria-hidden="true" /> Built for learners, not shortcuts.
        </p>
      </article>
    </div>
  );
}
