#!/usr/bin/env node
// Operation deadline: at most 90 seconds, plus at most 5 seconds of cleanup.
import { accessSync, constants, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const helperDir = fileURLToPath(new URL('.', import.meta.url));
const loopbacks = new Set(['localhost', '127.0.0.1', '[::1]']);
const cleanupSeconds = 5;
function policy() {
  const file = join(helperDir, 'browser-policy.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}
function executable(file) {
  try { accessSync(file, constants.X_OK); return statSync(file).isFile(); }
  catch { return false; }
}
export function findBrowser(requested) {
  const saved = policy();
  if (saved?.available === false) throw Error('Browser disabled by benchmark policy');
  const explicit = requested || saved?.executable || process.env.BENCHMARK_BROWSER_EXECUTABLE;
  if (explicit) {
    if (!executable(explicit)) throw Error(`Chromium executable is not executable: ${explicit}`);
    return resolve(explicit);
  }
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, join(homedir(), '.cache', 'ms-playwright')].filter(Boolean);
  for (const root of roots) {
    let directories;
    try { directories = readdirSync(root).filter(name => /^chromium-\d+$/.test(name)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1])); }
    catch { continue; }
    for (const directory of directories) {
      for (const suffix of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
        const candidate = join(root, directory, suffix);
        if (executable(candidate)) return candidate;
      }
    }
  }
  throw Error('Chromium not found. Prepare Playwright Chromium outside the benchmark or pass --browser-executable PATH; no download was attempted.');
}
export function loopbackUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw Error('--url must be an HTTP loopback URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || !loopbacks.has(url.hostname) || url.username || url.password) throw Error('--url must be an HTTP loopback URL without credentials');
  return url.href;
}
function positive(value, name, maximum, integer = false) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number > maximum || (integer && !Number.isInteger(number))) throw Error(`${name} must be a positive ${integer ? 'integer' : 'number'} no greater than ${maximum}`);
  return number;
}
function run(command, args, { timeoutSeconds = 10, signal } = {}) {
  if (signal?.aborted) return Promise.resolve({ status: 130, stdout: '', stderr: 'Browser check interrupted', aborted: true });
  return new Promise(resolveRun => {
    let stdout = '', stderr = '', done = false, timer, fallback;
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    const finish = result => {
      if (done) return;
      done = true;
      clearTimeout(timer); clearTimeout(fallback); signal?.removeEventListener('abort', abort);
      child.stdout.destroy(); child.stderr.destroy(); child.unref();
      resolveRun({ ...result, stdout, stderr });
    };
    const stop = result => {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
      // Do not wait indefinitely for pipes held by a detached grandchild.
      fallback = setTimeout(() => finish(result), 100);
    };
    const abort = () => stop({ status: 130, aborted: true });
    signal?.addEventListener('abort', abort, { once: true });
    child.stdout.on('data', chunk => { stdout = (stdout + chunk).slice(-1048576); });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-1048576); });
    child.once('error', error => finish({ status: 1, error }));
    child.once('close', (status, exitSignal) => finish({ status, signal: exitSignal }));
    timer = setTimeout(() => stop({ status: 124, timedOut: true }), timeoutSeconds * 1000);
  });
}
export async function cliVersion(cli = 'playwright-cli') {
  const result = await run(cli, ['--version']);
  if (result.error || result.status !== 0) throw Error(`playwright-cli unavailable: ${result.stderr || result.error?.message || result.status}`);
  return (result.stdout || result.stderr).trim();
}
function configFor(browser, output) {
  const config = resolve(output, 'playwright-cli.config.json');
  writeFileSync(config, JSON.stringify({ browser: { browserName: 'chromium', isolated: true, launchOptions: { headless: true, executablePath: browser } } }, null, 2));
  return config;
}
export async function preflight({ executable: requested, cli = 'playwright-cli', output = '.benchmark/browser-preflight', signal } = {}) {
  const browser = findBrowser(requested);
  const version = await cliVersion(cli);
  const checked = await run(browser, ['--version'], { signal });
  if (checked.error || checked.status !== 0) throw Error(`Chromium --version failed: ${checked.stderr || checked.error?.message || checked.status}`);
  mkdirSync(output, { recursive: true });
  const config = configFor(browser, output), session = `benchmark-preflight-${randomUUID()}`;
  let opened, closed;
  try { opened = await run(cli, [`-s=${session}`, 'open', 'about:blank', '--config', config, '--idle-timeout', '5000'], { timeoutSeconds: 25, signal }); }
  finally { closed = await run(cli, [`-s=${session}`, 'close'], { timeoutSeconds: cleanupSeconds }); }
  const diagnostics = resolve(output, 'preflight-diagnostics.json');
  writeFileSync(diagnostics, JSON.stringify({ opened, closed }, null, 2));
  if (opened.error || opened.status !== 0 || closed.error || closed.status !== 0) throw Error(`Browser preflight failed; diagnostics: ${diagnostics}; ${opened.stderr || opened.error?.message || opened.status}; close: ${closed.stderr || closed.status}`);
  return { executable: browser, cliVersion: version, browserVersion: (checked.stdout || checked.stderr).trim(), config };
}
export async function browserCheck({ url, width = 1440, height = 900, executable: requested, cli = 'playwright-cli', output = '.benchmark/browser-checks', deadlineSeconds = 90, signal, script } = {}) {
  const target = loopbackUrl(url);
  width = positive(width, '--width', 10000, true); height = positive(height, '--height', 10000, true);
  deadlineSeconds = positive(deadlineSeconds, '--deadline-seconds', 90);
  const browser = findBrowser(requested);
  if (script && (!statSync(script).isFile() || statSync(script).size > 1048576)) throw Error('--script must be a local function-expression file no larger than 1 MiB');
  mkdirSync(output, { recursive: true });
  const config = configFor(browser, output), session = `benchmark-check-${randomUUID()}`, prefix = [`-s=${session}`];
  const snapshot = resolve(output, `${session}.snapshot.yml`), screenshot = resolve(output, `${session}.png`);
  const diagnostics = resolve(output, `${session}.diagnostics.json`), consoleFile = resolve(output, `${session}.console.json`);
  const deadline = Date.now() + deadlineSeconds * 1000, logs = [];
  let failure = null, consoleResult = null;
  const invoke = async args => {
    if (signal?.aborted) throw Error('Browser check interrupted');
    const remaining = (deadline - Date.now()) / 1000;
    if (remaining <= 0) throw Error('Browser operation deadline exceeded');
    const result = await run(cli, [...prefix, ...args], { timeoutSeconds: Math.min(20, remaining), signal });
    logs.push({ args, ...result });
    if (result.error || result.status !== 0) throw Error(`playwright-cli operation failed: ${result.stderr || result.error?.message || result.status}`);
    return result;
  };
  try {
    await invoke(['open', 'about:blank', '--config', config, '--idle-timeout', '30000']);
    await invoke(['resize', String(width), String(height)]);
    const remainingMs = Math.max(1, Math.min(15000, deadline - Date.now()));
    const code = `async page => { const consoleErrors=[],pageErrors=[]; page.on('console', m=>{if(m.type()==='error')consoleErrors.push(m.text())}); page.on('pageerror', e=>pageErrors.push(String(e))); await page.goto(${JSON.stringify(target)},{waitUntil:'networkidle',timeout:${remainingMs}}); const scriptResult=${script ? `await (${readFileSync(script, 'utf8')})(page)` : 'null'}; return {consoleErrors,pageErrors,scriptResult}; }`;
    const captured = await invoke(['--raw', 'run-code', code]);
    writeFileSync(consoleFile, captured.stdout);
    try { consoleResult = JSON.parse(captured.stdout); } catch { /* preserve exact CLI output for inspection */ }
    await invoke(['snapshot', '--filename', snapshot]);
    await invoke(['screenshot', '--filename', screenshot]);
  } catch (error) { failure = error; }
  finally {
    const closed = await run(cli, [...prefix, 'close'], { timeoutSeconds: cleanupSeconds });
    logs.push({ args: ['close'], ...closed });
    writeFileSync(diagnostics, JSON.stringify({ commands: logs }, null, 2));
    if ((closed.error || closed.status !== 0) && !failure) failure = Error(`Browser close/cleanup failed: ${closed.stderr || closed.error?.message || closed.status}`);
  }
  if (failure) throw Error(`${failure.message}; diagnostics: ${diagnostics}`);
  return { session, url: target, screenshot, snapshot, diagnostics, console: consoleFile, consoleResult, executable: browser };
}
async function main() {
  const args = process.argv.slice(2), options = {}, allowed = new Set(['--url', '--width', '--height', '--browser-executable', '--output', '--deadline-seconds', '--script']);
  let preflightMode = false;
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (key === '--preflight') { if (preflightMode) throw Error('Duplicate --preflight'); preflightMode = true; continue; }
    if (!allowed.has(key) || options[key] !== undefined || index + 1 >= args.length || args[index + 1].startsWith('--')) throw Error(`Unknown, duplicate, or incomplete option: ${key}`);
    options[key] = args[++index];
  }
  const controller = new AbortController();
  let exitCode = 0;
  const onInt = () => { exitCode = 130; controller.abort(); };
  const onTerm = () => { exitCode = 143; controller.abort(); };
  process.on('SIGINT', onInt); process.on('SIGTERM', onTerm);
  try {
    const common = { executable: options['--browser-executable'], output: options['--output'], signal: controller.signal };
    const result = preflightMode ? await preflight(common) : await browserCheck({ ...common, url: options['--url'], width: options['--width'] ?? 1440, height: options['--height'] ?? 900, deadlineSeconds: options['--deadline-seconds'] ?? 90, script: options['--script'] });
    console.log(JSON.stringify(result));
  } finally { process.off('SIGINT', onInt); process.off('SIGTERM', onTerm); if (exitCode) process.exitCode = exitCode; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode ||= 1; });
