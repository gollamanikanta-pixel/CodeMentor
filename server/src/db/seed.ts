import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db, ensureSchema, now, pool } from './database.js';

/**
 * Idempotent development seed. Creates one demo learner with a starter project
 * and a little quiz history so a fresh checkout has something to look at.
 *
 * This is development data only. The demo credentials are intentionally public
 * and printed below — never reuse them in production.
 */
const DEMO_EMAIL = 'demo@codementor.local';
const DEMO_PASSWORD = 'learner123';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to seed the public demo account in production.');
}

await ensureSchema();

const existing = await db.prepare('SELECT id FROM AppUser WHERE email=?').get<{ id: string }>(DEMO_EMAIL);

if (existing) {
  console.log(`Demo learner already present (${DEMO_EMAIL}). Nothing to seed.`);
  await pool.end();
} else {
  const userId = crypto.randomUUID();
  const stamp = now();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  await db.transaction(async (tx) => {
    await tx.prepare('INSERT INTO AppUser (id,fullName,email,passwordHash,createdAt,updatedAt,lastLoginAt) VALUES (?,?,?,?,?,?,?)').run(
      userId,
      'Demo Learner',
      DEMO_EMAIL,
      passwordHash,
      stamp,
      stamp,
      stamp,
    );
    await tx.prepare('INSERT INTO UserSettings (id,userId,updatedAt) VALUES (?,?,?)').run(crypto.randomUUID(), userId, stamp);

    const projectId = crypto.randomUUID();
    await tx.prepare('INSERT INTO Project (id,userId,title,primaryLanguage,entryFile,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)').run(
      projectId,
      userId,
      'Class average explorer',
      'Python',
      'main.py',
      stamp,
      stamp,
    );

    const files: Array<[string, string, string, string, number]> = [
      ['main.py', 'main.py', '.py', 'Python', 1],
      [
        'helpers.py',
        'helpers.py',
        '.py',
        'Python',
        0,
      ],
    ];
    const contents: Record<string, string> = {
      'main.py': 'from helpers import average\n\nmarks = [82, 91, 76, 88]\nprint("Class average:", average(marks))\n',
      'helpers.py': 'def average(scores):\n    total = sum(scores)\n    return total / len(scores)\n',
    };
    for (const [relativePath, filename, extension, language, isEntry] of files) {
      await tx.prepare(
        'INSERT INTO ProjectFile (id,projectId,relativePath,filename,extension,language,content,isEntryFile,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
      ).run(crypto.randomUUID(), projectId, relativePath, filename, extension, language, contents[relativePath], isEntry, stamp, stamp);
    }

    for (const record of [
      { difficulty: 'Beginner', score: 4, total: 5, percentage: '80%', concepts: '["Functions","Lists"]' },
      { difficulty: 'Intermediate', score: 7, total: 10, percentage: '70%', concepts: '["Loops","Conditions"]' },
    ]) {
      await tx.prepare(
        'INSERT INTO QuizHistory (id,userId,projectId,language,difficulty,score,totalQuestions,percentage,conceptsToReview,quizData,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      ).run(
        crypto.randomUUID(),
        userId,
        projectId,
        'Python',
        record.difficulty,
        record.score,
        record.total,
        record.percentage,
        record.concepts,
        null,
        stamp,
      );
    }

  });

  console.log('CodeMentor development seed complete.');
  console.log(`  demo email:    ${DEMO_EMAIL}`);
  console.log(`  demo password: ${DEMO_PASSWORD}`);
  console.log('  These credentials are for local development only.');
  await pool.end();
}
