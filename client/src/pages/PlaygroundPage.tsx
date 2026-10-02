import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot,
  ChevronDown,
  Code2,
  FileCode2,
  FlaskConical,
  GitBranch,
  Lightbulb,
  ListChecks,
  Play,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  WandSparkles,
} from 'lucide-react';
import { Button, Pill } from '../components/ui';
import { CodeEditor, markersFromAnalysis } from '../editor/CodeEditor';
import { AnalysisPanel, type AnalysisTab } from '../features/analysis/AnalysisPanel';
import { VisualsTab } from '../features/visuals/VisualsTab';
import { QuizPanel } from '../features/quiz/QuizPanel';
import { ConsolePanel } from '../features/console/ConsolePanel';
import { HtmlPreviewPanel } from '../features/preview/HtmlPreviewPanel';
import { AiHelpDialog } from '../components/AiHelpDialog';
import { usePlayground } from '../hooks/usePlayground';
import { useToast } from '../hooks/useToast';
import { useSettings } from '../settings/SettingsContext';
import { Type } from 'lucide-react';
import {
  detectLanguageFromFilename,
  getLanguage,
  isLanguageAvailable,
  languageOptionLabel,
  languageNames,
} from '../data/languages';
import { saveProject as persistProject } from '../projects/projectStore';
import type { LanguageName, StoredProject } from '../types';

const MAX_UPLOAD_BYTES = 51200;

