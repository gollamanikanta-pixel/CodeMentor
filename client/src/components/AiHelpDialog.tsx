import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Send, ShieldCheck } from 'lucide-react';
import type { ExecutionResult, LanguageName, LocalAnalysis } from '../types';
import { Button, Modal } from './ui';
import { requestAiChat, type AiChatMessage } from '../api/client';
import { useAiUsage } from '../hooks/useAiUsage';
import { useAuth } from '../auth/AuthContext';

type ChatMessage = AiChatMessage & { id: number };

const INTRO_MESSAGE =
  'Hi! Ask me about your current code, a concept, or an error. I’ll guide you with explanations and hints so you can work out the solution.';

export function AiHelpDialog({
  open,
  onClose,
  code,
  language,
  execution,
  analysis,
  hintLevel,
  explanationLevel,
}: {
  open: boolean;
  onClose: () => void;
  code: string;
  language: LanguageName;
  execution: ExecutionResult | null;
  analysis: LocalAnalysis | null;
  hintLevel: string;
  explanationLevel: string;
}) {
  const { user } = useAuth();
  const { usage } = useAiUsage();
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: 0, role: 'assistant', content: INTRO_MESSAGE }]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const conversationRef = useRef<HTMLDivElement | null>(null);
  const nextId = useRef(1);
  const contextVersion = useRef(0);

  useEffect(() => {
    contextVersion.current += 1;
    setLoading(false);
    if (!open) return;
    setMessages([{ id: 0, role: 'assistant', content: INTRO_MESSAGE }]);
    setDraft('');
    setError('');
    nextId.current = 1;
  }, [open, code, language]);

  useEffect(() => {
    conversationRef.current?.scrollTo({ top: conversationRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = draft.trim();
    if (!question || loading || !user || !usage.configured) return;

    const userMessage: ChatMessage = { id: nextId.current++, role: 'user', content: question };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDraft('');
    setError('');
    setLoading(true);
    const requestContextVersion = contextVersion.current;

    try {
      const conversation = nextMessages
        .filter((message) => message.id !== 0)
        .slice(-10)
        .map(({ role, content }) => ({ role, content }));
      if (conversation[0]?.role === 'assistant') conversation.shift();
      const { ok, data } = await requestAiChat({
        source: code,
        language,
        messages: conversation,
        execution,
        localAnalysis: analysis,
        explanationLevel,
        hintLevel,
      });
      if (requestContextVersion !== contextVersion.current) return;
      if (!ok) {
        setMessages((current) => current.filter((message) => message.id !== userMessage.id));
        setDraft(question);
        setError(data.message || 'AI chat is unavailable right now. Local guidance remains available.');
        return;
      }
      setMessages((current) => [
        ...current,
        { id: nextId.current++, role: 'assistant', content: data.reply },
      ]);
    } catch {
      if (requestContextVersion !== contextVersion.current) return;
      setMessages((current) => current.filter((message) => message.id !== userMessage.id));
      setDraft(question);
      setError('AI chat could not be reached. Local guidance remains available.');
    } finally {
      if (requestContextVersion === contextVersion.current) setLoading(false);
    }
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="ai-help-title"
      className="ai-chat-modal"
      title={
        <span className="ai-title">
          <Bot size={18} /> CodeMentor AI Chat
        </span>
      }
    >
      <div className="ai-chat">
        <p className="ai-local-note">
          <ShieldCheck size={15} /> Use Local Guidance First.
        </p>

        {!user ? (
          <div className="ai-status warning">
            <strong>Sign in to use AI chat.</strong>
            <p>Local analysis, hints, visuals, and quizzes continue to work without an account.</p>
            <div className="auth-links">
              <Link to={`/login?next=${encodeURIComponent('/playground')}`}>Sign in or create an account</Link>
            </div>
          </div>
        ) : !usage.configured ? (
          <div className="ai-status warning">
            <strong>AI chat is not configured on this server.</strong>
            <p>A deployment administrator can configure the AI provider on the backend. Never enter provider credentials in the browser.</p>
          </div>
        ) : null}

        <div className="ai-chat-transcript" ref={conversationRef} role="log" aria-label="AI chat messages" aria-live="polite">
          {messages.map((message) => (
            <div className={`ai-chat-message ${message.role}`} key={message.id}>
              {message.role === 'assistant' ? <Bot size={15} aria-hidden="true" /> : null}
              <p>{message.content}</p>
            </div>
          ))}
          {loading ? (
            <div className="ai-chat-message assistant" role="status">
              <Bot size={15} aria-hidden="true" />
              <p>Thinking…</p>
            </div>
          ) : null}
        </div>

        {error ? <p className="ai-error" role="alert">{error}</p> : null}
        <p className="ai-chat-privacy">
          <ShieldCheck size={14} aria-hidden="true" />
          Your code, latest run details, and chat are sent to the configured AI provider only when you send a message. {explanationLevel} explanations · {hintLevel} hints.
        </p>
        <form className="ai-chat-composer" onSubmit={sendMessage}>
          <textarea
            aria-label="Message the AI tutor"
            placeholder={`Ask a question about your ${language} code…`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onComposerKeyDown}
            maxLength={4000}
            rows={2}
            disabled={!user || !usage.configured || loading}
          />
          <Button
            type="submit"
            variant="ai"
            icon={Send}
            disabled={!draft.trim() || !user || !usage.configured || loading}
            aria-label="Send message"
          >
            Send
          </Button>
        </form>
      </div>
    </Modal>
  );
}
