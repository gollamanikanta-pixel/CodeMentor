import { EmptyState } from '../components/ui';
import { FolderOpen } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { MultiFileWorkspace } from '../features/workspace/MultiFileWorkspace';

/**
 * Account-only page hosting the multi-file workspace. Guarded by
 * `ProtectedRoute`, so a signed-in user is always present here.
 */
export function WorkspacePage() {
  const { user } = useAuth();
  if (!user) {
    return (
      <div className="content-page">
        <EmptyState icon={FolderOpen} title="Sign in to open the multi-file workspace">
          The Playground, local analysis and quizzes all work without an account.
        </EmptyState>
      </div>
    );
  }
  return <MultiFileWorkspace user={user} />;
}
