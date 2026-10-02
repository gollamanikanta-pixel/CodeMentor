import fs from 'node:fs';
import path from 'node:path';

/**
 * CodeMentor uses plain SQL, not an ORM, so there is nothing to code-generate.
 * `db:generate` validates `schema.sql` offline: it lists every table and column
 * it declares and fails if a table has no primary key.
 */
const schema = fs.readFileSync(path.resolve(process.cwd(), 'src/db/schema.sql'), 'utf8');
const blocks = [...schema.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\n\);/g)];
if (blocks.length === 0) throw new Error('No tables found in schema.sql');

for (const [, name, body] of blocks) {
  const columns = body
    .split('\n')
    .map((line) => line.trim().match(/^(\w+)\s+(TEXT|INTEGER|DOUBLE PRECISION)\b/)?.[1])
    .filter((column): column is string => Boolean(column));
  if (!/PRIMARY KEY/.test(body)) throw new Error(`${name} has no primary key`);
  console.log(`${name} (${columns.length} columns): ${columns.join(', ')}`);
}
console.log(`CodeMentor schema validated: ${blocks.length} tables.`);
