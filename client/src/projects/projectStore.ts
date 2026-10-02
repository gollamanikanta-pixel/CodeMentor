import { readLocal, writeLocal, STORAGE_KEYS } from '../storage/localStorage';
import type { StoredProject } from '../types';

export function listProjects(): StoredProject[] {
  return readLocal<StoredProject[]>(STORAGE_KEYS.projects, []);
}

export function saveProject(project: StoredProject): StoredProject[] {
  const next = [project, ...listProjects().filter((item) => item.title !== project.title)];
  writeLocal(STORAGE_KEYS.projects, next.slice(0, 100));
  return next;
}

export function addProject(project: StoredProject): StoredProject[] {
  const next = [project, ...listProjects()].slice(0, 100);
  writeLocal(STORAGE_KEYS.projects, next);
  return next;
}

export function duplicateProject(id: string): StoredProject[] {
  const source = listProjects().find((item) => item.id === id);
  if (!source) return listProjects();
  return addProject({
    ...source,
    id: crypto.randomUUID(),
    title: `${source.title} copy`,
    updatedAt: new Date().toISOString(),
  });
}

export function renameProject(id: string, title: string): StoredProject[] {
  const next = listProjects().map((item) =>
    item.id === id ? { ...item, title, updatedAt: new Date().toISOString() } : item,
  );
  writeLocal(STORAGE_KEYS.projects, next);
  return next;
}

export function removeProject(id: string): StoredProject[] {
  const next = listProjects().filter((item) => item.id !== id);
  writeLocal(STORAGE_KEYS.projects, next);
  return next;
}

export function exportProject(project: StoredProject): void {
  const blob = new Blob(
    [`// ${project.title}\n// CodeMentor project export (${project.language})\n\n${project.code}\n`],
    { type: 'text/plain;charset=utf-8' },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${project.title.replace(/[^\w.-]+/g, '-') || 'codementor-project'}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}
