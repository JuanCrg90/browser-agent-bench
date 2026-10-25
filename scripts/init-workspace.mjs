#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync, lstatSync, realpathSync, copyFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { DEFAULT_COMMAND_TIMEOUT, DEFAULT_RUN_TIMEOUT, seconds } from './runtime/launcher.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tasks = ['mission-control', 'orbital-lab', 'reactor-escape']; const levels = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
const usage = 'Usage: init-workspace.mjs TASK DEST [--model PROVIDER/ID] [--thinking LEVEL] [--run-timeout-seconds N] [--command-timeout-seconds N] [--browser-executable PATH] [--no-browser] [--no-install] [--start]';
function fail(message) { console.error(`${message}\n${usage}`); process.exit(1); }
function validModel(value) { return Boolean(value) && !value.startsWith('-') && !/\s/.test(value) && value.includes('/') && value.split('/').every(Boolean); }
function parse(argv) {
  if (argv.length === 1 && argv[0] === '--help') { console.log(usage); process.exit(0); }
  if (argv.length < 2 || argv[0].startsWith('-')) fail('Task and destination required'); const [task, destArg, ...opts] = argv;
  if (!tasks.includes(task)) fail('Unknown task'); if (!destArg || destArg.startsWith('-')) fail('Invalid destination');
  const options = { model: null, thinking: 'low', install: true, start: false, noBrowser: false, browserExecutable: null, runTimeoutSeconds: DEFAULT_RUN_TIMEOUT, commandTimeoutSeconds: DEFAULT_COMMAND_TIMEOUT }; const seen = new Set();
  for (let i = 0; i < opts.length; i++) { const key = opts[i]; if (seen.has(key)) fail(`Duplicate option: ${key}`); seen.add(key);
    if (key === '--no-install') options.install = false; else if (key === '--start') options.start = true; else if (key === '--no-browser') options.noBrowser = true;
    else if (['--model', '--thinking', '--run-timeout-seconds', '--command-timeout-seconds', '--browser-executable'].includes(key)) { const value = opts[++i]; if (!value || value.startsWith('--')) fail(`Missing value for ${key}`);
      if (key === '--model') { if (!validModel(value)) fail('Model must be provider/id'); options.model = value; } else if (key === '--thinking') { if (!levels.includes(value)) fail('Invalid thinking level'); options.thinking = value; } else if (key === '--browser-executable') options.browserExecutable = value; else { try { options[key === '--run-timeout-seconds' ? 'runTimeoutSeconds' : 'commandTimeoutSeconds'] = seconds(value, key); } catch (error) { fail(error.message); } }
    } else fail(`Unknown option: ${key}`);
  }
  if (options.start && !options.model) fail('--start requires --model'); if (options.start && !options.install) fail('--start cannot be combined with --no-install'); return { task, dest: resolve(destArg), ...options };
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex'); const shellQuote = value => `'${value.replaceAll("'", "'\\''")}'`;
function copyRuntime(source, destination) { mkdirSync(destination, { recursive: true }); for (const entry of readdirSync(source, { withFileTypes: true })) { const from = join(source, entry.name), to = join(destination, entry.name); if (entry.isDirectory()) copyRuntime(from, to); else copyFileSync(from, to); } }
const a = parse(process.argv.slice(2)); const resources = ['package.json', 'pnpm-lock.yaml', 'index.html', 'src/main.js', 'src/style.css', '.gitignore'];
for (const file of resources) if (!existsSync(join(root, 'starter', file))) fail(`Missing starter resource: ${file}`);
for (const file of ['COMMON.md', `prompts/0${tasks.indexOf(a.task) + 1}-${a.task}.md`]) if (!existsSync(join(root, file))) fail(`Missing prompt resource: ${file}`); if (a.task === 'mission-control' && !existsSync(join(root, 'fixtures/mission-control.json'))) fail('Missing fixture');
const source = realpathSync(root); let ancestor = a.dest; const missing = [];
while (true) { try { ancestor = realpathSync(ancestor); break; } catch (error) { if (error.code !== 'ENOENT') throw error; const parent = dirname(ancestor); if (parent === ancestor) throw error; missing.unshift(basename(ancestor)); ancestor = parent; } }
const canonicalTarget = join(ancestor, ...missing), rel = relative(source, canonicalTarget); if (rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))) fail('Destination must be outside benchmark source');
try { lstatSync(a.dest); fail('Destination already exists'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
mkdirSync(dirname(a.dest), { recursive: true }); mkdirSync(a.dest);
for (const file of resources) { const out = join(a.dest, file); mkdirSync(dirname(out), { recursive: true }); copyFileSync(join(root, 'starter', file), out); }
if (a.task === 'mission-control') { mkdirSync(join(a.dest, 'public'), { recursive: true }); copyFileSync(join(root, 'fixtures/mission-control.json'), join(a.dest, 'public/mission-control.json')); }
const prompt = readFileSync(join(root, 'COMMON.md'), 'utf8').trimEnd() + '\n\n' + readFileSync(join(root, `prompts/0${tasks.indexOf(a.task) + 1}-${a.task}.md`), 'utf8'); writeFileSync(join(a.dest, 'BENCHMARK_PROMPT.md'), prompt);
mkdirSync(join(a.dest, '.benchmark')); copyRuntime(join(root, 'scripts/runtime'), join(a.dest, '.benchmark'));
writeFileSync(join(a.dest, 'start-benchmark.mjs'), `#!/usr/bin/env node\nimport { fileURLToPath } from 'node:url';\nimport { main } from './.benchmark/launcher.mjs';\nprocess.chdir(fileURLToPath(new URL('.', import.meta.url)));\nmain();\n`);
const metadata = { benchmarkVersion: '1.1', task: a.task, createdAt: new Date().toISOString(), requestedModel: a.model, requestedThinking: a.thinking, runTimeoutSeconds: a.runTimeoutSeconds, commandTimeoutSeconds: a.commandTimeoutSeconds, browser: a.noBrowser ? { available: false, policy: 'disabled' } : { available: null, requestedExecutable: a.browserExecutable }, nodeVersion: process.version, packageManager: JSON.parse(readFileSync(join(a.dest, 'package.json'))).packageManager, starterLockSha256: hash(readFileSync(join(a.dest, 'pnpm-lock.yaml'))), promptSha256: hash(readFileSync(join(a.dest, 'BENCHMARK_PROMPT.md'))), runtimeSha256: Object.fromEntries(['launcher.mjs', 'limits.mjs', 'browser-check.mjs'].map(file => [file, hash(readFileSync(join(a.dest, '.benchmark', file)))])), setupStatus: a.install ? 'failed' : 'skipped' };
writeFileSync(join(a.dest, '.benchmark/browser-policy.json'), JSON.stringify({ available: !a.noBrowser, helper: '.benchmark/browser-check.mjs', executable: a.browserExecutable, note: a.noBrowser ? 'Browser verification is unavailable for this run.' : 'Use only the bounded loopback browser helper; Firefox --dump-dom is unsupported.' }, null, 2) + '\n');
if (a.install) { const result = spawnSync('pnpm', ['install', '--frozen-lockfile'], { cwd: a.dest, stdio: 'inherit' }); metadata.setupStatus = !result.error && result.status === 0 ? 'ready' : 'failed'; writeFileSync(join(a.dest, '.benchmark/run.json'), JSON.stringify(metadata, null, 2) + '\n'); if (metadata.setupStatus === 'failed') { console.error(result.error?.message ?? `pnpm failed (${result.signal ?? result.status})`); process.exit(1); } } else writeFileSync(join(a.dest, '.benchmark/run.json'), JSON.stringify(metadata, null, 2) + '\n');
console.log(`Workspace: ${a.dest}\ncd ${shellQuote(a.dest)}\nnode start-benchmark.mjs --model ${shellQuote(a.model ?? 'provider/model')}`);
if (a.start) { const result = spawnSync(process.execPath, [join(a.dest, 'start-benchmark.mjs')], { cwd: a.dest, stdio: 'inherit' }); process.exit(result.status ?? 1); }
