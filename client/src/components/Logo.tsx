import { Link } from 'react-router-dom';

export function Logo({ compact = false, to = '/' }: { compact?: boolean; to?: string }) {
  const content = (
    <>
      <span className="logo-mark" aria-hidden="true">
        <svg viewBox="0 0 40 40" role="presentation">
          <path d="m15 12-8 8 8 8M25 12l8 8-8 8" />
          <path className="logo-mark-slash" d="m23 10-6 20" />
          <path className="logo-mark-spark" d="m31 6 .9 2.4 2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9z" />
        </svg>
      </span>
      {!compact && (
        <span className="logo-word">
          Code<span>Mentor</span>
          <b>AI</b>
        </span>
      )}
    </>
  );

  return (
    <Link to={to} className={`logo${compact ? ' logo-compact' : ''}`} aria-label="CodeMentor AI home">
      {content}
    </Link>
  );
}
