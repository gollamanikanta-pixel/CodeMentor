import { useEffect, useRef, useState } from 'react';
import { Maximize2, Play, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { Button, Pill } from '../../components/ui';
import {
  buildSandboxDocument,
  injectIntoHead,
  PREVIEW_BLOCKED_MESSAGE,
  PREVIEW_IFRAME_SANDBOX,
} from '../../web/sandboxPreview';

/**
 * Renders the single-file HTML project in a sandboxed iframe.
 *
 * The learner's markup is never inserted into the parent DOM. The iframe runs
 * with `sandbox="allow-scripts"` only, external resources are stripped, and the
 * preview's console is streamed back as text.
 */
export function HtmlPreviewPanel({ code }: { code: string }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [runId, setRunId] = useState('');
  const [status, setStatus] = useState('Ready to preview');
  const [consoleLines, setConsoleLines] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [fullscreen, setFullscreen] = useState(false);

  const build = (refreshing = false) => {
    const id = crypto.randomUUID();
    setError('');
    setConsoleLines([]);
    setRunId(id);
    setStatus(refreshing ? 'Preview refreshed' : 'Rendering preview');
  };

  useEffect(() => {
    if (!runId || !iframeRef.current) return;

    let source: string;
    try {
      source = buildSandboxDocument([{ relativePath: 'index.html', content: code }], 'index.html');
    } catch (buildError) {
      setError(buildError instanceof Error ? buildError.message : 'Preview could not be built.');
      setStatus('Preview error');
      return;
    }

    // The bridge forwards console output and errors, and announces readiness.
    const bridge = `<script>(()=>{const id=${JSON.stringify(runId)};for(const level of ['log','info','warn','error']){const old=console[level];console[level]=(...v)=>{parent.postMessage({source:'codementor-preview',runId:id,type:'console',level,text:v.map(String).join(' ')},'*');old(...v)}}window.addEventListener('error',e=>parent.postMessage({source:'codementor-preview',runId:id,type:'error',text:String(e.message)},'*'));window.addEventListener('unhandledrejection',e=>parent.postMessage({source:'codementor-preview',runId:id,type:'error',text:String(e.reason)},'*'));parent.postMessage({source:'codementor-preview',runId:id,type:'ready'},'*')})()</script>`;

    // injectIntoHead falls back gracefully for pages written without a <head>.
    iframeRef.current.srcdoc = injectIntoHead(source, bridge);

    const receive = (event: MessageEvent) => {
      // Accept only messages from THIS iframe window with the current run id.
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.source !== 'codementor-preview' || event.data?.runId !== runId) return;
      if (event.data.type === 'ready') setStatus('Preview ready');
      if (event.data.type === 'console') {
        setConsoleLines((lines) => [...lines, `[${event.data.level}] ${event.data.text}`]);
      }
      if (event.data.type === 'error') {
        setConsoleLines((lines) => [...lines, `[error] ${event.data.text}`]);
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [runId, code]);

  return (
    <section className="preview-panel card" aria-label="Sandboxed Browser Preview">
      <div className="preview-head">
        <div>
          <Pill tone="cyan">
            <ShieldCheck size={13} aria-hidden="true" /> Sandboxed Browser Preview
          </Pill>
          <p className="preview-note">{PREVIEW_BLOCKED_MESSAGE}</p>
        </div>
        <div className="preview-actions">
          <Button icon={Play} onClick={() => build(false)}>
            Run Preview
          </Button>
          <Button variant="outline" icon={RefreshCw} onClick={() => build(true)} disabled={!runId}>
            Refresh
          </Button>
          <Button
            variant="ghost"
            icon={Maximize2}
            onClick={() => setFullscreen((value) => !value)}
            aria-expanded={fullscreen}
            title={fullscreen ? 'Exit fullscreen preview' : 'Open Preview Fullscreen'}
          >
            {fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </Button>
          <Button variant="ghost" icon={Trash2} onClick={() => setConsoleLines([])}>
            Clear Console
          </Button>
        </div>
      </div>

      <div className={fullscreen ? 'preview-split preview-fullscreen' : 'preview-split'}>
        <div className="preview-stage">
          {runId ? (
            <iframe ref={iframeRef} title="Sandboxed Browser Preview" sandbox={PREVIEW_IFRAME_SANDBOX} className="preview-frame" />
          ) : (
            <div className="preview-placeholder">
              <p>Choose <strong>Run Preview</strong> to render this page in an isolated frame.</p>
            </div>
          )}
        </div>
        <div className="preview-console">
          <div className="console-console-actions">
            <strong>Preview console</strong>
            <span role="status" aria-live="polite">
              {status}
            </span>
          </div>
          {error ? <pre className="preview-error">{error}</pre> : null}
          {consoleLines.length ? (
            consoleLines.map((line, index) => <pre key={index}>{line}</pre>)
          ) : (
            <p>Console messages from your page appear here.</p>
          )}
        </div>
      </div>
    </section>
  );
}
