import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url))); const cli = join(root, 'scripts/init-workspace.mjs');
const scratch = () => mkdtempSync(join(tmpdir(), 'benchmark-integration-')); const json = file => JSON.parse(readFileSync(file, 'utf8'));
const invoke = (args, options = {}) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 15000, ...options }); const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function fakeCommands(directory) {
  const bin = join(directory, 'bin'); mkdirSync(bin); const log = join(directory, 'commands.jsonl');
  writeFileSync(join(bin, 'pnpm'), `#!${process.execPath}\nconst fs=require('fs');fs.appendFileSync(${JSON.stringify(log)},JSON.stringify({command:'pnpm',args:process.argv.slice(2),cwd:process.cwd()})+'\\n');process.exit(Number(process.env.PNPM_EXIT_CODE||0));`, { mode: 0o755 });
  writeFileSync(join(bin, 'pi'), `#!${process.execPath}\nconst fs=require('fs');fs.appendFileSync(${JSON.stringify(log)},JSON.stringify({command:'pi',args:process.argv.slice(2),cwd:process.cwd()})+'\\n');fs.writeFileSync('.benchmark/guard-loaded.json',JSON.stringify({nonce:process.env.BENCHMARK_GUARD_ATTEMPT_NONCE,piPid:process.pid,launcherPid:Number(process.env.BENCHMARK_GUARD_LAUNCHER_PID)}));process.exit(Number(process.env.PI_EXIT_CODE||0));`, { mode: 0o755 });
  return { env: { ...process.env, PATH: bin }, events: () => existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [] };
}
for (const [index, task] of ['mission-control', 'orbital-lab', 'reactor-escape'].entries()) test(`${task}: exact prompt merge, fixture boundary, and hashes`, () => {
  const directory = scratch(), dest = join(directory, 'workspace'), commands = fakeCommands(directory); const result = invoke([task, dest, '--no-install', '--no-browser'], { env: commands.env }); assert.equal(result.status, 0, result.stderr);
  const expected = readFileSync(join(root, 'COMMON.md'), 'utf8').trimEnd() + '\n\n' + readFileSync(join(root, `prompts/0${index + 1}-${task}.md`), 'utf8'); assert.equal(readFileSync(join(dest, 'BENCHMARK_PROMPT.md'), 'utf8'), expected);
  for (const file of ['package.json', 'pnpm-lock.yaml', 'index.html', 'src/main.js', 'src/style.css', '.gitignore']) assert.deepEqual(readFileSync(join(dest, file)), readFileSync(join(root, 'starter', file)));
  assert.equal(existsSync(join(dest, 'public/mission-control.json')), task === 'mission-control'); for (const absent of ['EVALUATION.md', 'RESULTS.md', 'followups', 'prompts', 'node_modules', 'dist']) assert.equal(existsSync(join(dest, absent)), false, absent);
  const meta = json(join(dest, '.benchmark/run.json')); assert.equal(meta.starterLockSha256, hash(readFileSync(join(root, 'starter/pnpm-lock.yaml')))); assert.equal(meta.promptSha256, hash(Buffer.from(expected))); assert.equal(meta.setupStatus, 'skipped'); assert.deepEqual(commands.events(), []);
});
test('invalid arguments and existing files/dangling symlinks are untouched', () => {
  const directory = scratch(), commands = fakeCommands(directory); const variants = [['--unknown'], ['--model'], ['--thinking', 'bad'], ['--model', 'no-provider'], ['--model', '/empty'], ['--model', 'provider/'], ['--model', 'a/b', '--model', 'c/d'], ['--no-install', '--no-install'], ['--start'], ['--start', '--model', 'local/a', '--no-install']];
  for (const [i, options] of variants.entries()) { const dest = join(directory, `invalid-${i}`); assert.notEqual(invoke(['orbital-lab', dest, ...options], { env: commands.env }).status, 0); assert.equal(existsSync(dest), false); }
  const file = join(directory, 'file'), link = join(directory, 'dangling'); writeFileSync(file, 'preserve'); symlinkSync(join(directory, 'gone'), link);
  for (const dest of [file, link]) assert.notEqual(invoke(['orbital-lab', dest, '--no-install'], { env: commands.env }).status, 0); assert.equal(readFileSync(file, 'utf8'), 'preserve'); assert.equal(existsSync(join(directory, 'gone')), false); assert.deepEqual(commands.events(), []);
});
test('start installs before Pi, propagates Pi failure, and launcher argv is explicit', () => {
  const directory = scratch(), dest = join(directory, "workspace's copy"), commands = fakeCommands(directory), model = "local/vendor/model;literal'quote";
  const result = invoke(['reactor-escape', dest, '--model', model, '--thinking', 'medium', '--no-browser', '--start'], { env: { ...commands.env, PI_EXIT_CODE: '17' } }); assert.equal(result.status, 17, result.stderr);
  const events = commands.events(); assert.deepEqual(events.map(event => event.command), ['pnpm', 'pi']); assert.deepEqual(events[0].args, ['install', '--frozen-lockfile']);
  assert.deepEqual(events[1].args.slice(0, 5), ['--offline', '--no-approve', '--no-extensions', '--extension', '.benchmark/limits.mjs']); assert.ok(events[1].args.includes(model)); assert.equal(json(join(dest, '.benchmark/run.json')).setupStatus, 'ready'); assert.equal(json(join(dest, '.benchmark/browser-policy.json')).available, false);
  const failed = join(directory, 'failed'); const fail = invoke(['mission-control', failed, '--model', 'local/a', '--no-browser', '--start'], { env: { ...commands.env, PNPM_EXIT_CODE: '9' } }); assert.notEqual(fail.status, 0); assert.equal(json(join(failed, '.benchmark/run.json')).setupStatus, 'failed');
});
test('standalone launcher requires a model and validates overrides', () => {
  const directory = scratch(), dest = join(directory, 'workspace'), commands = fakeCommands(directory); assert.equal(invoke(['orbital-lab', dest, '--no-install', '--no-browser'], { env: commands.env }).status, 0);
  const launch = (args, env = commands.env) => spawnSync(process.execPath, [join(dest, 'start-benchmark.mjs'), ...args], { cwd: directory, env, encoding: 'utf8', timeout: 10000 });
  for (const args of [[], ['--continue'], ['--model'], ['--model', 'bad'], ['--model', 'local/has space'], ['--thinking', 'bad'], ['--model', 'a/b', '--model', 'c/d']]) assert.notEqual(launch(args).status, 0, JSON.stringify(args));
  const ok = launch(['--model', 'local/vendor/model', '--thinking', 'high']); assert.equal(ok.status, 0, ok.stderr); assert.equal(json(join(dest, '.benchmark/run.json')).requestedModel, 'local/vendor/model');
});
