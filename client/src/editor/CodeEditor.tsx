import Editor, { type BeforeMount, type OnMount } from '@monaco-editor/react';
import { useCallback, useEffect, useRef } from 'react';
import type { LanguageName, LocalAnalysis, ExecutionResult } from '../types';
import { getLanguage } from '../data/languages';
import { useSettings, useTheme } from '../settings/SettingsContext';

export type EditorMarker = { line: number; severity: 'error' | 'warning' | 'hint'; message: string };

export function markersFromAnalysis(
  analysis: LocalAnalysis | null,
  execution: ExecutionResult | null,
): EditorMarker[] {
  const markers: EditorMarker[] = [];
  if (analysis) {
    for (const error of analysis.errors) {
      if (error.line) markers.push({ line: error.line, severity: error.severity, message: error.title });
    }
  }
  if (execution?.errorLine && !markers.some((marker) => marker.line === execution.errorLine)) {
    markers.push({
      line: execution.errorLine,
      severity: 'error',
      message: execution.message || 'Execution stopped here.',
    });
  }
  return markers;
}

const SEVERITY_CLASS: Record<EditorMarker['severity'], string> = {
  error: 'cm-line-error',
  warning: 'cm-line-warning',
  hint: 'cm-line-hint',
};

/**
 * Monaco's stock `vs-dark` uses a neutral #1e1e1e that clashes with the cool
 * slate palette, and `vs` is brighter than the rest of the light theme. Both are
 * redefined from our own tokens so the editor reads as part of the product
 * rather than a dropped-in widget.
 */
export const defineThemes: BeforeMount = (monaco) => {
  monaco.editor.defineTheme('codementor-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6b7f99', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'a5b0ff' },
      { token: 'string', foreground: '7fd7b0' },
      { token: 'number', foreground: 'f0c184' },
      { token: 'type', foreground: '7bd9e6' },
      { token: 'identifier', foreground: 'd3ddf0' },
      { token: 'function', foreground: 'c6b2ff' },
      { token: 'delimiter', foreground: '8b9db8' },
    ],
    colors: {
      'editor.background': '#0e1727',
      'editor.foreground': '#cddaec',
      'editorGutter.background': '#0e1727',
      'editorLineNumber.foreground': '#4b5f80',
      'editorLineNumber.activeForeground': '#a2b4cf',
      'editor.lineHighlightBackground': '#152238',
      'editor.selectionBackground': '#2b4066',
      'editor.inactiveSelectionBackground': '#22314c',
      'editorCursor.foreground': '#8fa0ff',
      'editorIndentGuide.background1': '#1d2c45',
      'editorIndentGuide.activeBackground1': '#2c405e',
      'editorWhitespace.foreground': '#2a3b56',
      'editorWidget.background': '#131f33',
      'editorWidget.border': '#26374f',
      'editorHoverWidget.background': '#131f33',
      'editorHoverWidget.border': '#26374f',
      'editorSuggestWidget.background': '#131f33',
      'editorBracketMatch.background': '#1d2c45',
      'editorBracketMatch.border': '#55d8e6',
      'editorOverviewRuler.border': '#0e1727',
      'minimap.background': '#0c1523',
      'scrollbarSlider.background': '#26374f88',
      'scrollbarSlider.hoverBackground': '#33486aaa',
    },
  });

  monaco.editor.defineTheme('codementor-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '7a8ba3', fontStyle: 'italic' },
      { token: 'keyword', foreground: '4a56d0' },
      { token: 'string', foreground: '0f7a4d' },
      { token: 'number', foreground: '9a6208' },
      { token: 'type', foreground: '0b6f80' },
      { token: 'identifier', foreground: '1f2d47' },
      { token: 'function', foreground: '6b34c8' },
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#20304b',
      'editorLineNumber.foreground': '#a9b8cc',
      'editorLineNumber.activeForeground': '#5f7089',
      'editor.lineHighlightBackground': '#f2f6fc',
      'editor.selectionBackground': '#d7e1f9',
      'editorCursor.foreground': '#4f5fe8',
      'editorIndentGuide.background1': '#e3eaf4',
      'editorWidget.background': '#ffffff',
      'editorWidget.border': '#dde5f0',
      'minimap.background': '#f7fafd',
      'scrollbarSlider.background': '#c5d2e388',
    },
  });
};

