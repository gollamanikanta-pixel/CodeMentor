import { NavLink } from 'react-router-dom';
import {
  CircleHelp,
  Code2,
  FolderTree,
  FolderOpen,
  Gauge,
  ListChecks,
  Menu,
  Settings as SettingsIcon,
  Sparkles,
} from 'lucide-react';
import { Logo } from '../components/Logo';
import { IconButton } from '../components/ui';
import { useAuth } from '../auth/AuthContext';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: Gauge },
  { to: '/playground', label: 'Playground', icon: Code2 },
  { to: '/workspace', label: 'Multi-file Workspace', icon: FolderOpen },
  { to: '/projects', label: 'My Projects', icon: FolderTree },
  { to: '/quiz-history', label: 'Quiz History', icon: ListChecks },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
  { to: '/help', label: 'Help', icon: CircleHelp },
] as const;

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { user } = useAuth();
  const displayName = user?.fullName?.trim() || 'Learner';
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`} aria-label="Workspace navigation">
      <div className="side-top">
        <Logo compact={collapsed} to="/" />
        <IconButton label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={onToggle}>
          <Menu size={19} />
        </IconButton>
      </div>
      <div className="workspace-label">WORKSPACE</div>
      <nav>
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            title={label}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={18} aria-hidden="true" />
            {!collapsed && <span>{label}</span>}
            {!collapsed && <span className="nav-dot" aria-hidden="true" />}
          </NavLink>
        ))}
      </nav>
      {!collapsed && (
        <>
          <div className="side-card">
            <div className="side-card-icon">
              <Sparkles size={17} aria-hidden="true" />
            </div>
            <strong>Every bug is a step</strong>
            <p>toward better code.</p>
            <span>Start locally. Learn deeply.</span>
          </div>
          <div className="side-bottom">
            <div className="avatar" aria-hidden="true">
              {initials}
            </div>
            <div>
              <strong>{displayName}</strong>
              <span>CodeMentor AI learner</span>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
