import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Maximize2, Minus, Send, ShieldCheck, Sparkles } from 'lucide-react';
import type { ExecutionResult, LanguageName, LocalAnalysis } from '../types';
import { Button } from './ui';
import { requestAiChat, type AiChatMessage } from '../api/client';
import { useAiUsage } from '../hooks/useAiUsage';
import { useAuth } from '../auth/AuthContext';

type ChatMessage = AiChatMessage & { id: number };
type Offset = { x: number; y: number };
type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  baseLeft: number;
  baseTop: number;
  width: number;
  height: number;
};

const MAX_CHAT_SOURCE_CHARS = 12000;

const INTRO_MESSAGE =
  'Hi! I’m your AI tutor. Ask about your code, an error, or a programming idea. I’ll offer hints and suggestions to help you work things out.';

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}

export function AiChatWidget({
  code,
  language,
  execution,
  analysis,
  hintLevel,
  explanationLevel,
  enabled,
}: {
  code: string;
  language: LanguageName;
  execution: ExecutionResult | null;
  analysis: LocalAnalysis | null;
  hintLevel: string;
  explanationLevel: string;
  enabled: boolean;
}) {
  const { user } = useAuth();
  const { usage } = useAiUsage();
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: 0, role: 'assistant', content: INTRO_MESSAGE }]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [minimized, setMinimized] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const conversationRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const widgetRef = useRef<HTMLElement | null>(null);
  const offsetRef = useRef<Offset>({ x: 0, y: 0 });
  const dragRef = useRef<DragState | null>(null);
  const nextId = useRef(1);
  const contextVersion = useRef(0);

  useEffect(() => {
    contextVersion.current += 1;
    setLoading(false);
    setMessages([{ id: 0, role: 'assistant', content: INTRO_MESSAGE }]);
    setDraft('');
    setError('');
    nextId.current = 1;
  }, [code, language]);

  useEffect(() => {
    conversationRef.current?.scrollTo({ top: conversationRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const setChatOffset = (next: Offset) => {
    offsetRef.current = next;
    setOffset(next);
  };

  const onDragStart = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const bounds = widgetRef.current?.getBoundingClientRect();
    if (!bounds) return;

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offsetRef.current.x,
      originY: offsetRef.current.y,
      baseLeft: bounds.left - offsetRef.current.x,
      baseTop: bounds.top - offsetRef.current.y,
      width: bounds.width,
      height: bounds.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const onDragMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const margin = 12;
    setChatOffset({
      x: clamp(
        drag.originX + event.clientX - drag.startX,
        margin - drag.baseLeft,
        window.innerWidth - margin - drag.width - drag.baseLeft,
      ),
      y: clamp(
        drag.originY + event.clientY - drag.startY,
        margin - drag.baseTop,
        window.innerHeight - margin - drag.height - drag.baseTop,
      ),
    });
  };

  const onDragEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onDragKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, Offset> = {
      ArrowLeft: { x: -24, y: 0 },
      ArrowRight: { x: 24, y: 0 },
      ArrowUp: { x: 0, y: -24 },
      ArrowDown: { x: 0, y: 24 },
    };
    const move = moves[event.key];
    const bounds = widgetRef.current?.getBoundingClientRect();
    if (!move || !bounds) return;
    event.preventDefault();

    const current = offsetRef.current;
    const baseLeft = bounds.left - current.x;
    const baseTop = bounds.top - current.y;
    const margin = 12;
    setChatOffset({
      x: clamp(
        current.x + move.x,
        margin - baseLeft,
        window.innerWidth - margin - bounds.width - baseLeft,
      ),
      y: clamp(
        current.y + move.y,
        margin - baseTop,
        window.innerHeight - margin - bounds.height - baseTop,
      ),
    });
  };

  const canChat = Boolean(user && enabled && usage.configured);
  const suggestions =
    execution && execution.status !== 'success'
      ? ['Help me understand this error', 'What should I check first?', 'Give me one hint']
      : analysis?.errors.length
        ? ['Explain this code', 'Help me understand this issue', 'Suggest a test case']
        : ['Explain this code', 'Give me a hint', 'Suggest a test case'];

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = draft.trim();
    if (!question || loading || !canChat) return;

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
        source: code.slice(0, MAX_CHAT_SOURCE_CHARS),
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
    <aside
      ref={widgetRef}
      className={`ai-chat-widget${minimized ? ' minimized' : ''}${dragging ? ' dragging' : ''}`}
      style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }}
      aria-label="CodeMentor AI tutor"
    >
      <div className="ai-chat-widget-head">
        <div
          className="ai-chat-drag-handle"
          role="group"
          tabIndex={0}
          aria-label="Move AI chat. Use the arrow keys to reposition."
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          onKeyDown={onDragKeyDown}
        >
          <span className="ai-chat-avatar"><Bot size={20} aria-hidden="true" /></span>
          <span className="ai-chat-brand">
            <strong>AI Tutor</strong>
            <small>Here to help you learn</small>
          </span>
          <span className="ai-chat-sparkle"><Sparkles size={16} aria-hidden="true" /></span>
        </div>
        <button
          type="button"
          className="ai-chat-minimize"
          aria-label={minimized ? 'Expand AI chat' : 'Minimize AI chat'}
          onClick={() => setMinimized((current) => !current)}
        >
          {minimized ? <Maximize2 size={17} /> : <Minus size={18} />}
        </button>
      </div>

      {!minimized ? (
        <div className="ai-chat-panel">
          {!user ? (
            <div className="ai-status warning">
              <strong>Sign in to chat with your AI tutor.</strong>
              <p>Your local code analysis and suggestions work without an account.</p>
              <div className="auth-links">
                <Link to={`/login?next=${encodeURIComponent('/playground')}`}>Sign in or create an account</Link>
              </div>
            </div>
          ) : !enabled ? (
            <div className="ai-status warning">
              <strong>AI chat is turned off in your settings.</strong>
              <p>Turn on AI Deep Help in settings to send chat messages.</p>
              <div className="auth-links"><Link to="/settings">Open settings</Link></div>
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

          {messages.length === 1 ? (
            <div className="ai-chat-suggestions" aria-label="Suggested questions">
              <span>Try asking</span>
              <div>
                {suggestions.map((suggestion) => (
                  <button
                    type="button"
                    key={suggestion}
                    onClick={() => {
                      setDraft(suggestion);
                      composerRef.current?.focus();
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {error ? <p className="ai-error" role="alert">{error}</p> : null}
          <p className="ai-chat-privacy">
            <ShieldCheck size={14} aria-hidden="true" />
            Code and chat are sent to the AI provider only when you send a message. {explanationLevel} explanations · {hintLevel} hints.
            {code.length > MAX_CHAT_SOURCE_CHARS ? ` Only the first ${MAX_CHAT_SOURCE_CHARS.toLocaleString()} code characters are included.` : ''}
          </p>
          <form className="ai-chat-composer" onSubmit={sendMessage}>
            <textarea
              ref={composerRef}
              aria-label="Message the AI tutor"
              placeholder={`Ask about your ${language} code…`}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onComposerKeyDown}
              maxLength={4000}
              rows={2}
              disabled={!canChat || loading}
            />
            <Button
              type="submit"
              variant="ai"
              icon={Send}
              disabled={!draft.trim() || !canChat || loading}
              aria-label="Send message"
            >
              Send
            </Button>
          </form>
        </div>
      ) : null}
    </aside>
  );
}
