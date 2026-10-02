import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Lightbulb, ShieldCheck, Sparkles } from 'lucide-react';
import type { DeepAnalysis, ExecutionResult, LanguageName, LocalAnalysis } from '../types';
import { Button, Modal, Pill } from './ui';
import { requestDeepHelp } from '../api/client';
import { useToast } from '../hooks/useToast';
import { useAiUsage } from '../hooks/useAiUsage';
import { useAuth } from '../auth/AuthContext';

type Result = DeepAnalysis & { cached?: boolean; remaining?: number };

export function AiHelpDialog({
  open,
  onClose,
  code,
  language,
  execution,
  analysis,
  hintLevel,
  explanationLevel,
  onResult,
}: {
  open: boolean;
  onClose: () => void;
  code: string;
  language: LanguageName;
  execution: ExecutionResult | null;
  analysis: LocalAnalysis | null;
  hintLevel: string;
  explanationLevel: string;
  onResult: (result: Result) => void;
}) {
  const { notify } = useToast();
  const { user } = useAuth();
  const { usage, refresh } = useAiUsage();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');

  const runDeepHelp = async () => {
    setLoading(true);
    setError('');
    try {
      const { ok, data } = await requestDeepHelp({
        source: code,
        language,
        execution,
        localAnalysis: analysis,
        explanationLevel,
        hintLevel,
      });
      if (!ok) {
        setError(data.message || 'AI Deep Help is unavailable right now. Local guidance remains available.');
      } else {
        setResult(data);
        onResult(data);
        notify(
          data.cached
            ? 'A saved AI explanation is available for this code version. Using it will not consume another AI request.'
            : 'AI Deep Help is ready.',
          'info',
        );
      }
    } catch {
      setError('AI Deep Help could not be reached. Local guidance remains available.');
    } finally {
      setLoading(false);
      void refresh();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="ai-help-title"
      title={
        <span className="ai-title">
          <Bot size={18} /> AI Deep Help
        </span>
      }
      footer={
        result ? (
          <Button onClick={onClose}>Close</Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>
              Keep learning locally
            </Button>
            <Button variant="ai" icon={Sparkles} disabled={loading || !usage.configured || !user} onClick={runDeepHelp}>
              {loading ? 'Asking for deeper guidance…' : 'Use one AI Deep Help request'}
            </Button>
          </>
        )
      }
    >
      <div className="ai-body">
        <p className="ai-local-note">
          <ShieldCheck size={15} /> Use Local Guidance First.
        </p>

        {!user ? (
          <div className="ai-status warning">
            <strong>Sign in to use AI Deep Help.</strong>
            <p>
              AI Deep Help is account-gated so fair use stays fair. Everything local — analysis, hints, visuals and quizzes — works
              right now without an account.
            </p>
            <div className="auth-links">
              <Link to={`/login?next=${encodeURIComponent('/playground')}`}>Sign in or create an account</Link>
            </div>
          </div>
        ) : !usage.configured ? (
          <div className="ai-status warning">
            <strong>AI Deep Help is not configured on this server.</strong>
            <p>
              Everything local — analysis, hints, visuals and quizzes — is fully available. A teacher or administrator can enable AI
              Deep Help later by configuring the backend only.
            </p>
          </div>
        ) : (
          <div className="ai-status">
            <span>
              <strong>AI Deep Help remaining today: {usage.remaining}</strong> of {usage.limit}
            </span>
            <span className="muted">Fair use · cooldown {usage.cooldownSeconds}s · cached results never consume a request.</span>
          </div>
        )}

        {!result ? (
          <>
            <p>
              Use one AI Deep Help request for deeper guidance on this version of your code? Your local analysis is already ready;
              AI adds a deeper, teacher-style explanation only when you ask.
            </p>
            <ul className="ai-rules">
              <li>Explains what happened, why, and the concept to review.</li>
              <li>Gives progressive hints, self-check questions and debugging steps.</li>
              <li>Never writes corrected code, patches, diffs or exact fixes.</li>
            </ul>
          </>
        ) : (
          <div className="ai-result">
            {result.cached ? <Pill tone="green">Saved explanation reused — no request used</Pill> : <Pill tone="violet">Fresh AI explanation</Pill>}
            <h3>Deeper explanation</h3>
            <p>{result.summary}</p>
            {result.deeperExplanation ? <p>{result.deeperExplanation}</p> : null}
            {result.concepts?.length ? (
              <div className="concept-list">
                <strong>Concepts to review</strong>
                {result.concepts.map((concept) => (
                  <span key={concept}>
                    <Lightbulb size={14} /> {concept}
                  </span>
                ))}
              </div>
            ) : null}
            {result.debuggingSteps?.length ? (
              <div className="debug-steps">
                <strong>Suggested debugging steps</strong>
                {result.debuggingSteps.map((step, index) => (
                  <span key={step}>
                    <i>{index + 1}</i> {step}
                  </span>
                ))}
              </div>
            ) : null}
            {result.tips?.length ? (
              <ul className="tips-list">
                {result.tips.map((tip) => (
                  <li key={tip}>
                    <Lightbulb size={15} /> {tip}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}

        {error ? <p className="ai-error">{error}</p> : null}
      </div>
    </Modal>
  );
}