/** Monaco offers no built-in empty prompt, so an overlay carries the invitation. */
function EmptyEditorNote() {
  return (
    <div className="editor-empty-note" aria-hidden="true">
      <p>Write or upload code to start learning.</p>
    </div>
  );
}

export function CodeEditor({
  value,
  language,
  markers,
  onChange,
  onJumpToLineReady,
}: {
  value: string;
  language: LanguageName;
  markers: EditorMarker[];
  onChange: (value: string) => void;
  onJumpToLineReady: (jumpToLine: (line: number) => void) => void;
}) {
  const { settings } = useSettings();
  const { resolved } = useTheme();
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const decorationIds = useRef<string[]>([]);

  /**
   * Highlights each detected issue line. We use explicit decorations rather
   * than relying on validation squiggles: they render deterministically across
   * Monaco builds, span the whole line, and can carry our own colours.
   */
  const applyMarkers = useCallback((list: EditorMarker[]) => {
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!monaco || !editor || !model) return;

    const lineCount = model.getLineCount();
    const decorations = list
      .filter((marker) => marker.line >= 1)
      .map((marker) => {
        const line = Math.min(Math.max(marker.line, 1), lineCount);
        return {
          range: new monaco.Range(line, 1, line, model.getLineMaxColumn(line)),
          options: {
            isWholeLine: true,
            className: SEVERITY_CLASS[marker.severity],
            overviewRuler: {
              color: marker.severity === 'error' ? '#ef7e88' : marker.severity === 'warning' ? '#f3be6d' : '#7c8cff',
              position: monaco.editor.OverviewRulerLane.Right,
            },
            hoverMessage: { value: `**CodeMentor AI:** ${marker.message}` },
          },
        };
      });

    decorationIds.current = editor.deltaDecorations(decorationIds.current, decorations);

    // Also publish real markers so hover, the overview ruler and any tooling
    // that reads model markers stay in sync.
    monaco.editor.setModelMarkers(
      model,
      'codementor',
      decorations.map((decoration, index) => ({
        startLineNumber: decoration.range.startLineNumber,
        endLineNumber: decoration.range.endLineNumber,
        startColumn: 1,
        endColumn: decoration.range.endColumn,
        severity:
          list[index].severity === 'error'
            ? monaco.MarkerSeverity.Error
            : list[index].severity === 'warning'
              ? monaco.MarkerSeverity.Warning
              : monaco.MarkerSeverity.Info,
        message: list[index].message,
        source: 'CodeMentor AI',
      })),
    );
  }, []);

  const mount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    applyMarkers(markers);
    onJumpToLineReady((line) => {
      const model = editor.getModel();
      if (!model || !Number.isInteger(line) || line < 1) return;
      const targetLine = Math.min(line, model.getLineCount());
      editor.revealLineInCenter(targetLine);
      editor.setPosition({ lineNumber: targetLine, column: 1 });
      editor.focus();
    });
  };

  // Markers must refresh whenever a new run or analysis produces them, not only
  // while the learner is typing.
  useEffect(() => {
    applyMarkers(markers);
  }, [markers, applyMarkers]);

  return (
    <div className="editor-host">
      {!value?.trim() ? <EmptyEditorNote /> : null}
      <Editor
      height="100%"
      language={getLanguage(language)?.monacoLanguage ?? 'plaintext'}
      value={value}
      theme={resolved === 'dark' ? 'codementor-dark' : 'codementor-light'}
      beforeMount={defineThemes}
      onMount={mount}
      onChange={(next) => onChange(next ?? '')}
      loading={<div className="editor-loading">Preparing the editor…</div>}
      options={{
        minimap: { enabled: settings.minimap },
        fontSize: settings.fontSize,
        wordWrap: settings.wordWrap ? 'on' : 'off',
        automaticLayout: true,
        tabSize: 4,
        insertSpaces: true,
        scrollBeyondLastLine: false,
        smoothScrolling: !settings.reducedMotion,
        bracketPairColorization: { enabled: true },
        renderLineHighlight: 'line',
        renderValidationDecorations: 'on',
        padding: { top: 14, bottom: 14 },
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        ariaLabel: 'Code editor',
      }}
      />
    </div>
  );
}
