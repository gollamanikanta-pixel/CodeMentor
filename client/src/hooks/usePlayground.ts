import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExecutionResult, LanguageName, LocalAnalysis } from '../types';
import { analyzeLocally, analyzerSupports } from '../analyzers/localAnalyzer';
import { getLanguage, isRunnable } from '../data/languages';
import { runBrowserCode } from '../runners/browserRunner';
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

function executionMatchesLanguage(execution: ExecutionResult, language: LanguageName): boolean {
  if (execution.executionMode === 'browser_python') return language === 'Python';
  if (execution.executionMode === 'browser_javascript') return language === 'JavaScript';
  if (execution.executionMode === 'interactive_hosted' || execution.executionMode === 'secure_remote') return false;
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
  const [terminalCompileOutput] = useState('');
  const [terminalError, setTerminalError] = useState('');
  const [terminalReady] = useState(false);
  const runToken = useRef(0);
  const runAbort = useRef<AbortController | null>(null);

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
      runAbort.current?.abort();
      runAbort.current = null;
      setRunning(false);
      setRuntimeMessage('');
      setLanguageState(next);
      if (loadStarter) setCode(getLanguage(next)?.starter ?? '');
      setAnalysis(null);
      setExecution(null);
      writeLocal(STORAGE_KEYS.localAnalysis, null);
      writeLocal(STORAGE_KEYS.latestExecution, null);
    },
    [],
  );

  const startInteractiveRun = useCallback(async (): Promise<ExecutionResult | null> => {
    if (!isRunnable(language)) {
      notify(
        language === 'C' || language === 'C++' || language === 'Java'
          ? 'The single-file Playground does not run C, C++, or Java on Vercel. Multi-file execution may use a configured remote provider.'
          : getLanguage(language)?.statusDescription ?? 'This language is not runnable yet.',
        'warning',
      );
      return null;
    }

    const token = ++runToken.current;
    runAbort.current?.abort();
    const source = code;
    const controller = new AbortController();
    runAbort.current = controller;
    setExecution(null);
    setAnalysis(null);
    writeLocal(STORAGE_KEYS.latestExecution, null);
    writeLocal(STORAGE_KEYS.localAnalysis, null);
    setTerminalOutput('');
    setTerminalError('');
    setRunning(true);
    setRuntimeMessage('Preparing the local browser runner…');

    try {
      const result = await runBrowserCode(
        language,
        source,
        stdin,
        (_status, message) => {
          if (token === runToken.current) setRuntimeMessage(message);
        },
        controller.signal,
      );
      if (token !== runToken.current) return null;
      setExecution(result);
      writeLocal(STORAGE_KEYS.latestExecution, result);
      setTerminalOutput(result.stdout);
      setTerminalError(result.stderr);
      if (
        ['syntax_error', 'runtime_error', 'timeout', 'time_limit_exceeded', 'memory_limit_exceeded'].includes(result.status) &&
        analyzerSupports(language)
      ) {
        const nextAnalysis = analyzeLocally(source, language, result);
        setAnalysis(nextAnalysis);
        writeLocal(STORAGE_KEYS.localAnalysis, nextAnalysis);
      }
      setRunning(false);
      runAbort.current = null;
      setRuntimeMessage('');
      if (result.status !== 'cancelled') {
        notify(
          result.status === 'success' ? 'Run completed in your browser.' : 'The local run returned a learning signal.',
          result.status === 'success' ? 'success' : 'warning',
        );
      }
      return result;
    } catch (error) {
      if (token !== runToken.current) return null;
      setRunning(false);
      runAbort.current = null;
      setRuntimeMessage('');
      const message = error instanceof Error ? error.message : 'The local runner could not complete.';
      setTerminalError(message);
      notify(message, 'warning');
      return null;
    }
  }, [code, language, stdin, notify]);

  const sendTerminalInput = useCallback(() => {
    notify('Add input in Program Input, then run the program again.', 'info');
  }, [notify]);

  const stopInteractiveRun = useCallback(() => {
    runAbort.current?.abort();
    runAbort.current = null;
    runToken.current += 1;
    setRunning(false);
    setRuntimeMessage('');
  }, []);

  useEffect(
    () => () => {
      runToken.current += 1;
      runAbort.current?.abort();
    },
    [],
  );

  const analyze = useCallback(() => {
    const result = analyzeLocally(code, language, execution);
    setAnalysis(result);
    writeLocal(STORAGE_KEYS.localAnalysis, result);
    notify('Local analysis is ready. Let’s understand this together.', 'info');
    return result;
  }, [code, language, execution, notify]);

  const clearExecution = useCallback(() => {
    setExecution(null);
    writeLocal(STORAGE_KEYS.latestExecution, null);
  }, []);

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
