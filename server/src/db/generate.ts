import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * CodeMentor uses plain SQL, not an ORM, so there is nothing to code-generate.
 * `db:generate` therefore validates the schema: it applies `schema.sql` to a
 * throwaway in-memory database and reports the tables and columns it declares.
 * A malformed statement fails here instead of at first request.
 */
const schemaPath = path.resolve(process.cwd(), 'src/db/schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

const probe = new DatabaseSync(':memory:');
probe.exec(schema);

const tables = probe
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all() as { name: string }[];

for (const { name } of tables) {
  const columns = probe.prepare(`PRAGMA table_info(${name})`).all() as { name: string }[];
  console.log(`${name} (${columns.length} columns): ${columns.map((column) => column.name).join(', ')}`);
}
probe.close();

console.log(`CodeMentor schema validated: ${tables.length} tables.`);
