import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useMediaQuery } from '../hooks/useMediaQuery';

/**
 * Persistent workspace shell: collapsible sidebar, top bar and routed content.
 * On small screens the sidebar starts collapsed so the editor keeps its space.
 */
export function AppLayout() {
  const isMobile = useMediaQuery('(max-width: 760px)');
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(isMobile);
  }, [isMobile]);

  return (
    <div className="app-shell">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      <main className="main-shell">
        <Topbar />
        <Outlet />
      </main>
    </div>
  );
}
