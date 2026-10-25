import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url))); const cli = join(root, 'scripts/init-workspace.mjs');
const scratch = () => mkdtempSync(join(tmpdir(), 'browser-benchmark-'));
const run = (args, options = {}) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', ...options });

test('creates exact frozen workspace and metadata', () => {
  const dir = scratch(), dest = join(dir, "workspace's copy"); const result = run(['mission-control', dest, '--no-install', '--no-browser']);
  assert.equal(result.status, 0, result.stderr); const meta = JSON.parse(readFileSync(join(dest, '.benchmark/run.json')));
  assert.deepEqual(readFileSync(join(dest, 'package.json')), readFileSync(join(root, 'starter/package.json')));
  assert.deepEqual(readFileSync(join(dest, 'pnpm-lock.yaml')), readFileSync(join(root, 'starter/pnpm-lock.yaml')));
  assert.equal(readFileSync(join(dest, 'public/mission-control.json'), 'utf8'), readFileSync(join(root, 'fixtures/mission-control.json'), 'utf8'));
  assert.equal(meta.setupStatus, 'skipped'); assert.equal(meta.requestedModel, null); assert.equal(meta.browser.policy, 'disabled');
  for (const name of ['launcher.mjs', 'limits.mjs', 'browser-check.mjs']) assert.ok(existsSync(join(dest, '.benchmark', name)));
});
test('invalid guardrail flags do not mutate destinations', () => {
  const dir = scratch(); const invalid = [['--run-timeout-seconds', '0'], ['--command-timeout-seconds', 'NaN'], ['--run-timeout-seconds', '999999'], ['--wat'], ['--model', 'bad'], ['--browser-executable']];
  for (const [i, extra] of invalid.entries()) { const dest = join(dir, `bad-${i}`); assert.notEqual(run(['mission-control', dest, ...extra]).status, 0); assert.equal(existsSync(dest), false); }
  assert.equal(run(['--help']).status, 0); assert.equal(existsSync(join(dir, '--help')), false);
});
test('refuses existing source descendants and --start without install', () => {
  const dir = scratch(), existing = join(dir, 'existing'); mkdirSync(existing);
  assert.notEqual(run(['orbital-lab', existing, '--no-install']).status, 0);
  assert.notEqual(run(['orbital-lab', join(root, 'do-not-create'), '--no-install']).status, 0);
  assert.notEqual(run(['orbital-lab', join(dir, 'bad'), '--model', 'local/a', '--start', '--no-install']).status, 0);
});
