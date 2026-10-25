import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const source = resolve(fileURLToPath(new URL('..', import.meta.url)));
function mirror() { const scratch = mkdtempSync(join(tmpdir(), 'benchmark-safety-')), root = join(scratch, 'benchmark'); for (const file of ['scripts/init-workspace.mjs', 'scripts/runtime/launcher.mjs', 'scripts/runtime/limits.mjs', 'scripts/runtime/browser-check.mjs', 'COMMON.md', 'prompts/01-mission-control.md', 'prompts/02-orbital-lab.md', 'prompts/03-reactor-escape.md', 'fixtures/mission-control.json', 'starter/package.json', 'starter/pnpm-lock.yaml', 'starter/index.html', 'starter/src/main.js', 'starter/src/style.css', 'starter/.gitignore']) { mkdirSync(dirname(join(root, file)), { recursive: true }); copyFileSync(join(source, file), join(root, file)); } return { scratch, root }; }
const initialize = (root, dest, extra = []) => spawnSync(process.execPath, [join(root, 'scripts/init-workspace.mjs'), 'mission-control', dest, '--no-install', ...extra], { encoding: 'utf8' });
test('source boundary rejects symlink aliases with missing parents and ..cache', () => {
  const { scratch, root } = mirror(), alias = join(scratch, 'alias'); symlinkSync(root, alias, 'dir'); const nested = join(alias, 'not-created', 'workspace'); assert.notEqual(initialize(root, nested).status, 0); assert.equal(existsSync(join(root, 'not-created')), false);
  const cache = join(root, '..cache', 'workspace'); assert.notEqual(initialize(root, cache).status, 0); assert.equal(existsSync(join(root, '..cache')), false);
});
test('files and dangling symlinks remain intact', () => {
  const { scratch, root } = mirror(), file = join(scratch, 'file'), link = join(scratch, 'dangling'); writeFileSync(file, 'keep'); symlinkSync(join(scratch, 'missing'), link);
  for (const dest of [file, link]) assert.notEqual(initialize(root, dest).status, 0); assert.equal(readFileSync(file, 'utf8'), 'keep'); assert.equal(existsSync(join(scratch, 'missing')), false);
});
test('model IDs retain slashes and printed command is shell quoted', () => {
  const { root, scratch } = mirror(), model = "local/vendor/model;echo'unsafe", dest = join(scratch, 'workspace'); const result = initialize(root, dest, ['--model', model]); assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(readFileSync(join(dest, '.benchmark/run.json'))).requestedModel, model); assert.match(result.stdout, /'local\/vendor\/model;echo'\\''unsafe'/);
});
test('option-shaped destination and duplicate/unknown flags never create a workspace', () => {
  const { root, scratch } = mirror(); assert.notEqual(spawnSync(process.execPath, [join(root, 'scripts/init-workspace.mjs'), 'mission-control', '--no-install'], { cwd: scratch, encoding: 'utf8' }).status, 0); assert.equal(existsSync(join(scratch, '--no-install')), false);
  for (const extra of [['--wat'], ['--no-browser', '--no-browser'], ['--browser-executable']]) { const dest = join(scratch, String(Math.random())); assert.notEqual(initialize(root, dest, extra).status, 0); assert.equal(existsSync(dest), false); }
});
