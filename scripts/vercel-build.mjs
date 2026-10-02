// Builds the Vercel "Build Output API" bundle:
//   .vercel/output/static            <- client/dist (the React app)
//   .vercel/output/functions/api.func <- the Express API as one bundled function
// Usage: node scripts/vercel-build.mjs [--functions-only]
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, '.vercel', 'output');
const functionsOnly = process.argv.includes('--functions-only');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'functions', 'api.func'), { recursive: true });

if (!functionsOnly) {
  execSync('npm run build', { cwd: root, stdio: 'inherit' });
  fs.cpSync(path.join(root, 'client', 'dist'), path.join(out, 'static'), { recursive: true });
} else {
  fs.mkdirSync(path.join(out, 'static'), { recursive: true });
}

await build({
  entryPoints: [path.join(root, 'server', 'src', 'vercel.ts')],
  outfile: path.join(out, 'functions', 'api.func', 'index.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  // pg optionally requires the native driver inside a try/catch.
  external: ['pg-native'],
  // Some bundled CommonJS dependencies call require() at runtime.
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: 'info',
});

fs.writeFileSync(
  path.join(out, 'functions', 'api.func', '.vc-config.json'),
  JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', maxDuration: 30 }, null, 2),
);

fs.writeFileSync(
  path.join(out, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '/api/(.*)', dest: '/api' },
        { handle: 'filesystem' },
        // SPA history fallback for client-side routes (/dashboard, /login, ...).
        { src: '/(.*)', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
);
console.log('Vercel output ready:', path.relative(root, out));
