import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, FileCode2, FolderOpen, LayoutGrid, List, Plus, Search, Trash2 } from 'lucide-react';
import { Button, EmptyState, Pill } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import {
  createProject,
  createProjectFile,
  deleteProject,
  getProject,
  listProjects as listAccountProjects,
  updateProject,
  type ProjectRecord,
} from '../api/client';
import { useToast } from '../hooks/useToast';
import {
  duplicateProject,
  exportProject,
  listProjects,
  removeProject,
  renameProject,
} from '../projects/projectStore';
import { languageNames, languageOptionLabel } from '../data/languages';
import type { LanguageName, StoredProject } from '../types';

type ProjectSummary = {
  id: string;
  title: string;
  language: string;
  updatedAt: string;
};

function localSummary(project: StoredProject): ProjectSummary {
  return { id: project.id, title: project.title, language: project.language, updatedAt: project.updatedAt };
}

function accountSummary(project: ProjectRecord): ProjectSummary {
  return {
    id: project.id,
    title: project.title,
    language: project.primaryLanguage,
    updatedAt: project.updatedAt,
  };
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notify } = useToast();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [synced, setSynced] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    if (!user) {
      setProjects(listProjects().map(localSummary));
      setSynced(false);
      setLoading(false);
      return;
    }
    try {
      const records = await listAccountProjects();
      setProjects(records.map(accountSummary));
      setSynced(true);
    } catch {
      setProjects([]);
      setSynced(false);
      setError('Your account projects could not be loaded. Local browser projects are not shown as account data.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const visible = useMemo(
    () =>
      projects.filter(
        (project) =>
          (!query || project.title.toLowerCase().includes(query.toLowerCase())) &&
          (filter === 'All' || project.language === filter),
      ),
    [projects, query, filter],
  );

  const handleDelete = async (project: ProjectSummary) => {
    const location = user ? 'your account' : 'this browser';
    if (!window.confirm(`Delete “${project.title}” from ${location}?`)) return;
    if (!user) {
      setProjects(removeProject(project.id).map(localSummary));
      notify('Project deleted from this browser.', 'info');
      return;
    }
    setBusyId(project.id);
    try {
      const response = await deleteProject(project.id);
      if (!response.ok) {
        notify(response.data.message || 'Project could not be deleted from your account.', 'warning');
        return;
      }
      setProjects((current) => current.filter((item) => item.id !== project.id));
      notify('Project deleted from your account.', 'info');
    } catch {
      notify('Project could not be deleted from your account. No local fallback was used.', 'warning');
    } finally {
      setBusyId('');
    }
  };

  const handleRename = async (project: ProjectSummary) => {
    const next = window.prompt('Rename project', project.title)?.trim();
    if (!next || next === project.title) return;
    if (!user) {
      setProjects(renameProject(project.id, next).map(localSummary));
      notify('Project renamed in this browser.', 'info');
      return;
    }
    setBusyId(project.id);
    try {
      const response = await updateProject(project.id, { title: next });
      if (!response.ok) {
        notify(response.data.message || 'Project could not be renamed.', 'warning');
        return;
      }
      setProjects((current) => current.map((item) => item.id === project.id ? { ...item, title: next } : item));
      notify('Project renamed in your account.', 'success');
    } catch {
      notify('Project could not be renamed in your account. No local fallback was used.', 'warning');
    } finally {
      setBusyId('');
    }
  };

  const handleDuplicate = async (project: ProjectSummary) => {
    if (!user) {
      setProjects(duplicateProject(project.id).map(localSummary));
      notify('Project duplicated in this browser.', 'info');
      return;
    }
    setBusyId(project.id);
    let duplicateId: string | undefined;
    try {
      const detail = await getProject(project.id);
      if (!detail) throw new Error('Project source could not be loaded.');
      const created = await createProject({
        title: `${detail.project.title} copy`.slice(0, 120),
        primaryLanguage: detail.project.primaryLanguage,
        entryFile: detail.project.entryFile || undefined,
      });
      if (!created.ok) throw new Error(created.data.message || 'Project could not be duplicated.');
      duplicateId = created.data.project.id;
      for (const file of detail.files) {
        const saved = await createProjectFile(created.data.project.id, {
          relativePath: file.relativePath,
          filename: file.filename,
          language: file.language,
          content: file.content,
          isEntryFile: Boolean(file.isEntryFile),
        });
        if (!saved.ok) {
          throw new Error(saved.data.message || 'Project files could not be duplicated.');
        }
      }
      await reload();
      notify('Project duplicated to your account.', 'success');
    } catch (cause) {
      if (duplicateId) await deleteProject(duplicateId).catch(() => undefined);
      notify(cause instanceof Error ? cause.message : 'Project could not be duplicated.', 'warning');
    } finally {
      setBusyId('');
    }
  };

  const handleExport = async (project: ProjectSummary) => {
    if (!user) {
      const localProject = listProjects().find((item) => item.id === project.id);
      if (localProject) exportProject(localProject);
      return;
    }
    setBusyId(project.id);
    try {
      const detail = await getProject(project.id);
      const entry = detail?.files.find((file) => file.relativePath === detail.project.entryFile) ?? detail?.files[0];
      if (!detail || !entry) throw new Error('This project does not have a saved source file to export.');
      exportProject({
        id: detail.project.id,
        title: detail.project.title,
        language: detail.project.primaryLanguage as LanguageName,
        code: entry.content,
        stdin: '',
        updatedAt: detail.project.updatedAt,
      });
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Project could not be exported.', 'warning');
    } finally {
      setBusyId('');
    }
  };

  const openProject = (project: ProjectSummary) => {
    navigate(user ? `/playground?projectId=${encodeURIComponent(project.id)}` : '/playground');
  };

  return (
    <div className="content-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR LIBRARY</span>
          <h1>My Projects</h1>
          <p>{user ? 'Your saved source files are stored with your account.' : 'Local projects stay in this browser.'}</p>
        </div>
        <div>
          <Pill tone={synced ? 'green' : 'neutral'}>{user ? (synced ? 'Account synced' : 'Account storage') : 'Browser only'}</Pill>
          <Button icon={Plus} onClick={() => navigate('/playground')}>
            New project
          </Button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-input">
          <Search size={16} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects" aria-label="Search projects" />
        </div>
        <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter by language">
          <option>All</option>
          {languageNames.map((name) => (
            <option key={name} value={name}>{languageOptionLabel(name)}</option>
          ))}
        </select>
        <div className="view-toggle" role="group" aria-label="View mode">
          <button className={view === 'grid' ? 'active' : ''} aria-label="Grid view" onClick={() => setView('grid')}>
            <LayoutGrid size={15} />
          </button>
          <button className={view === 'list' ? 'active' : ''} aria-label="List view" onClick={() => setView('list')}>
            <List size={15} />
          </button>
        </div>
      </div>

      {error ? <p className="ai-error" role="alert">{error} <button onClick={() => void reload()}>Try again</button></p> : null}
      {loading ? <div className="card" role="status">Loading projects…</div> : null}
      {!loading && visible.length ? (
        <div className={view === 'grid' ? 'project-grid' : 'project-list'}>
          {visible.map((project) => (
            <article className="saved-project card" key={project.id}>
              <div className="project-card-top">
                <span className="file-badge blue">
                  <FileCode2 size={19} aria-hidden="true" />
                </span>
                <button disabled={busyId === project.id} className="more" aria-label={`Delete ${project.title}`} onClick={() => void handleDelete(project)}>
                  <Trash2 size={15} />
                </button>
              </div>
              <h3>{project.title}</h3>
              <p className="project-code">{user ? 'Source file saved to your account' : 'Source saved in this browser'}</p>
              <div className="project-card-footer">
                <Pill tone="neutral">{project.language}</Pill>
                <span>{project.updatedAt ? new Date(project.updatedAt).toLocaleString() : 'Recently saved'}</span>
              </div>
              <div className="project-card-actions">
                <button onClick={() => openProject(project)}>Open <ArrowRight size={13} aria-hidden="true" /></button>
                <button disabled={busyId === project.id} onClick={() => void handleRename(project)}>Rename</button>
                <button disabled={busyId === project.id} onClick={() => void handleDuplicate(project)}>Duplicate</button>
                <button disabled={busyId === project.id} onClick={() => void handleExport(project)}>Export</button>
                <button disabled={busyId === project.id} onClick={() => void handleDelete(project)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      ) : !loading && !error ? (
        <div className="card">
          <EmptyState
            icon={FolderOpen}
            title="No saved projects yet"
            action={
              <Button icon={Plus} onClick={() => navigate('/playground')}>
                Start a project
              </Button>
            }
          >
            Save source from the Playground and it will be stored {user ? 'with your account' : 'in this browser'}.
          </EmptyState>
        </div>
      ) : null}
    </div>
  );
}
