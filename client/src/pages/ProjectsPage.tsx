import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, FileCode2, FolderOpen, LayoutGrid, List, Plus, Search, Trash2 } from 'lucide-react';
import { Button, EmptyState, Pill } from '../components/ui';
import { useToast } from '../hooks/useToast';
import {
  duplicateProject,
  exportProject,
  listProjects,
  removeProject,
  renameProject,
} from '../projects/projectStore';
import { languageNames, languageOptionLabel } from '../data/languages';
import type { StoredProject } from '../types';

export function ProjectsPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [projects, setProjects] = useState<StoredProject[]>(() => listProjects());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const visible = useMemo(
    () =>
      projects.filter(
        (project) =>
          (!query || project.title.toLowerCase().includes(query.toLowerCase())) &&
          (filter === 'All' || project.language === filter),
      ),
    [projects, query, filter],
  );

  const handleDelete = (project: StoredProject) => {
    if (!window.confirm(`Delete “${project.title}” from this browser?`)) return;
    setProjects(removeProject(project.id));
    notify('Project deleted locally.', 'info');
  };

  const handleRename = (project: StoredProject) => {
    const next = window.prompt('Rename project', project.title);
    if (!next || next === project.title) return;
    setProjects(renameProject(project.id, next));
    notify('Project renamed locally.', 'info');
  };

  return (
    <div className="content-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR LIBRARY</span>
          <h1>My Projects</h1>
          <p>Keep your practice programs organized and return to them anytime.</p>
        </div>
        <Button icon={Plus} onClick={() => navigate('/playground')}>
          New project
        </Button>
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

      {visible.length ? (
        <div className={view === 'grid' ? 'project-grid' : 'project-list'}>
          {visible.map((project) => (
            <article className="saved-project card" key={project.id}>
              <div className="project-card-top">
                <span className="file-badge blue">
                  <FileCode2 size={19} aria-hidden="true" />
                </span>
                <button className="more" aria-label={`Delete ${project.title}`} onClick={() => handleDelete(project)}>
                  <Trash2 size={15} />
                </button>
              </div>
              <h3>{project.title}</h3>
              <pre className="project-code">{project.code.slice(0, 140) || '// empty project'}</pre>
              <div className="project-card-footer">
                <Pill tone="neutral">{project.language}</Pill>
                <span>{new Date(project.updatedAt).toLocaleString()}</span>
              </div>
              <div className="project-card-actions">
                <button onClick={() => navigate('/playground')}>
                  Open <ArrowRight size={13} aria-hidden="true" />
                </button>
                <button onClick={() => handleRename(project)}>Rename</button>
                <button
                  onClick={() => {
                    setProjects(duplicateProject(project.id));
                    notify('Project duplicated locally.', 'info');
                  }}
                >
                  Duplicate
                </button>
                <button onClick={() => exportProject(project)}>Export</button>
                <button onClick={() => handleDelete(project)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="card">
          <EmptyState
            icon={FolderOpen}
            title="Your saved projects will appear here."
            action={
              <Button icon={Plus} onClick={() => navigate('/playground')}>
                Start a project
              </Button>
            }
          >
            Save a program from the Playground and it will be kept safely in this browser.
          </EmptyState>
        </div>
      )}
    </div>
  );
}
