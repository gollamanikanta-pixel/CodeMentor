-- CodeMentor schema for Postgres (Supabase). Applied to the project as the
-- `codementor_initial_schema` migration; `npm run db:migrate` re-applies it
-- idempotently. Unquoted identifiers fold to lower case in Postgres; the data
-- layer (db/database.ts) maps result keys back to camelCase.

CREATE TABLE IF NOT EXISTS AppUser (
  id TEXT PRIMARY KEY,
  fullName TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  lastLoginAt TEXT
);

CREATE TABLE IF NOT EXISTS Session (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES AppUser(id) ON DELETE CASCADE,
  tokenHash TEXT NOT NULL UNIQUE,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  userAgent TEXT,
  ipMetadata TEXT
);

CREATE TABLE IF NOT EXISTS PasswordResetToken (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES AppUser(id) ON DELETE CASCADE,
  tokenHash TEXT NOT NULL UNIQUE,
  expiresAt TEXT NOT NULL,
  usedAt TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS UserSettings (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL UNIQUE REFERENCES AppUser(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'dark',
  fontSize INTEGER NOT NULL DEFAULT 14,
  wordWrap INTEGER NOT NULL DEFAULT 1,
  minimap INTEGER NOT NULL DEFAULT 0,
  reducedMotion INTEGER NOT NULL DEFAULT 0,
  explanationLevel TEXT NOT NULL DEFAULT 'Beginner',
  hintLevel TEXT NOT NULL DEFAULT 'Guided',
  defaultLanguage TEXT NOT NULL DEFAULT 'Python',
  autoVisuals INTEGER NOT NULL DEFAULT 1,
  autoQuizReadiness INTEGER NOT NULL DEFAULT 1,
  autosave INTEGER NOT NULL DEFAULT 1,
  aiDeepHelpEnabled INTEGER NOT NULL DEFAULT 1,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Project (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES AppUser(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  primaryLanguage TEXT NOT NULL,
  entryFile TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ProjectFile (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL REFERENCES Project(id) ON DELETE CASCADE,
  relativePath TEXT NOT NULL,
  filename TEXT NOT NULL,
  extension TEXT NOT NULL,
  language TEXT NOT NULL,
  content TEXT NOT NULL,
  isEntryFile INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE(projectId, relativePath)
);

CREATE TABLE IF NOT EXISTS ExecutionJob (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES AppUser(id) ON DELETE CASCADE,
  projectId TEXT REFERENCES Project(id) ON DELETE SET NULL,
  language TEXT NOT NULL,
  status TEXT NOT NULL,
  sourceSnapshotHash TEXT NOT NULL,
  input TEXT NOT NULL DEFAULT '',
  stdout TEXT NOT NULL DEFAULT '',
  stderr TEXT NOT NULL DEFAULT '',
  compileOutput TEXT NOT NULL DEFAULT '',
  providerJobId TEXT,
  executionTime DOUBLE PRECISION,
  memoryUsage DOUBLE PRECISION,
  exitCode INTEGER,
  createdAt TEXT NOT NULL,
  completedAt TEXT,
  failureReason TEXT
);

CREATE TABLE IF NOT EXISTS QuizHistory (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES AppUser(id) ON DELETE CASCADE,
  projectId TEXT REFERENCES Project(id) ON DELETE SET NULL,
  language TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  score INTEGER NOT NULL,
  totalQuestions INTEGER NOT NULL,
  percentage TEXT NOT NULL,
  conceptsToReview TEXT NOT NULL DEFAULT '[]',
  quizData TEXT,
  createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_user ON Session(userId);
CREATE INDEX IF NOT EXISTS idx_project_user ON Project(userId);
CREATE INDEX IF NOT EXISTS idx_file_project ON ProjectFile(projectId);
CREATE INDEX IF NOT EXISTS idx_execution_user ON ExecutionJob(userId);
CREATE INDEX IF NOT EXISTS idx_execution_project ON ExecutionJob(projectId);
CREATE INDEX IF NOT EXISTS idx_quiz_user ON QuizHistory(userId);
CREATE INDEX IF NOT EXISTS idx_quiz_project ON QuizHistory(projectId);
CREATE INDEX IF NOT EXISTS idx_reset_user ON PasswordResetToken(userId);

-- The API connects directly as a privileged role. Enabling RLS with no policies
-- means Supabase's public REST/GraphQL API (anon/authenticated keys) reads nothing.
ALTER TABLE AppUser ENABLE ROW LEVEL SECURITY;
ALTER TABLE Session ENABLE ROW LEVEL SECURITY;
ALTER TABLE PasswordResetToken ENABLE ROW LEVEL SECURITY;
ALTER TABLE UserSettings ENABLE ROW LEVEL SECURITY;
ALTER TABLE Project ENABLE ROW LEVEL SECURITY;
ALTER TABLE ProjectFile ENABLE ROW LEVEL SECURITY;
ALTER TABLE ExecutionJob ENABLE ROW LEVEL SECURITY;
ALTER TABLE QuizHistory ENABLE ROW LEVEL SECURITY;
