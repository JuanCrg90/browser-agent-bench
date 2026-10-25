import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));

test('publication excludes generated/private artifacts without hiding maintained source', t => {
  const scratch = mkdtempSync(join(tmpdir(), 'benchmark-publication-'));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  const git = args => spawnSync('git', ['-c', 'core.excludesFile=/dev/null', '-c', 'init.templateDir=', ...args], { cwd: scratch, encoding: 'utf8' });
  const initialized = git(['init', '--quiet']);
  assert.equal(initialized.status, 0, initialized.stderr);
  copyFileSync(join(root, '.gitignore'), join(scratch, '.gitignore'));
  const privatePaths = [
    '.benchmark/run.json', '.benchmark/tool-events.jsonl', '.playwright-cli/page.png',
    '.pi/auth.json', '.pi/mcp.json',
    'starter/dist/index.html', 'starter/node_modules/vite/package.json',
    'reports/historical.md', 'benchmark-runs/example/src/main.js',
    'sessions/example.jsonl', '.env', '.env.local', 'server.log', 'capture.har',
    'private.pem', 'private.key', 'id_ed25519',
  ];
  const publicPaths = [
    'LICENSE', 'README.md', '.env.example', 'package.json', 'pnpm-lock.yaml',
    'EVALUATION.md', 'RESULTS.md', 'prompts/01-mission-control.md',
    'fixtures/mission-control.json', 'scripts/runtime/launcher.mjs',
    'starter/package.json', 'starter/pnpm-lock.yaml', 'starter/src/main.js',
    '.github/workflows/ci.yml', 'tests/publication.test.mjs',
  ];
  const checked = spawnSync('git', ['-c', 'core.excludesFile=/dev/null', 'check-ignore', '--stdin'], {
    cwd: scratch, input: [...privatePaths, ...publicPaths].join('\n') + '\n', encoding: 'utf8',
  });
  assert.equal(checked.status, 0, checked.stderr);
  assert.deepEqual(checked.stdout.trim().split('\n').sort(), privatePaths.sort());
});

test('source-only package declares MIT and the license covers redistribution', () => {
  const metadata = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(metadata.license, 'MIT');
  assert.equal(metadata.private, true);
  assert.equal(metadata.packageManager, 'pnpm@12.14.0');
  const license = readFileSync(join(root, 'LICENSE'), 'utf8');
  assert.match(license, /MIT License/);
  assert.match(license, /Copyright \(c\) \d{4} Juan C\. Ruiz/);
  assert.match(license, /permission notice shall be included/);
});

test('public onboarding documentation has valid local Markdown links', () => {
  const documents = ['README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'THIRD_PARTY.md', 'docs/SETUP.md', 'docs/VERIFICATION.md'];
  for (const name of documents) {
    const file = join(root, name);
    for (const match of readFileSync(file, 'utf8').matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = match[1];
      if (/^(?:[a-z]+:|#)/i.test(target)) continue;
      const path = decodeURIComponent(target.split('#')[0]);
      assert.ok(existsSync(join(dirname(file), path)), `${name}: missing ${target}`);
    }
  }
});