export function PlaygroundPage() {
  const playground = usePlayground();
  const { settings, update } = useSettings();
  const { notify } = useToast();
  const [analysisTab, setAnalysisTab] = useState<AnalysisTab>('Overview');
  const [aiOpen, setAiOpen] = useState(false);
  const [revealAfterRun, setRevealAfterRun] = useState(false);
  const jumpToEditorLine = useRef<(line: number) => void>(() => {});

  const language = playground.language;
  const config = getLanguage(language);
  const languageAvailable = isLanguageAvailable(language);
  const canRun = languageAvailable && (config?.executionEnabled ?? false);
  const statusLabel = !languageAvailable
    ? 'Coming soon'
    : config?.statusLabel;
  const statusTone = canRun ? 'amber' : config?.analysisSupported ? 'amber' : 'neutral';
  const markers = useMemo(() => markersFromAnalysis(playground.analysis, playground.execution), [playground.analysis, playground.execution]);
  const revealAnalysis = useCallback(() => {
    document.getElementById('learning-analysis')?.scrollIntoView({ behavior: 'instant', block: 'start' });
  }, []);
  const revealConsole = useCallback(() => {
    document.getElementById('program-console')?.scrollIntoView({ behavior: 'instant', block: 'center' });
  }, []);
  const jumpToSourceLine = useCallback((line: number) => {
    document.querySelector('.editor-card')?.scrollIntoView({ behavior: 'instant', block: 'start' });
    window.requestAnimationFrame(() => jumpToEditorLine.current(line));
  }, []);

  useEffect(() => {
    if (playground.running) revealConsole();
  }, [playground.running, revealConsole]);

  useEffect(() => {
    if (!revealAfterRun || playground.running || !playground.execution) return;
    setRevealAfterRun(false);
    if (playground.execution.status !== 'success' && playground.execution.status !== 'cancelled') {
      if (playground.execution.errorLine) {
        jumpToSourceLine(playground.execution.errorLine);
      } else {
        setAnalysisTab('Errors & Learning Hints');
        revealAnalysis();
      }
    }
  }, [revealAfterRun, playground.execution, playground.running, revealAnalysis, jumpToSourceLine]);

  /*
   * The action buttons sit below the console, while the learning panel is above
   * it. Switching the tab alone is invisible from down here, so every action
   * also brings the panel into view — one click takes the learner straight to
   * the matching section.
   */
  const runAndMaybeAnalyze = () => {
    setRevealAfterRun(true);
    revealConsole();
    void playground.startInteractiveRun();
  };

  const analyzeAndReveal = () => {
    playground.analyze();
    setAnalysisTab('Overview');
    revealAnalysis();
  };

  const openAnalyzeTab = (tab: AnalysisTab) => {
    if (!playground.analysis) playground.analyze();
    setAnalysisTab(tab);
    revealAnalysis();
  };

  const uploadCode = (file: File) => {
    if (file.size === 0) {
      notify('That source file is empty. Add code before uploading.', 'warning');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      notify('That file is larger than the 50 KB learning limit.', 'warning');
      return;
    }
    const detected = detectLanguageFromFilename(file.name);
    const isPlainText = file.name.toLowerCase().endsWith('.txt');
    if (detected && !isLanguageAvailable(detected.displayName)) {
      notify(`${detected.displayName} is coming soon and cannot be loaded yet.`, 'warning');
      return;
    }
    if (!detected && !isPlainText) {
      notify('That file type is not supported for CodeMentor AI learning.', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      // A .txt file keeps the current language; a known extension switches to it.
      if (detected) playground.setLanguage(detected.displayName, { loadStarter: false });
      playground.setCode(String(reader.result ?? ''));
      playground.setProjectTitle(file.name.replace(/\.[^/.]+$/, ''));
      notify(
        detected
          ? `${detected.displayName} source loaded locally — nothing was uploaded.`
          : 'Source loaded locally — choose the language before running.',
        'info',
      );
    };
    reader.readAsText(file);
  };

  const save = () => {
    const project: StoredProject = {
      id: crypto.randomUUID(),
      title: playground.projectTitle || 'Untitled learning program',
      language,
      code: playground.code,
      stdin: playground.stdin,
      updatedAt: new Date().toISOString(),
      status: languageAvailable ? config?.statusLabel : 'Coming soon',
    };
    persistProject(project);
    notify('Saved locally in this browser.');
  };

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR FOCUSED WORKSPACE</span>
          <h1>Let’s understand this code.</h1>
          <p>Experiment freely. CodeMentor AI will help you learn what happened and why.</p>
        </div>
        <div className="heading-actions">
          <Button variant="soft" icon={Save} onClick={save}>
            Save project
          </Button>
          <Button icon={Play} onClick={runAndMaybeAnalyze} disabled={!canRun || playground.running}>
            Run Code
          </Button>
        </div>
      </div>

      <div className="project-bar">
        <div className="project-title">
          <FileCode2 size={17} aria-hidden="true" />
          <input
            value={playground.projectTitle}
            onChange={(event) => playground.setProjectTitle(event.target.value)}
            aria-label="Project title"
          />
          <span aria-hidden="true">·</span>
          <Pill tone={statusTone}>{statusLabel}</Pill>
        </div>
        <div className="project-meta">
          <span>
            <ShieldCheck size={14} aria-hidden="true" /> Code is sent to your configured runner when run
          </span>
        </div>
      </div>

      <div className="playground-grid">
        <section className="editor-card card" aria-label="Code editor">
          <div className="editor-toolbar">
            <div className="select-wrap">
              <Code2 size={15} aria-hidden="true" />
              <select
                value={language}
                onChange={(event) => playground.setLanguage(event.target.value as LanguageName)}
                aria-label="Programming language"
              >
                {languageNames.map((name) => (
                  <option key={name} value={name} disabled={!isLanguageAvailable(name)}>
                    {languageOptionLabel(name)}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} aria-hidden="true" />
            </div>
            <div className="toolbar-actions">
              <div className="select-wrap toolbar-select">
                <Type size={15} aria-hidden="true" />
                <select
                  value={settings.fontSize}
                  onChange={(event) => update('fontSize', Number(event.target.value))}
                  aria-label="Editor font size"
                >
                  {[13, 14, 16, 18].map((size) => (
                    <option key={size} value={size}>
                      {size}px
                    </option>
                  ))}
                </select>
              </div>
              <button
                className={settings.wordWrap ? 'toolbar-toggle active' : 'toolbar-toggle'}
                aria-pressed={settings.wordWrap}
                title="Word wrap"
                onClick={() => update('wordWrap', !settings.wordWrap)}
              >
                Wrap
              </button>
              <button
                className={settings.minimap ? 'toolbar-toggle active' : 'toolbar-toggle'}
                aria-pressed={settings.minimap}
                title="Minimap"
                onClick={() => update('minimap', !settings.minimap)}
              >
                Map
              </button>
              <label className="upload-btn" title="Upload source file">
                <Upload size={15} aria-hidden="true" /> Upload
                <input
                  type="file"
                  accept=".py,.js,.mjs,.ts,.html,.htm,.sql,.c,.h,.cpp,.cc,.cxx,.hpp,.java,.cs,.go,.php,.rb,.rs,.kt,.txt"
                  onChange={(event) => event.target.files?.[0] && uploadCode(event.target.files[0])}
                />
              </label>
              <button
                onClick={() => {
                  playground.setCode(config?.starter ?? '');
                  notify(`Learning example loaded for ${language}.`, 'info');
                }}
              >
                <FlaskConical size={15} aria-hidden="true" /> Load Learning Example
              </button>
              <button
                onClick={() => {
                  playground.setCode('');
                  notify('Editor cleared.', 'info');
                }}
              >
                <Trash2 size={15} aria-hidden="true" /> Clear
              </button>
            </div>
          </div>

          <div className="editor-shell">
            <CodeEditor
              value={playground.code}
              language={language}
              markers={markers}
              onChange={playground.setCode}
              onJumpToLineReady={(jump) => {
                jumpToEditorLine.current = jump;
              }}
            />
          </div>

          <div className="editor-footer">
            <span>
              <span className="status-dot green-dot" aria-hidden="true" /> {settings.autosave ? 'Autosaved locally' : 'Autosave off'}
            </span>
            <span>
              Spaces: 4 · UTF-8 · {language}
            </span>
          </div>

        </section>

        <AnalysisPanel
          activeTab={analysisTab}
          onTabChange={setAnalysisTab}
          analysis={playground.analysis}
          execution={playground.execution}
          hintLevel={settings.hintLevel}
          onAnalyze={() => {
            playground.analyze();
            setAnalysisTab('Overview');
          }}
          onRetry={runAndMaybeAnalyze}
          onJumpToLine={jumpToSourceLine}
        >
          {analysisTab === 'Visuals' ? (
            <VisualsTab analysis={playground.analysis} />
          ) : analysisTab === 'Quiz' ? (
            <QuizPanel analysis={playground.analysis} language={language} projectTitle={playground.projectTitle} />
          ) : null}
        </AnalysisPanel>
      </div>

      {/* HTML renders in the sandboxed preview rather than a code worker. */}
      {language === 'HTML' ? <HtmlPreviewPanel code={playground.code} /> : null}

      <ConsolePanel
        id="program-console"
        execution={playground.execution}
        language={language}
        running={playground.running}
        runtimeMessage={playground.runtimeMessage}
        terminalOutput={playground.terminalOutput}
        terminalCompileOutput={playground.terminalCompileOutput}
        terminalError={playground.terminalError}
        terminalReady={playground.terminalReady}
        onSendInput={playground.sendTerminalInput}
        onStop={playground.stopInteractiveRun}
        onJumpToLine={jumpToSourceLine}
      />

      <div className="action-row">
        <Button variant="outline" onClick={runAndMaybeAnalyze} icon={Play} disabled={!canRun || playground.running}>
          Run Code
        </Button>
        <Button variant="outline" onClick={analyzeAndReveal} icon={WandSparkles}>
          Analyze Locally
        </Button>
        <Button variant="outline" onClick={() => openAnalyzeTab('Errors & Learning Hints')} icon={Lightbulb}>
          Explain Error
        </Button>
        <Button variant="outline" onClick={() => openAnalyzeTab('Visuals')} icon={GitBranch}>
          Visualize Logic
        </Button>
        <Button variant="outline" onClick={() => openAnalyzeTab('Quiz')} icon={ListChecks}>
          Generate Local Quiz
        </Button>
        <Button
          variant="outline"
          onClick={runAndMaybeAnalyze}
          icon={Play}
          disabled={!canRun || playground.running}
        >
          I Fixed It — Run Code Again
        </Button>
        <Button variant="ai" onClick={() => setAiOpen(true)} icon={Bot} disabled={!settings.aiDeepHelp}>
          Ask AI for Deeper Help
        </Button>
      </div>

      <div className="runner-note">
        <ShieldCheck size={14} aria-hidden="true" />
        <span>
          {!languageAvailable
            ? `${language} is coming soon. Choose one of the available languages to run and learn from code. `
            : canRun
            ? 'Live interactive execution uses the configured E2B isolated cloud runner. Source code is sent to that service; internet access is disabled in the sandbox. '
            : `${config?.statusDescription} `}
          Use Local Guidance First. Local analysis does not send source to an AI service.
        </span>
        <Link to="/help">Learn about privacy</Link>
      </div>

      <AiHelpDialog
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        code={playground.code}
        language={language}
        execution={playground.execution}
        analysis={playground.analysis}
        hintLevel={settings.hintLevel}
        explanationLevel={settings.explanationLevel}
        onResult={() => undefined}
      />
    </div>
  );
}
