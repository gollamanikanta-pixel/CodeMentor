import { useMemo, useState } from 'react';
import { ArchiveRestore, CheckCircle2 } from 'lucide-react';
import { Button } from './ui';
import { useAuth } from '../auth/AuthContext';
import { createProject, createProjectFile, createQuiz, deleteProject } from '../api/client';
import { getLanguage, languageNames } from '../data/languages';
import { readLocal, storage, writeLocal, STORAGE_KEYS } from '../storage/localStorage';
import { useToast } from '../hooks/useToast';
import type { LanguageName, QuizRecord, StoredProject } from '../types';

type ImportProgress = {
  projects: string[];
  quizzes: string[];
  draft: boolean;
};

function readProgress(userId: string): ImportProgress {
  const imports = readLocal<Record<string, Partial<ImportProgress>>>(STORAGE_KEYS.accountImports, {});
  const stored = imports[userId] ?? {};
  return {
    projects: Array.isArray(stored.projects) ? stored.projects.filter((id): id is string => typeof id === 'string') : [],
    quizzes: Array.isArray(stored.quizzes) ? stored.quizzes.filter((id): id is string => typeof id === 'string') : [],
    draft: stored.draft === true,
  };
}

function saveProgress(userId: string, progress: ImportProgress) {
  const imports = readLocal<Record<string, ImportProgress>>(STORAGE_KEYS.accountImports, {});
  writeLocal(STORAGE_KEYS.accountImports, { ...imports, [userId]: progress });
}

function isLanguageName(value: unknown): value is LanguageName {
  return typeof value === 'string' && languageNames.includes(value as LanguageName);
}

type ImportableDraft = { code: string; language: LanguageName; projectTitle?: string; stdin?: string };

function isImportableDraft(value: unknown): value is ImportableDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Record<string, unknown>;
  return (
    typeof draft.code === 'string' &&
    Boolean(draft.code.trim()) &&
    isLanguageName(draft.language) &&
    (typeof draft.projectTitle === 'string' || draft.projectTitle === undefined) &&
    (typeof draft.stdin === 'string' || draft.stdin === undefined)
  );
}

async function importProject(title: string, language: StoredProject['language'], code: string, stdin = '') {
  if (!code.trim()) throw new Error(`“${title}” has no source code to import.`);
  const config = getLanguage(language);
  const extension = config?.extensions[0] ?? '.txt';
  const filename = `${language === 'Java' ? 'Main' : 'main'}${extension}`;
  const created = await createProject({
    title: title.trim().slice(0, 120) || 'Imported learning project',
    primaryLanguage: language,
    entryFile: filename,
    stdin,
  });
  if (!created.ok) throw new Error(created.data.message || `“${title}” could not be imported.`);

  try {
    const file = await createProjectFile(created.data.project.id, {
      relativePath: filename,
      filename,
      language,
      content: code,
      isEntryFile: true,
    });
    if (!file.ok) throw new Error(file.data.message || `Source for “${title}” could not be imported.`);
  } catch (cause) {
    const deleted = await deleteProject(created.data.project.id).catch(() => null);
    if (!deleted?.ok) {
      throw new Error(`“${title}” was partially imported and its empty account project could not be removed.`);
    }
    throw cause;
  }
}

