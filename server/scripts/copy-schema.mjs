import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(serverRoot, 'dist', 'db');

mkdirSync(outputDirectory, { recursive: true });
copyFileSync(
  path.join(serverRoot, 'src', 'db', 'schema.sql'),
  path.join(outputDirectory, 'schema.sql'),
);
