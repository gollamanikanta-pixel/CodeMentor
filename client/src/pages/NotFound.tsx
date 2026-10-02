import { Link } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';
import { Button, EmptyState } from '../components/ui';

export default function NotFound() {
  return (
    <div className="content-page">
      <div className="card">
        <EmptyState
          icon={Compass}
          title="That learning page is not available."
          action={
            <Link to="/" className="btn btn-primary">
              <Home size={16} aria-hidden="true" /> Back to CodeMentor AI home
            </Link>
          }
        >
          The page you tried to open does not exist. Return to the workspace and keep learning locally.
        </EmptyState>
      </div>
    </div>
  );
}
