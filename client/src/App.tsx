import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { PlaygroundPage } from './pages/PlaygroundPage';
import { WorkspacePage } from './pages/WorkspacePage';
import { ProjectsPage } from './pages/ProjectsPage';
import { QuizHistoryPage } from './pages/QuizHistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { HelpPage } from './pages/HelpPage';
import { AuthPage } from './pages/AuthPage';
import { PolicyPage } from './pages/PolicyPage';
import NotFound from './pages/NotFound';

/**
 * Route table.
 *
 * Public routes render outside the workspace shell. Every learning route is
 * nested under `ProtectedRoute`, which redirects unauthenticated visitors to
 * `/login?next=<path>` before the shell ever mounts.
 */
export function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
      <Route path="/reset-password" element={<AuthPage mode="reset" />} />
      <Route path="/privacy" element={<PolicyPage kind="privacy" />} />
      <Route path="/terms" element={<PolicyPage kind="terms" />} />
      <Route path="/404" element={<NotFound />} />

      {/* Authenticated workspace */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/playground" element={<PlaygroundPage />} />
          <Route path="/workspace" element={<WorkspacePage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/quiz-history" element={<QuizHistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/help" element={<HelpPage />} />
        </Route>
      </Route>

      {/* Anything else — including unknown paths for signed-out visitors. */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default AppRoutes;
