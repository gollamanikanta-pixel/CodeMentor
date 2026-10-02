import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, ListChecks, Search, Target, BookOpen } from 'lucide-react';
import { Button, EmptyState, Pill, StatCard } from '../components/ui';
import { useQuizHistory } from '../hooks/useQuizHistory';

export function QuizHistoryPage() {
  const navigate = useNavigate();
  const { records: history, synced, loading, error, reload } = useQuizHistory();
  const [query, setQuery] = useState('');

  const visible = useMemo(
    () => history.filter((item) => !query || item.project.toLowerCase().includes(query.toLowerCase())),
    [history, query],
  );

  const average = history.length
    ? Math.round(history.reduce((total, item) => total + Number(item.score) / Math.max(1, item.total) * 100, 0) / history.length)
    : 0;
  const reviewCount = history.reduce((total, item) => total + (item.conceptsToReview?.length ?? 0), 0);

  return (
    <div className="content-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">PRACTICE LOG</span>
          <h1>Quiz History</h1>
          <p>Review your practice and revisit concepts that need more attention.</p>
        </div>
        <Button icon={ListChecks} onClick={() => navigate('/playground')}>
          New quiz
        </Button>
      </div>

      <div className="stats-grid">
        <StatCard icon={ListChecks} label="Quizzes completed" value={String(history.length)} note={synced ? 'Synced to your account' : error ? 'Account history unavailable' : 'Saved locally'} tone="indigo" />
        <StatCard icon={BarChart3} label="Average score" value={`${average}%`} note="Across your practice" tone="green" />
        <StatCard icon={Target} label="Concepts to review" value={String(reviewCount)} note="Keep going — you’re close" tone="amber" />
      </div>

      <div className="filter-bar">
        <div className="search-input">
          <Search size={16} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search quiz history" aria-label="Search quiz history" />
        </div>
      </div>

      <div className="history-card card">
        <div className="card-heading">
          <div>
            <h2>Recent practice</h2>
            <p>{synced ? 'Your latest account quiz sessions' : error ? 'Account history is unavailable' : 'Your latest local quiz sessions'}</p>
          </div>
        </div>
        {loading ? (
          <p role="status">Loading quiz history…</p>
        ) : error ? (
          <div role="alert" className="ai-error">
            <p>{error}</p>
            <button onClick={() => void reload()}>Try again</button>
          </div>
        ) : visible.length ? (
          <div className="history-list">
            {visible.map((item) => (
              <div className="history-row" key={item.id}>
                <div className="history-icon">
                  <ListChecks size={17} aria-hidden="true" />
                </div>
                <div className="history-name">
                  <strong>{item.project}</strong>
                  <span>
                    {item.language} · {item.difficulty}
                  </span>
                </div>
                <strong className="score">{item.percentage}</strong>
                <span className="date">{new Date(item.date).toLocaleDateString()}</span>
                {item.conceptsToReview?.length ? (
                  <Pill tone="amber">
                    <BookOpen size={12} aria-hidden="true" /> {item.conceptsToReview.length} to review
                  </Pill>
                ) : (
                  <Pill tone="green">All clear</Pill>
                )}
                <button onClick={() => navigate('/playground')}>
                  Review <ArrowRight size={13} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={ListChecks} title="No quiz history yet">
            Generate a local quiz from your own analyzed code to start tracking practice. Signed-in quiz results are saved to your account.
          </EmptyState>
        )}
      </div>
    </div>
  );
}
