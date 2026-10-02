import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Code2, FileCode2, Lightbulb, ListChecks, Plus, Play, Sparkles } from 'lucide-react';
import { Button, EmptyState, Pill, StatCard } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { listProjects } from '../projects/projectStore';
import { listProjects as listAccountProjects, type ProjectRecord } from '../api/client';
import { useQuizHistory } from '../hooks/useQuizHistory';

type DashboardProject = { id: string; title: string; language: string };

const QUICK_STARTS = [
  { language: 'C', note: 'Systems and algorithms' },
  { language: 'C++', note: 'STL and OOP practice' },
  { language: 'Java', note: 'Classes and collections' },
  { language: 'Python', note: 'Runs in your browser' },
  { language: 'JavaScript', note: 'Runs in your browser' },
  { language: 'HTML', note: 'Sandboxed page preview' },
] as const;

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [projectError, setProjectError] = useState('');
  const { records: history, error: historyError } = useQuizHistory();

  useEffect(() => {
    if (!user) {
      setProjects(listProjects().map(({ id, title, language }) => ({ id, title, language })));
      setProjectError('');
      return;
    }
    let cancelled = false;
    setProjects([]);
    setProjectError('');
    void listAccountProjects()
      .then((records: ProjectRecord[]) => {
        if (!cancelled) setProjects(records.map(({ id, title, primaryLanguage }) => ({ id, title, language: primaryLanguage })));
      })
      .catch(() => {
        if (!cancelled) setProjectError('Your account projects could not be loaded. No local projects are shown here.');
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const firstName = user?.fullName?.split(' ')[0] || 'learner';
  const average = history.length
    ? Math.round(history.reduce((sum, item) => sum + (Number.parseInt(item.percentage, 10) || 0), 0) / history.length)
    : 0;
  const conceptsToReview = useMemo(
    () => [...new Set(history.flatMap((item) => item.conceptsToReview ?? []))].slice(0, 6),
    [history],
  );

  return (
    <div className="content-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR LEARNING SPACE</span>
          <h1>Welcome back, {firstName}.</h1>
          <p>Your next breakthrough may be one bug away.</p>
        </div>
        <div className="heading-actions">
          <Button icon={Play} onClick={() => navigate('/playground')}>
            Open Playground
          </Button>
          <Button variant="soft" icon={Plus} onClick={() => navigate('/projects')}>
            Create New Project
          </Button>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard icon={Code2} label="Projects" value={String(projects.length)} note={user ? 'Saved to your account' : 'Saved in this browser'} tone="indigo" />
        <StatCard icon={ListChecks} label="Quizzes completed" value={String(history.length)} note={historyError ? 'Account history unavailable' : 'Practice builds confidence'} tone="green" />
        <StatCard icon={BarChart3} label="Average score" value={`${average}%`} note={historyError ? 'Account history unavailable' : history.length ? 'Across your quizzes' : 'Start your first quiz'} tone="amber" />
      </div>

      <section className="dashboard-section">
        <div className="card-heading">
          <div>
            <h2>Quick language starts</h2>
            <p>Pick a language and jump straight into the Playground.</p>
          </div>
        </div>
        <div className="quick-start-grid">
          {QUICK_STARTS.map(({ language, note }) => (
            <button key={language} className="quick-start card" onClick={() => navigate('/playground')}>
              <span className="file-badge blue">
                <FileCode2 size={18} aria-hidden="true" />
              </span>
              <strong>{language}</strong>
              <small>{note}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="card">
          <div className="card-heading">
            <div>
              <h2>Recent projects</h2>
              <p>Return to a saved program anytime.</p>
            </div>
          </div>
          {projectError ? <p role="alert" className="ai-error">{projectError}</p> : null}
          {historyError ? <p role="alert" className="ai-error">{historyError}</p> : null}
          {projectError ? null : projects.length ? (
            <ul className="dashboard-list">
              {projects.slice(0, 5).map((project) => (
                <li key={project.id}>
                  <button onClick={() => navigate('/projects')}>
                    <FileCode2 size={16} aria-hidden="true" />
                    <span>{project.title}</span>
                    <Pill tone="neutral">{project.language}</Pill>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Code2} title="No saved projects yet">
              Save a program from the Playground and it will appear here {user ? 'after account sync' : 'from this browser'}.
            </EmptyState>
          )}
        </div>

        <div className="card">
          <div className="card-heading">
            <div>
              <h2>Concepts to review</h2>
              <p>From your recent practice.</p>
            </div>
          </div>
          {conceptsToReview.length ? (
            <div className="concept-list">
              {conceptsToReview.map((concept) => (
                <span key={concept}>
                  <Lightbulb size={14} aria-hidden="true" /> {concept}
                </span>
              ))}
            </div>
          ) : (
            <EmptyState icon={Lightbulb} title="Nothing to review yet">
              Generate a local quiz from your own code to start tracking concepts.
            </EmptyState>
          )}
        </div>
      </section>

      <div className="side-card dashboard-encouragement">
        <div className="side-card-icon">
          <Sparkles size={17} aria-hidden="true" />
        </div>
        <strong>Every bug is a step toward better code.</strong>
        <p>Start locally. Learn deeply.</p>
        <span>Built for learners, not shortcuts.</span>
      </div>
    </div>
  );
}
