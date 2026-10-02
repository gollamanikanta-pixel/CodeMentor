import { useEffect, useState } from 'react';
import { AlertCircle, Check, Copy, Maximize2, Minimize2, Send, Square, Terminal, Trash2 } from 'lucide-react';
import type { ExecutionResult, LanguageName } from '../../types';
import { IconButton } from '../../components/ui';
import { useToast } from '../../hooks/useToast';
import { formatExecutionTranscript } from './executionTranscript';

const BASE_TABS = ['Output', 'Errors', 'Compile Output', 'Execution Details'] as const;
type ConsoleTab = (typeof BASE_TABS)[number];

export function ConsolePanel({
  id,
  execution,
  language,
  running,
  runtimeMessage,
  terminalOutput = '',
  terminalCompileOutput = '',
  terminalError = '',
  terminalReady = false,
  onSendInput,
  onStop,
  onJumpToLine,
}: {
  id?: string;
  execution: ExecutionResult | null;
  language: LanguageName;
  running: boolean;
  runtimeMessage?: string;
  terminalOutput?: string;
  terminalCompileOutput?: string;
  terminalError?: string;
  terminalReady?: boolean;
  onSendInput?: (value: string) => void;
  onStop?: () => void;
  onJumpToLine?: (line: number) => void;
}) {
  const [tab, setTab] = useState<ConsoleTab>('Output');
  const [cleared, setCleared] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');
  const { notify } = useToast();

  useEffect(() => {
    if (running) setCleared(false);
  }, [running]);

  const visibleExecution = cleared ? null : execution;
  const errorLine = visibleExecution?.errorLine;
  const visibleTerminalOutput = cleared ? '' : terminalOutput;
  const errorCount = visibleExecution && visibleExecution.status !== 'success' ? 1 : 0;
  // Compiler output only appears for languages that are actually compiled.
  const tabs = BASE_TABS.filter(
    (item) => item !== 'Compile Output' || Boolean(visibleExecution?.compileOutput?.trim() || terminalCompileOutput.trim()),
  );

  // Use the input consumed by this run, not newer unsaved text from the panel.
  const transcript = visibleExecution
    ? formatExecutionTranscript(visibleExecution.stdout, visibleExecution.stdin ?? '', visibleExecution.stdinEchoed)
    : '';
  const outputText =
    transcript.trim() ||
    (visibleExecution?.status === 'success' ? '(program completed without output)' : visibleExecution?.message) ||
    '';

  const copy = async () => {
    const text = visibleExecution
      ? [`Output:\n${transcript}`, visibleExecution.stderr]
          .filter((part) => part.trim())
          .join('\n')
          .trim() || visibleExecution.status
      : '';
    try {
      await navigator.clipboard.writeText(text);
      notify('Console copied to clipboard.');
    } catch {
      notify('Clipboard is not available in this browser.', 'warning');
    }
  };

  return (
    <section id={id} className={`console-card card ${expanded ? 'console-expanded' : ''}`} aria-label="Program console">
      <div className="console-header">
        <div className="tabs" role="tablist" aria-label="Console sections">
          {tabs.map((item) => (
            <button
              key={item}
              role="tab"
              aria-selected={tab === item}
              className={tab === item ? 'active' : ''}
              onClick={() => setTab(item)}
            >
              {item}
              {item === 'Errors' && errorCount ? <span className="tab-count">{errorCount}</span> : null}
            </button>
          ))}
        </div>
        <div className="console-tools">
          {running ? (
            <button className="terminal-stop" onClick={onStop} type="button">
              <Square size={13} /> Stop
            </button>
          ) : null}
          <IconButton label="Copy console" onClick={copy}>
            <Copy size={15} />
          </IconButton>          <IconButton label="Clear console" onClick={() => {
              setCleared(true);
              notify('Console cleared.');
            }}
          >
            <Trash2 size={15} />
          </IconButton>
          <IconButton
            label={expanded ? 'Collapse console' : 'Expand console'}
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </IconButton>
        </div>
      </div>
      {running && terminalReady ? (
        <form
          className="console-input terminal-live-input"
          onSubmit={(event) => {
            event.preventDefault();
            onSendInput?.(input);
            setInput('');
          }}
        >
          <label htmlFor="console-live-input">Program input</label>
          <span>Type a value and press Enter to send it to the running program.</span>
          <div className="terminal-input-row">
            <textarea
              id="console-live-input"
              aria-label="Input for running program"
              autoFocus
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Type input, then press Enter"
              rows={1}
            />
            <button type="submit" aria-label="Send input">
              <Send size={15} />
            </button>
          </div>
        </form>
      ) : null}
      <div className="console-body" role="status" aria-live="polite">
        {tab === 'Output' ? (
          running ? (
            <>
              <span className="console-prompt">$ {language.toLowerCase()} · e2b</span>
              {visibleTerminalOutput ? <pre className="console-pre terminal-output">{visibleTerminalOutput}</pre> : null}
              {runtimeMessage ? <span>{runtimeMessage}</span> : null}
              {terminalError ? <span className="console-error"><AlertCircle size={14} /> {terminalError}</span> : null}
              {!visibleTerminalOutput && !terminalError ? <Terminal size={17} /> : null}
            </>
          ) : visibleExecution ? (
            <>
              <span className="console-prompt">
                $ {language.toLowerCase()} · {visibleExecution.executionMode}
              </span>
              <div className="console-block">
                <span className="console-block-label">Output:</span>
                <pre className="console-pre">{outputText}</pre>
              </div>
              <span className={visibleExecution.status === 'success' ? 'console-success' : 'console-error'}>
                {visibleExecution.status === 'success' ? <Check size={13} /> : <AlertCircle size={13} />} {visibleExecution.status}
                {visibleExecution.time !== null ? ` · ${Math.round(visibleExecution.time)}ms` : ''}
              </span>
            </>
          ) : (
            <>
              <Terminal size={17} />
              <span>Your program output will appear here after you run your code.</span>
              {terminalError ? <span className="console-error">{terminalError}</span> : null}
            </>
          )
        ) : null}

        {tab === 'Errors' ? (
          visibleExecution && visibleExecution.status !== 'success' ? (
            <>
              <span className="console-error">
                <AlertCircle size={15} /> {visibleExecution.message || visibleExecution.stderr}
              </span>
              {errorLine ? (
                <button
                  type="button"
                  className="console-line-jump"
                  onClick={() => onJumpToLine?.(errorLine)}
                >
                  Jump to line {errorLine} ({visibleExecution.errorLineConfidence})
                </button>
              ) : null}
              <span>Try Analyze Locally for a calm explanation and hints.</span>
            </>
          ) : (
            <>
              <Check size={16} className="console-success" />
              <span>{visibleExecution ? 'No runtime errors reported for the latest run.' : 'Run code to see execution errors here.'}</span>
            </>
          )
        ) : null}

        {tab === 'Compile Output' ? (
          (visibleExecution?.compileOutput || terminalCompileOutput).trim() ? (
            <pre className="console-pre">{visibleExecution?.compileOutput || terminalCompileOutput}</pre>
          ) : (
            <span>This run produced no compiler output.</span>
          )
        ) : null}

        {tab === 'Execution Details' ? (
          <>
            <span>
              Execution mode: <strong>{visibleExecution?.executionMode || 'not started'}</strong>
            </span>
            <span>
              Source:{' '}
              {visibleExecution?.executionMode === 'interactive_hosted'
                ? 'isolated E2B cloud sandbox; source is sent to the configured runner service'
                : visibleExecution?.executionMode === 'secure_remote'
                  ? 'configured secure runner'
                  : 'local browser worker'}{' '}
              · Interactive runner limits: 200 KB output · 60s
            </span>
            {typeof visibleExecution?.exitCode === 'number' ? <span>Exit code: {visibleExecution.exitCode}</span> : null}
            {typeof visibleExecution?.memory === 'number' && visibleExecution.memory > 0 ? (
              <span>Memory used: {Math.round(visibleExecution.memory / 1024)} KB</span>
            ) : null}
            <span>Error line confidence: {visibleExecution?.errorLineConfidence || 'unknown'}</span>
          </>
        ) : null}
      </div>
    </section>
  );
}
