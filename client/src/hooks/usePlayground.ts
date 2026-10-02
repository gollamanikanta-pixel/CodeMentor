import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExecutionResult, LanguageName, LocalAnalysis } from '../types';
import { analyzeLocally, analyzerSupports } from '../analyzers/localAnalyzer';
import { openInteractiveTerminal } from '../api/client';
import { getLanguage, isInteractiveRunnable } from '../data/languages';
import { readLocal, writeLocal, STORAGE_KEYS } from '../storage/localStorage';
import { useSettings } from '../settings/SettingsContext';
import { useToast } from './useToast';

type Draft = { code: string; language: LanguageName; projectTitle: string; stdin: string };

const DEFAULT_TITLE = 'Untitled learning program';

function initialDraft(defaultLanguage: LanguageName): Draft {
  const stored = readLocal<Draft | null>(STORAGE_KEYS.draft, null);
  if (stored?.code && stored.language) return stored;
  return {
    code: getLanguage(defaultLanguage)?.starter ?? '',
    language: defaultLanguage,
    projectTitle: DEFAULT_TITLE,
    stdin: '',
  };
}

/**
 * Persisted learning state is only valid for the language it was created for.
 * A draft saved as C must never render an old JavaScript analysis (or vice
 * versa), so restored analysis/execution are checked against the draft's
 * language and discarded when they disagree.
 */
function executionMatchesLanguage(execution: ExecutionResult, language: LanguageName): boolean {
  if (execution.executionMode === 'interactive_hosted') return isInteractiveRunnable(language);
  if (execution.executionMode === 'secure_remote') return Boolean(getLanguage(language)?.providerLanguage);
  if (execution.executionMode === 'secure_remote') return Boolean(getLanguage(language)?.providerLanguage);
  if (execution.executionMode === 'browser_python') return language === 'Python';
  if (execution.executionMode === 'browser_javascript') return language === 'JavaScript';
  return true;
}