export function LocalDataImport({ onImported }: { onImported?: () => void }) {
  const { user } = useAuth();
  const { notify } = useToast();
  const [importing, setImporting] = useState(false);
  const [progressVersion, setProgressVersion] = useState(0);
  const [error, setError] = useState('');

  const local = useMemo(() => {
    if (!user) return null;
    const progress = readProgress(user.id);
    const projects = storage.readProjects().filter(
      (item): item is StoredProject =>
        Boolean(
          item &&
            typeof item.id === 'string' &&
            typeof item.title === 'string' &&
          isLanguageName(item.language) &&
          typeof item.code === 'string' &&
          typeof item.stdin === 'string',
        ) && !progress.projects.includes(item.id),
    );
    const quizzes = storage.readQuizHistory().filter(
      (item): item is QuizRecord =>
        Boolean(
          item &&
            typeof item.id === 'string' &&
            typeof item.project === 'string' &&
            isLanguageName(item.language) &&
            typeof item.difficulty === 'string' &&
            Number.isFinite(item.score) &&
            Number.isFinite(item.total) &&
            typeof item.percentage === 'string' &&
            Array.isArray(item.conceptsToReview),
        ) && !progress.quizzes.includes(item.id),
    );
    const draft = storage.readDraft();
    const validDraft = isImportableDraft(draft) ? draft : null;
    return { projects, quizzes, draft: validDraft && !progress.draft ? validDraft : null };
  }, [user, progressVersion]);

  if (!user || !local) return null;

  const total = local.projects.length + local.quizzes.length + (local.draft ? 1 : 0);
  if (!total && !error) return null;

  const runImport = async () => {
    const summary = [
      `${local.projects.length} saved project${local.projects.length === 1 ? '' : 's'}`,
      `${local.quizzes.length} quiz result${local.quizzes.length === 1 ? '' : 's'}`,
      `${local.draft ? 1 : 0} working draft`,
    ].join(', ');
    if (!window.confirm(`Copy ${summary} from this browser into ${user.fullName}'s account? Existing browser data will remain unchanged. Source code will be uploaded to your account.`)) {
      return;
    }

    setImporting(true);
    setError('');
    const progress = readProgress(user.id);
    try {
      for (const project of local.projects) {
        await importProject(project.title, project.language, project.code, project.stdin);
        progress.projects = [...progress.projects, project.id];
        saveProgress(user.id, progress);
        setProgressVersion((value) => value + 1);
      }

      if (local.draft) {
        await importProject(
          local.draft.projectTitle?.trim() || 'Imported learning draft',
          local.draft.language,
          local.draft.code,
          local.draft.stdin ?? '',
        );
        progress.draft = true;
        saveProgress(user.id, progress);
        setProgressVersion((value) => value + 1);
      }

      for (const quiz of local.quizzes) {
        const saved = await createQuiz({
          project: quiz.project,
          language: quiz.language,
          difficulty: quiz.difficulty,
          score: quiz.score,
          total: quiz.total,
          percentage: quiz.percentage,
          conceptsToReview: quiz.conceptsToReview,
          date: Number.isNaN(Date.parse(quiz.date)) ? undefined : new Date(quiz.date).toISOString(),
        });
        if (!saved.ok) throw new Error(saved.data.message || `Quiz result for “${quiz.project}” could not be imported.`);
        progress.quizzes = [...progress.quizzes, quiz.id];
        saveProgress(user.id, progress);
        setProgressVersion((value) => value + 1);
      }

      notify('Local projects, draft, and quiz history were copied to your account. Browser copies were kept.', 'success');
      onImported?.();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Some local data could not be imported.';
      setError(`${message} Completed items are marked so you can retry without duplicating them.`);
      notify(message, 'warning');
    } finally {
      setImporting(false);
    }
  };

  return (
    <section className="card" aria-label="Import browser data">
      <div className="card-heading">
        <div>
          <h2>Import data from this browser</h2>
          <p>
            {total
              ? `${local.projects.length} project${local.projects.length === 1 ? '' : 's'}, ${local.quizzes.length} quiz result${local.quizzes.length === 1 ? '' : 's'}, and ${local.draft ? 'a' : 'no'} working draft are ready to copy.`
              : 'All local items currently available here were imported.'}
          </p>
        </div>
        {total ? (
          <Button icon={ArchiveRestore} disabled={importing} onClick={() => void runImport()}>
            {importing ? 'Importing…' : 'Import local data'}
          </Button>
        ) : (
          <CheckCircle2 aria-label="Import complete" />
        )}
      </div>
      <p className="muted">
        Import is explicit and keeps browser copies.         Project source and saved standard input are uploaded. Browser copies stay unchanged; old AI explanations and full quiz questions are not available in the local history records.
      </p>
      {error ? <p role="alert" className="ai-error">{error}</p> : null}
    </section>
  );
}
