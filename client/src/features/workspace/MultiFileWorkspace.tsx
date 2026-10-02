import { useEffect, useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import JSZip from 'jszip';
import {
  Download,
  FilePlus2,
  Play,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  createProject,
  createProjectFile,
  deleteProjectFile,
  getProject,
  listProjects,
  runProjectExecution,
  updateProject,
  updateProjectFile,
  type AccountUser,
  type ProjectFileRecord,
} from '../../api/client';
import { useToast } from '../../hooks/useToast';
import { useTheme } from '../../settings/SettingsContext';
import { defineThemes } from '../../editor/CodeEditor';
import { Button, Pill } from '../../components/ui';
import {
  detectLanguageFromFilename,
  isLanguageAvailable,
  multiFileExecutionLanguages,
} from '../../data/languages';
import {
  buildSandboxDocument,
  injectIntoHead,
  PREVIEW_BLOCKED_MESSAGE,
  PREVIEW_IFRAME_SANDBOX,
} from '../../web/sandboxPreview';

type FileRecord = {
  id?: string;
  relativePath: string;
  filename: string;
  extension: string;
  language: string;
  content: string;
  isEntryFile?: boolean;
};

type WorkspaceTab = 'editor' | 'preview' | 'console' | 'details';

const LIMITS = { files: 30, fileBytes: 51200, projectBytes: 512000 };

const ALLOWED_EXTENSIONS = [
  '.html', '.htm', '.css', '.js', '.mjs', '.c', '.h', '.cpp', '.cc', '.cxx', '.hpp',
  '.java', '.py', '.ts', '.sql', '.cs', '.go', '.php', '.rb', '.rs', '.kt', '.txt',
];

const RUNNABLE_SECURE = new Set(
  multiFileExecutionLanguages.map((language) => (language === 'C++' ? 'cpp' : language.toLowerCase())),
);

const WEB_STARTER: FileRecord[] = [
  {
    relativePath: 'index.html',
    filename: 'index.html',
    extension: '.html',
    language: 'HTML',
    isEntryFile: true,
    content:
      '<!doctype html>\n<html lang="en"><head><meta charset="UTF-8"><title>CodeMentor AI starter</title></head><body><header><h1>My learning page</h1></header><main><p id="message">Change this text with app.js.</p><button id="learn">Try the interaction</button></main><footer>Built with CodeMentor AI</footer></body></html>',
  },
  {
    relativePath: 'styles.css',
    filename: 'styles.css',
    extension: '.css',
    language: 'CSS',
    content: 'body { font-family: system-ui; max-width: 720px; margin: 3rem auto; padding: 1rem; }\nbutton { padding: .7rem 1rem; cursor: pointer; }',
  },
  {
    relativePath: 'app.js',
    filename: 'app.js',
    extension: '.js',
    language: 'JavaScript',
    content:
      "document.querySelector('#learn')?.addEventListener('click', () => { document.querySelector('#message').textContent = 'You changed the page with JavaScript!'; console.log('button interaction complete'); });",
  },
];

function languageIdFor(extension: string): string {
  switch (extension) {
    case '.html':
    case '.htm':
      return 'html';
    case '.css':
      return 'css';
    case '.js':
    case '.mjs':
      return 'javascript';
    case '.py':
      return 'python';
    case '.java':
      return 'java';
    case '.cpp':
    case '.cc':
    case '.cxx':
      return 'cpp';
    case '.c':
    case '.h':
      return 'c';
    case '.ts':
      return 'typescript';
    case '.sql':
      return 'sql';
    default:
      return 'plaintext';
  }
}

function isValidRelativePath(value: string): boolean {
  return (
    value.length > 0 &&
    value.length < 180 &&
    !value.startsWith('/') &&
    !value.includes('\\') &&
    !value.split('/').some((part) => !part || part === '..' || part.startsWith('.'))
  );
}

function extensionOf(name: string): string {
  return name.slice(name.lastIndexOf('.')).toLowerCase();
}

function toFileRecord(record: ProjectFileRecord): FileRecord {
  return {
    id: record.id,
    relativePath: record.relativePath,
    filename: record.filename,
    extension: record.extension,
    language: record.language,
    content: record.content,
    isEntryFile: Boolean(record.isEntryFile),
  };
}

export function MultiFileWorkspace({ user }: { user: AccountUser }) {
  const { notify } = useToast();
  const { resolved } = useTheme();
  const [projectId, setProjectId] = useState<string>();
  const [title, setTitle] = useState('My learning project');
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [active, setActive] = useState('');
  const [entryFile, setEntryFile] = useState('index.html');
  const [tab, setTab] = useState<WorkspaceTab>('editor');
  const [status, setStatus] = useState('Preparing workspace');
  const [consoleLines, setConsoleLines] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const savedFileIds = useRef<Set<string>>(new Set());

  const current = files.find((file) => file.relativePath === active) ?? files[0];
  const currentLanguageConfig = current ? detectLanguageFromFilename(current.filename) : undefined;
  const currentLanguageComingSoon = Boolean(
    currentLanguageConfig && !isLanguageAvailable(currentLanguageConfig.displayName),
  );
  const isWebProject = files.some((file) => file.extension === '.html' || file.extension === '.htm');
  const totalBytes = useMemo(() => files.reduce((sum, file) => sum + new Blob([file.content]).size, 0), [files]);

  // Load only account-owned projects; local starter files are never presented
  // as a successful account load when the protected API is unavailable.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadError('');
      let hasUnsavedStarter = false;
      try {
        const projects = await listProjects();
        const existing = projects[0];
        if (existing) {
          const detail = await getProject(existing.id);
          if (cancelled) return;
          if (!detail) throw new Error('Your saved project could not be loaded from the account.');
          setProjectId(existing.id);
          setTitle(existing.title);
          const loaded = detail.files.map(toFileRecord);
          savedFileIds.current = new Set(loaded.flatMap((file) => file.id ? [file.id] : []));
          const seed = loaded.length ? loaded : WEB_STARTER;
          setFiles(seed);
          setActive(seed[0]?.relativePath ?? 'index.html');
          setEntryFile(existing.entryFile || seed.find((f) => f.isEntryFile)?.relativePath || 'index.html');
          if (!loaded.length) hasUnsavedStarter = true;
        } else {
          const created = await createProject({ title: 'My web learning project', primaryLanguage: 'HTML', entryFile: 'index.html' });
          if (cancelled) return;
          if (!created.ok) throw new Error(created.data.message || 'A new account project could not be created.');
          setProjectId(created.data.project.id);
          setFiles(WEB_STARTER);
          setActive('index.html');
          setEntryFile('index.html');
          hasUnsavedStarter = true;
        }
        setStatus(hasUnsavedStarter ? 'Starter files are unsaved — save to your account' : 'Ready');
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Your account workspace could not be loaded. No browser-local project was substituted.');
          setStatus('Account storage unavailable');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAttempt, notify]);

  // Render the sandboxed preview and pipe its console output back to us.
  useEffect(() => {
    if (!iframeRef.current || !isWebProject || tab !== 'preview') return;
    setStatus('Rendering preview');
    const runId = crypto.randomUUID();
    let source: string;
    try {
      source = buildSandboxDocument(files.map(({ relativePath, content }) => ({ relativePath, content })), entryFile);
    } catch (error) {
      setConsoleLines((lines) => [...lines, `[preview] ${error instanceof Error ? error.message : 'Preview failed.'}`]);
      setStatus('Preview unavailable');
      return;
    }
    const bridge = `<script>(()=>{const id=${JSON.stringify(runId)};for(const level of ['log','info','warn','error']){const old=console[level];console[level]=(...values)=>{parent.postMessage({source:'codementor-preview',runId:id,type:'console',level,text:values.map(String).join(' ')},'*');old(...values)}}window.addEventListener('error',e=>parent.postMessage({source:'codementor-preview',runId:id,type:'error',text:String(e.message)},'*'));window.addEventListener('unhandledrejection',e=>parent.postMessage({source:'codementor-preview',runId:id,type:'error',text:String(e.reason)},'*'));parent.postMessage({source:'codementor-preview',runId:id,type:'ready'},'*')})()</script>`;
    // injectIntoHead also covers documents written without a <head> element.
    iframeRef.current.srcdoc = injectIntoHead(source, bridge);

    const receive = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.source !== 'codementor-preview' || event.data?.runId !== runId) return;
      if (event.data.type === 'ready') setStatus('Preview ready');
      if (event.data.type === 'console') setConsoleLines((lines) => [...lines, `[${event.data.level}] ${event.data.text}`]);
      if (event.data.type === 'error') setConsoleLines((lines) => [...lines, `[error] ${event.data.text}`]);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [tab, entryFile, files, isWebProject]);

  const updateCurrent = (content: string) => {
    setFiles((items) => items.map((file) => (file.relativePath === active ? { ...file, content } : file)));
    setStatus('Unsaved changes');
  };

  const addFile = () => {
    const name = window.prompt('New file path (for example src/helper.c or styles.css)');
    if (!name || !isValidRelativePath(name) || files.some((file) => file.relativePath === name)) {
      return notify('Use a unique safe relative file path.', 'warning');
    }
    const extension = extensionOf(name);
    if (!ALLOWED_EXTENSIONS.includes(extension)) return notify('That file extension is not supported.', 'warning');
    const file: FileRecord = {
      relativePath: name,
      filename: name.split('/').pop() || name,
      extension,
      language: extension.slice(1).toUpperCase(),
      content: '',
    };
    setFiles((items) => [...items, file]);
    setActive(name);
    setStatus('Unsaved changes');
    notify('New file added.');
  };

  const removeFile = () => {
    if (!current) return;
    if (files.length <= 1) return notify('Keep at least one project file.', 'warning');
    if (!window.confirm(`Delete ${current.relativePath}?`)) return;
    setFiles((items) => items.filter((file) => file.relativePath !== current.relativePath));
    setActive(files.find((file) => file.relativePath !== current.relativePath)?.relativePath || '');
    setStatus('Unsaved changes');
  };

  const save = async (): Promise<boolean> => {
    if (!projectId) {
      notify('Create or load a project before saving.', 'warning');
      return false;
    }
    if (
      files.length > LIMITS.files ||
      totalBytes > LIMITS.projectBytes ||
      files.some((file) => new Blob([file.content]).size > LIMITS.fileBytes)
    ) {
      notify('Project exceeds the safe file or project size limit.', 'warning');
      return false;
    }
    setBusy(true);
    setStatus('Saving project');
    try {
      const projectUpdate = await updateProject(projectId, { title, entryFile });
      if (!projectUpdate.ok) throw new Error(projectUpdate.data.message || 'Project details could not be saved.');
      const retainedFileIds = new Set<string>();
      const newIds = new Map<string, string>();
      for (const file of files) {
        const isEntry = file.relativePath === entryFile;
        if (file.id) {
          const updated = await updateProjectFile(projectId, file.id, { content: file.content || '\n', isEntryFile: isEntry });
          if (!updated.ok) throw new Error(updated.data.message || `File ${file.relativePath} could not be updated.`);
          retainedFileIds.add(file.id);
        } else {
          const created = await createProjectFile(projectId, {
            relativePath: file.relativePath,
            filename: file.filename,
            language: file.language,
            content: file.content || '\n',
            isEntryFile: isEntry,
          });
          if (!created.ok) throw new Error(created.data.message || `File ${file.relativePath} could not be saved.`);
          retainedFileIds.add(created.data.file.id);
          newIds.set(file.relativePath, created.data.file.id);
        }
      }
      for (const oldId of savedFileIds.current) {
        if (retainedFileIds.has(oldId)) continue;
        const removed = await deleteProjectFile(projectId, oldId);
        if (!removed.ok) throw new Error(removed.data.message || 'A removed account file could not be deleted.');
      }
      savedFileIds.current = retainedFileIds;
      setFiles((currentFiles) => currentFiles.map((file) => {
        const id = newIds.get(file.relativePath);
        return id ? { ...file, id } : file;
      }));
      setStatus('Saved');
      notify('Project and files saved to your account.');
      return true;
    } catch (error) {
      setStatus('Save failed');
      notify(error instanceof Error ? error.message : 'Project could not be saved safely.', 'warning');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const exportZip = async () => {
    const zip = new JSZip();
    for (const file of files) zip.file(file.relativePath, file.content);
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/[^a-z0-9-_]+/gi, '-') || 'codementor-project'}.zip`;
    link.click();
    URL.revokeObjectURL(url);
    notify('Project ZIP exported.');
  };

  const importZip = async (input: File) => {
    if (input.size > LIMITS.projectBytes) return notify('ZIP is larger than the project limit.', 'warning');
    try {
      const zip = await JSZip.loadAsync(input);
      const imported: FileRecord[] = [];
      for (const [name, entry] of Object.entries(zip.files)) {
        if (entry.dir || !isValidRelativePath(name) || name.split('/').length > 6) throw new Error('Unsafe ZIP entry.');
        const extension = extensionOf(name);
        if (!ALLOWED_EXTENSIONS.includes(extension)) throw new Error('Unsupported ZIP file.');
        const content = await entry.async('string');
        if (new Blob([content]).size > LIMITS.fileBytes) throw new Error('ZIP file exceeds size limit.');
        imported.push({
          relativePath: name,
          filename: name.split('/').pop() || name,
          extension,
          language: extension.slice(1).toUpperCase(),
          content,
          isEntryFile: name === 'index.html',
        });
        if (imported.length > LIMITS.files) throw new Error('Too many ZIP files.');
      }
      if (!imported.length) throw new Error('ZIP contains no supported source files.');
      setFiles(imported);
      setActive(imported[0].relativePath);
      setEntryFile(imported.find((file) => file.relativePath === 'index.html')?.relativePath || imported[0].relativePath);
      notify('Safe project ZIP imported locally. Save to attach it to your account.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'ZIP import was rejected safely.', 'warning');
    }
  };

  const run = async () => {
    if (!current) return;
    const language = current.extension.slice(1).toLowerCase();
    const languageKey = ['cc', 'cxx', 'hpp'].includes(language) ? 'cpp' : language;
    if (currentLanguageComingSoon && currentLanguageConfig) {
      setTab('console');
      setConsoleLines((lines) => [
        ...lines,
        `${currentLanguageConfig.displayName} is coming soon and cannot be run yet.`,
      ]);
      setStatus('Coming soon');
      return;
    }
    if (!RUNNABLE_SECURE.has(languageKey) && !current.extension.startsWith('.html')) {
      setTab('console');
      setConsoleLines((lines) => [...lines, 'Secure execution is not configured for this language yet. Preview web files or use the Playground for Python and JavaScript.']);
      setStatus('Unavailable');
      return;
    }
    if (current.extension.startsWith('.html')) {
      setConsoleLines([]);
      setTab('preview');
      return;
    }
    if (!(await save())) return;
    setBusy(true);
    setStatus('Uploading to secure runner');
    try {
      const { ok, data } = await runProjectExecution({ projectId, language: languageKey, entryFile, stdin: '' });
      if (!ok) {
        setConsoleLines((lines) => [...lines, data.message || 'Secure execution is unavailable.']);
        setStatus('Unavailable');
      } else {
        setConsoleLines((lines) => [...lines, data.stdout || data.message || 'Secure execution response received.']);
        setStatus(data.status === 'unavailable' ? 'Unavailable' : data.status || 'Completed');
      }
      setTab('console');
    } catch {
      setConsoleLines((lines) => [...lines, 'Secure execution is unavailable. Local guidance remains available.']);
      setStatus('Unavailable');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="content-page">
        <div className="card" style={{ padding: 24 }}>Preparing your multi-file workspace…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="content-page">
        <div className="card" role="alert" style={{ padding: 24 }}>
          <h1>Account workspace unavailable</h1>
          <p>{loadError}</p>
          <Button onClick={() => { setLoading(true); setLoadAttempt((attempt) => attempt + 1); }}>Retry account load</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">AUTHENTICATED MULTI-FILE WORKSPACE</span>
          <h1>
            <input className="workspace-title-input" value={title} onChange={(e) => { setTitle(e.target.value); setStatus('Unsaved changes'); }} aria-label="Project title" />
          </h1>
          <p>Files are validated, owned by your account, and saved through the protected project API.</p>
        </div>
        <div className="heading-actions">
          <Button variant="soft" icon={Download} onClick={exportZip}>
            Export ZIP
          </Button>
          <label className="btn btn-soft">
            <Upload size={16} aria-hidden="true" /> Import ZIP
            <input hidden type="file" accept=".zip" onChange={(e) => e.target.files?.[0] && importZip(e.target.files[0])} />
          </label>
          <Button icon={Save} onClick={save} disabled={busy}>
            {busy ? 'Working…' : 'Save project'}
          </Button>
        </div>
      </div>

      <div className="multi-file-shell card">
        <aside className="file-explorer" aria-label="Project files">
          <div className="file-explorer-heading">
            <strong>FILES</strong>
            <div>
              <button type="button" title="New file" aria-label="New file" onClick={addFile}>
                <FilePlus2 size={15} />
              </button>
              <button type="button" title="Delete file" aria-label="Delete file" onClick={removeFile}>
                <Trash2 size={15} />
              </button>
            </div>
          </div>
          {files.map((file) => (
            <button
              key={file.relativePath}
              type="button"
              className={`file-item ${active === file.relativePath ? 'active' : ''}`}
              onClick={() => setActive(file.relativePath)}
            >
              <span>{file.relativePath}</span>
              {file.relativePath === entryFile ? <small>ENTRY</small> : null}
            </button>
          ))}
          <div className="file-limit">
            {files.length}/{LIMITS.files} files · {Math.ceil(totalBytes / 1024)} KB/{LIMITS.projectBytes / 1024} KB
          </div>
        </aside>

        <section className="multi-file-main">
          <div className="file-tabs">
            {files.map((file) => (
              <button
                key={file.relativePath}
                type="button"
                className={active === file.relativePath ? 'active' : ''}
                onClick={() => setActive(file.relativePath)}
              >
                {file.filename}
              </button>
            ))}
          </div>

          <div className="workspace-controls">
            <select value={entryFile} onChange={(e) => { setEntryFile(e.target.value); setStatus('Unsaved changes'); }} aria-label="Entry file">
              <option value="">No entry file</option>
              {files
                .filter((file) => ['.html', '.htm', '.c', '.cpp', '.cc', '.cxx', '.hpp', '.java'].includes(file.extension))
                .map((file) => (
                  <option key={file.relativePath} value={file.relativePath}>
                    Entry: {file.relativePath}
                  </option>
                ))}
            </select>
            <Pill tone={currentLanguageComingSoon ? 'neutral' : isWebProject ? 'green' : 'amber'}>
              {currentLanguageComingSoon && currentLanguageConfig
                ? `${currentLanguageConfig.displayName} coming soon`
                : isWebProject
                  ? 'Sandboxed Browser Preview'
                  : 'Secure remote runner required'}
            </Pill>
            <Button variant="soft" icon={Play} onClick={run} disabled={busy}>
              Run Code
            </Button>
          </div>

          <div className="file-mode-tabs" role="tablist" aria-label="Workspace view">
            {(['editor', 'console', 'details'] as WorkspaceTab[]).map((item) => (
              <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>
                {item === 'editor' ? 'Editor' : item === 'console' ? 'Console' : 'Execution Details'}
              </button>
            ))}
            {isWebProject ? (
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'preview'}
                className={tab === 'preview' ? 'active' : ''}
                onClick={() => {
                  setConsoleLines([]);
                  setTab('preview');
                }}
              >
                Preview
              </button>
            ) : null}
          </div>

          {tab === 'editor' && current ? (
            <div className="workspace-editor">
              <Editor
                height="520px"
                language={languageIdFor(current.extension)}
                value={current.content}
                onChange={(value) => updateCurrent(value ?? '')}
                theme={resolved === 'dark' ? 'codementor-dark' : 'codementor-light'}
                beforeMount={defineThemes}
                loading={<div className="editor-loading">Preparing the editor…</div>}
                options={{
                  minimap: { enabled: false },
                  automaticLayout: true,
                  fontSize: 14,
                  wordWrap: 'on',
                  tabSize: 4,
                  scrollBeyondLastLine: false,
                  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                }}
              />
            </div>
          ) : null}

          {tab === 'preview' ? <iframe ref={iframeRef} title="Sandboxed Browser Preview" sandbox={PREVIEW_IFRAME_SANDBOX} className="preview-frame" /> : null}

          {tab === 'console' ? (
            <div className="workspace-console">
              <div className="console-console-actions">
                <button type="button" onClick={() => setConsoleLines([])}>
                  <Trash2 size={14} /> Clear console
                </button>
                <span role="status" aria-live="polite">
                  {status}
                </span>
              </div>
              {consoleLines.length ? (
                consoleLines.map((line, index) => <pre key={index}>{line}</pre>)
              ) : (
                <p>Run the project to see stdout, stderr, compiler output, or preview messages here.</p>
              )}
            </div>
          ) : null}

          {tab === 'details' ? (
            <div className="execution-details">
              <p>
                <strong>Entry file:</strong> {entryFile || 'Not selected'}
              </p>
              <p>
                <strong>Project files:</strong> {files.length}
              </p>
              <p>
                <strong>Mode:</strong> {isWebProject ? 'Sandboxed Browser Preview' : 'Secure remote execution'}
              </p>
              <p>
                <strong>Restrictions:</strong> {PREVIEW_BLOCKED_MESSAGE}
              </p>
              <p>
                <strong>Limits:</strong> 3s CPU target · 256 MB provider memory target · 100 KB output · {LIMITS.files} files · {LIMITS.projectBytes / 1024} KB project.
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
