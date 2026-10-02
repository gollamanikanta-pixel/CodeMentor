import { ChevronRight, CircleHelp, LogIn, LogOut, Moon, Sun } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { IconButton, Pill } from '../components/ui';
import { useAiUsage } from '../hooks/useAiUsage';
import { useTheme } from '../settings/SettingsContext';
import { useAuth } from '../auth/AuthContext';

const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/playground': 'Playground',
  '/workspace': 'Multi-file Workspace',
  '/projects': 'My Projects',
  '/quiz-history': 'Quiz History',
  '/settings': 'Settings',
  '/help': 'Help',
};

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { resolved, toggle } = useTheme();
  const { usage } = useAiUsage();
  const { user, logout } = useAuth();
  const title = TITLES[location.pathname] ?? 'Workspace';

  return (
    <header className="topbar">
      <div className="mobile-logo">
        <Logo />
      </div>
      <div className="breadcrumbs">
        <span>Workspace</span>
        <ChevronRight size={14} aria-hidden="true" />
        <strong>{title}</strong>
      </div>
      <div className="top-actions">
        <Pill tone="green">
          <span className="status-dot" aria-hidden="true" /> Local-first learning
        </Pill>
        <Pill tone="violet" className="ai-pill">
          AI: {usage.configured ? 'ready' : 'local only'}
        </Pill>
        <IconButton label={resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={toggle}>
          {resolved === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </IconButton>
        <Link to="/help" aria-label="Help" className="icon-btn">
          <CircleHelp size={18} />
        </Link>
        {user ? (
          <div className="top-user">
            <span className="avatar small" aria-hidden="true">
              {initials(user.fullName)}
            </span>
            <span className="top-user-name">{user.fullName}</span>
            <IconButton
              label="Log out"
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
            >
              <LogOut size={17} />
            </IconButton>
          </div>
        ) : (
          <Link to={`/login?next=${encodeURIComponent(location.pathname)}`} className="btn btn-soft btn-sm">
            <LogIn size={15} aria-hidden="true" /> Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