export function usePlayground() {
  const { settings } = useSettings();
  const { notify } = useToast();
  const draft = useRef(initialDraft(settings.defaultLanguage));

  const [language, setLanguageState] = useState<LanguageName>(draft.current.language);
  const [code, setCode] = useState(draft.current.code);
  const [stdin, setStdin] = useState(draft.current.stdin);
  const [projectTitle, setProjectTitle] = useState(draft.current.projectTitle);
  const [execution, setExecution] = useState<ExecutionResult | null>(() => {
    const stored = readLocal<ExecutionResult | null>(STORAGE_KEYS.latestExecution, null);
    return stored && executionMatchesLanguage(stored, draft.current.language) ? stored : null;
  });
  const [analysis, setAnalysis] = useState<LocalAnalysis | null>(() => {
    const stored = readLocal<LocalAnalysis | null>(STORAGE_KEYS.localAnalysis, null);
    return stored && stored.language === draft.current.language ? stored : null;
  });
  const [running, setRunning] = useState(false);
  const [runtimeMessage, setRuntimeMessage] = useState('');
  const [terminalOutput, setTerminalOutput] = useState('');
  const [terminalCompileOutput, setTerminalCompileOutput] = useState('');
  const [terminalError, setTerminalError] = useState('');
  const [terminalReady, setTerminalReady] = useState(false);
  const runToken = useRef(0);
  const terminalSocket = useRef<WebSocket | null>(null);

  // Autosave the working draft. This never triggers a run or an AI request.
  useEffect(() => {
    if (!settings.autosave) return;
    const timer = window.setTimeout(() => {
      writeLocal(STORAGE_KEYS.draft, { code, language, projectTitle, stdin });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [code, language, projectTitle, stdin, settings.autosave]);

  const setLanguage = useCallback(
    (next: LanguageName, { loadStarter = true }: { loadStarter?: boolean } = {}) => {
      runToken.current += 1;
      terminalSocket.current?.close(1000, 'Language changed');
      terminalSocket.current = null;
      setRunning(false);
      setTerminalReady(false);
      setLanguageState(next);
      if (loadStarter) setCode(getLanguage(next)?.starter ?? '');
      setAnalysis(null);
      setExecution(null);
    },
    [],
  );

  const startInteractiveRun = useCallback(async (): Promise<ExecutionResult | null> => {
    if (!isInteractiveRunnable(language)) {
      notify(getLanguage(language)?.statusDescription ?? 'This language is not runnable yet.', 'warning');
      return null;
    }

    terminalSocket.current?.close(1000, 'Starting a new run');
    const token = ++runToken.current;
    const source = code;
    const currentLanguage = language;
    let stdout = '';
    let stderr = '';
    let compileOutput = '';
    let runError = '';
    let finished = false;
    setExecution(null);
    setTerminalOutput('');
    setTerminalCompileOutput('');
    setTerminalError('');
    setTerminalReady(false);
    setRunning(true);
    setRuntimeMessage('Connecting to the isolated interactive runner…');

    const saveResult = (result: ExecutionResult) => {
      if (token !== runToken.current) return;
      setExecution(result);
      writeLocal(STORAGE_KEYS.latestExecution, result);
      if (
        ['syntax_error', 'compilation_error', 'runtime_error', 'timeout', 'time_limit_exceeded', 'memory_limit_exceeded'].includes(
          result.status,
        ) &&
        analyzerSupports(currentLanguage)
      ) {
        const nextAnalysis = analyzeLocally(source, currentLanguage, result);
        setAnalysis(nextAnalysis);
        writeLocal(STORAGE_KEYS.localAnalysis, nextAnalysis);
      }
      setRunning(false);
      setTerminalReady(false);
      terminalSocket.current = null;
      setRuntimeMessage('');
      notify(
        result.status === 'success'
          ? 'Run completed in the isolated interactive runner.'
          : result.status === 'cancelled'
            ? 'Program stopped.'
            : 'The interactive run returned a learning signal.',
        result.status === 'success' ? 'success' : 'warning',
      );
    };

    try {
      const socket = await openInteractiveTerminal();
      if (token !== runToken.current) {
        socket.close(1000, 'Run superseded');
        return null;
      }
      terminalSocket.current = socket;
      socket.addEventListener('message', (event: MessageEvent<string>) => {
        if (token !== runToken.current) return;
        let message: Record<string, unknown>;
        try {
          message = JSON.parse(event.data) as Record<string, unknown>;
        } catch {
          const error = 'The runner sent an invalid terminal response.';
          setTerminalError(error);
          saveResult({
            status: 'internal_error', stdout, stderr, message: error, time: null,
            errorLine: null, errorLineConfidence: 'unknown', executionMode: 'interactive_hosted',
            compileOutput, exitCode: null,
          });
          socket.close(4000, 'Invalid runner response');
          return;
        }

        if (message.type === 'started') {
          setTerminalReady(true);
          setRuntimeMessage('Program is running. Enter input below and press Enter to send it.');
        } else if (message.type === 'output' && typeof message.text === 'string') {
          const text = message.text;
          if (message.stream === 'stderr') stderr += text;
          else stdout += text;
          setTerminalOutput((previous) => (previous + text).slice(-200_000));
        } else if (message.type === 'compile' && typeof message.text === 'string') {
          const text = message.text;
          compileOutput += text;
          setTerminalCompileOutput((previous) => (previous + text).slice(-200_000));
        } else if (message.type === 'error' && typeof message.message === 'string') {
          runError = message.message;
          setTerminalError(runError);
        } else if (message.type === 'finished') {
          finished = true;
          const allowedStatuses: ExecutionResult['status'][] = [
            'success', 'syntax_error', 'compilation_error', 'runtime_error', 'timeout',
            'time_limit_exceeded', 'memory_limit_exceeded', 'cancelled', 'internal_error', 'unavailable',
          ];
          const status = allowedStatuses.find((item) => item === message.status) ?? 'internal_error';
          const result: ExecutionResult = {
            status,
            stdout,
            stderr,
            message: typeof message.message === 'string' ? message.message : runError,
            time: typeof message.timeMs === 'number' ? message.timeMs : null,
            errorLine: typeof message.errorLine === 'number' ? message.errorLine : null,
            errorLineConfidence:
              message.errorLineConfidence === 'exact' || message.errorLineConfidence === 'estimated'
                ? message.errorLineConfidence
                : 'unknown',
            executionMode: 'interactive_hosted',
            compileOutput,
            exitCode: typeof message.exitCode === 'number' ? message.exitCode : null,
          };
          saveResult(result);
        }
      });
      socket.addEventListener('close', () => {
        if (token !== runToken.current || finished) return;
        const message = runError || 'The interactive terminal disconnected before the program finished.';
        setTerminalError(message);
        saveResult({
          status: 'internal_error', stdout, stderr, message, time: null,
          errorLine: null, errorLineConfidence: 'unknown', executionMode: 'interactive_hosted',
          compileOutput, exitCode: null,
        });
      });
      socket.addEventListener('error', () => {
        if (token !== runToken.current || finished) return;
        runError = 'The interactive terminal connection failed. Check that the API and hosted runner services are running.';
        setTerminalError(runError);
      });
      socket.send(JSON.stringify({
        type: 'start',
        language: getLanguage(currentLanguage)?.key ?? currentLanguage.toLowerCase(),
        source,
      }));
      setRuntimeMessage('Preparing your program in an isolated E2B cloud sandbox…');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not connect to the interactive runner.';
      setTerminalError(message);
      const result: ExecutionResult = {
        status: 'unavailable', stdout: '', stderr: '', message, time: null,
        errorLine: null, errorLineConfidence: 'unknown', executionMode: 'interactive_hosted',
        compileOutput: '', exitCode: null,
      };
      saveResult(result);
      return result;
    }
    return null;
  }, [code, language, notify]);

  const sendTerminalInput = useCallback((text: string) => {
    const socket = terminalSocket.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'input', text }));
    }
  }, []);

  const stopInteractiveRun = useCallback(() => {
    const socket = terminalSocket.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'cancel' }));
      setRuntimeMessage('Stopping the program…');
    }
  }, []);

  useEffect(() => () => {
    runToken.current += 1;
    terminalSocket.current?.close(1000, 'Playground closed');
  }, []);

  const analyze = useCallback(() => {
    // Every language has at least honest structural guidance; the deep rule
    // engines add more for the five languages they fully understand.
    const result = analyzeLocally(code, language, execution);
    setAnalysis(result);
    writeLocal(STORAGE_KEYS.localAnalysis, result);
    notify('Local analysis is ready. Let’s understand this together.', 'info');
    return result;
  }, [code, language, execution, notify]);

  const clearExecution = useCallback(() => setExecution(null), []);

  return {
    language,
    setLanguage,
    code,
    setCode,
    stdin,
    setStdin,
    projectTitle,
    setProjectTitle,
    execution,
    setExecution,
    analysis,
    setAnalysis,
    running,
    runtimeMessage,
    terminalOutput,
    terminalCompileOutput,
    terminalError,
    terminalReady,
    startInteractiveRun,
    sendTerminalInput,
    stopInteractiveRun,
    analyze,
    clearExecution,
  };
}
