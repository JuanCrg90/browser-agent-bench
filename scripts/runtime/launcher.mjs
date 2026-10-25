import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { preflight } from './browser-check.mjs';

export const DEFAULT_RUN_TIMEOUT = 3600;
export const DEFAULT_COMMAND_TIMEOUT = 120;
const MAX_SECONDS = 86400;
const HANDSHAKE_SECONDS = 5;
const TERM_GRACE_MS = 1500;
const levels = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
const validModel = value => Boolean(value) && !value.startsWith('-') && !/\s/.test(value) && value.includes('/') && value.split('/').every(Boolean);
export function seconds(value, flag) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_SECONDS) throw Error(`${flag} must be a positive finite number no greater than ${MAX_SECONDS}`);
  return parsed;
}
export function parseLaunch(argv, initial = {}) {
  const result = { model: initial.model ?? initial.requestedModel ?? null, thinking: initial.thinking ?? initial.requestedThinking ?? 'low', runTimeoutSeconds: initial.runTimeoutSeconds ?? DEFAULT_RUN_TIMEOUT, commandTimeoutSeconds: initial.commandTimeoutSeconds ?? DEFAULT_COMMAND_TIMEOUT, noBrowser: Boolean(initial.noBrowser || initial.browser?.policy === 'disabled'), browserExecutable: initial.browserExecutable ?? initial.browser?.executable ?? initial.browser?.requestedExecutable ?? null };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]; if (seen.has(key)) throw Error(`Duplicate option ${key}`); seen.add(key);
    if (key === '--no-browser') { result.noBrowser = true; continue; }
    if (!['--model', '--thinking', '--run-timeout-seconds', '--command-timeout-seconds', '--browser-executable'].includes(key)) throw Error(`Unknown option ${key}`);
    const value = argv[++i]; if (!value || value.startsWith('--')) throw Error(`Missing value ${key}`);
    if (key === '--model') { if (!validModel(value)) throw Error('Invalid model'); result.model = value; }
    else if (key === '--thinking') { if (!levels.includes(value)) throw Error('Invalid thinking'); result.thinking = value; }
    else if (key === '--run-timeout-seconds') result.runTimeoutSeconds = seconds(value, key);
    else if (key === '--command-timeout-seconds') result.commandTimeoutSeconds = seconds(value, key);
    else result.browserExecutable = value;
  }
  if (!result.model) throw Error('Launch requires --model');
  return result;
}
const stamp = () => new Date().toISOString();
const readMeta = file => JSON.parse(readFileSync(file, 'utf8'));
const writeMeta = (file, meta) => writeFileSync(file, JSON.stringify(meta, null, 2) + '\n');
const delay = ms => new Promise(resolveDelay => setTimeout(resolveDelay, ms));

// /proc/stat starttime protects against PID reuse. Linux is deliberately required:
// a daemon can double-fork into a namespace or otherwise escape this ancestry scan.
function procTable() {
  const entries = new Map();
  for (const name of readdirSync('/proc')) if (/^\d+$/.test(name)) {
    try {
      const text = readFileSync(`/proc/${name}/stat`, 'utf8');
      const fields = text.slice(text.lastIndexOf(')') + 2).split(' ');
      entries.set(Number(name), { ppid: Number(fields[1]), pgrp: Number(fields[2]), starttime: fields[19] });
    } catch { /* process exited between directory and stat reads */ }
  }
  return entries;
}
function own(record, table) {
  const current = table.get(record.pid);
  return Boolean(current && current.starttime === record.starttime);
}
function makeOwnership(rootPid) {
  const owned = new Map();
  const observe = () => {
    const table = procTable();
    const root = table.get(rootPid);
    if (root && !owned.has(rootPid)) owned.set(rootPid, { pid: rootPid, starttime: root.starttime, pgrp: root.pgrp });
    // Discover only while the root is still identifiable. Once reparented, a child
    // remains in owned, rather than being rediscovered by an unsafe global scan.
    const reachable = new Set([...owned].filter(([pid, record]) => own(record, table)).map(([pid]) => pid));
    let changed = true;
    while (changed) {
      changed = false;
      for (const [pid, entry] of table) if (reachable.has(entry.ppid) && !reachable.has(pid)) {
        reachable.add(pid); owned.set(pid, { pid, starttime: entry.starttime, pgrp: entry.pgrp }); changed = true;
      }
    }
    return table;
  };
  const signal = (signalName) => {
    const table = observe();
    // Signal individual identities, not arbitrary process groups. This reaches
    // separate-session children captured before reparenting without risking peers.
    for (const record of owned.values()) if (own(record, table)) try { process.kill(record.pid, signalName); } catch { /* exited or inaccessible */ }
  };
  return { observe, signal, stop: () => owned.clear() };
}
function waitExit(child) { return new Promise(resolveExit => child.once('exit', (status, signal) => resolveExit({ status, signal }))); }
async function terminate(child, ownership) {
  // spawn(ENOENT) has no process to clean up; waiting for its nonexistent exit
  // would turn an actionable installation error into a handshake timeout.
  if (!child.pid) return;
  ownership.observe(); // capture descendants before TERM can make them reparented
  ownership.signal('SIGTERM');
  await delay(TERM_GRACE_MS);
  // Always escalate all surviving, identity-checked descendants. Root exiting on
  // TERM must not suppress SIGKILL for a stubborn background child.
  ownership.signal('SIGKILL');
  await Promise.race([waitExit(child), delay(TERM_GRACE_MS)]);
}
function validHandshake(file, nonce, childPid) {
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    return data.nonce === nonce && Number(data.piPid) === childPid && Number(data.launcherPid) === process.pid;
  } catch { return false; }
}
function validPhase(file, nonce, childPid, deadlineMs) {
  try { const data = JSON.parse(readFileSync(file, 'utf8')); return data.nonce === nonce && Number(data.piPid) === childPid && data.stopReason === 'stop' && Date.parse(data.completedAt) <= deadlineMs; } catch { return false; }
}
async function waitForGuard(path, child, nonce, spawnError) {
  const until = Date.now() + HANDSHAKE_SECONDS * 1000;
  while (Date.now() < until) {
    if (spawnError()) return false;
    if (validHandshake(path, nonce, child.pid)) return true;
    if (child.exitCode !== null || child.signalCode !== null) return false;
    await delay(20);
  }
  return validHandshake(path, nonce, child.pid);
}
function writeBrowserPolicy(root, browser, disabled) {
  const policy = disabled ? { available: false, policy: 'disabled', note: 'Browser verification is unavailable for this run.' } : { available: true, executable: browser.executable, cliVersion: browser.cliVersion, browserVersion: browser.browserVersion, config: browser.config, helper: '.benchmark/browser-check.mjs' };
  writeFileSync(join(root, '.benchmark/browser-policy.json'), JSON.stringify(policy, null, 2) + '\n');
  return policy;
}
export async function launch({ cwd = process.cwd(), argv = process.argv.slice(2), pi = 'pi' } = {}) {
  if (process.platform !== 'linux') throw Error('The deadline launcher currently supports Linux /proc process ownership cleanup only.');
  const root = resolve(cwd); process.chdir(root);
  const metaFile = join(root, '.benchmark/run.json'); const metadata = readMeta(metaFile);
  const options = parseLaunch(argv, metadata);
  // Validate the local guard before Pi can start. Its factory owns no processes.
  const guardModule = await import(pathToFileURL(join(root, '.benchmark/limits.mjs')).href + `?validate=${randomUUID()}`);
  const handlers = new Set();
  guardModule.default({ on: name => handlers.add(name), setActiveTools() {} });
  for (const name of ['session_start', 'before_agent_start', 'tool_call', 'agent_settled']) {
    if (!handlers.has(name)) throw Error(`Benchmark guard is missing handler ${name}`);
  }
  let browser = null;
  if (!options.noBrowser) browser = await preflight({ executable: options.browserExecutable, output: join(root, '.benchmark/browser-preflight') });
  const now = Date.now(); const existingStart = metadata.lifetimeStartedAt ? Date.parse(metadata.lifetimeStartedAt) : NaN;
  const startedMs = Number.isFinite(existingStart) ? existingStart : now;
  const lifetimeRunTimeoutSeconds = metadata.lifetimeRunTimeoutSeconds ?? options.runTimeoutSeconds;
  const deadlineMs = startedMs + lifetimeRunTimeoutSeconds * 1000;
  if (now >= deadlineMs) throw Error('The benchmark lifetime deadline has already elapsed; create a new workspace rather than resetting it.');
  const guard = join(root, '.benchmark/guard-loaded.json'), approval = join(root, '.benchmark/guard-approved.json'), phase = join(root, '.benchmark/phase.json');
  rmSync(guard, { force: true }); rmSync(approval, { force: true }); rmSync(phase, { force: true }); mkdirSync(dirname(guard), { recursive: true });
  metadata.requestedModel = options.model; metadata.requestedThinking = options.thinking; metadata.runTimeoutSeconds = options.runTimeoutSeconds; metadata.commandTimeoutSeconds = options.commandTimeoutSeconds;
  metadata.browser = options.noBrowser ? { available: false, policy: 'disabled' } : { available: true, ...browser };
  writeBrowserPolicy(root, browser, options.noBrowser);
  metadata.lifetimeStartedAt ??= stamp(); metadata.lifetimeRunTimeoutSeconds ??= options.runTimeoutSeconds; metadata.launchedAt = stamp(); metadata.runAttempts ??= [];
  const attempt = { startedAt: metadata.launchedAt, runTimeoutSeconds: options.runTimeoutSeconds, commandTimeoutSeconds: options.commandTimeoutSeconds, browserAvailable: !options.noBrowser }; metadata.runAttempts.push(attempt); writeMeta(metaFile, metadata);
  const nonce = randomUUID();
  const args = ['--offline', '--no-approve', '--no-extensions', '--extension', '.benchmark/limits.mjs', '--no-mcp', '--no-skills', '--no-prompt-templates', '--no-themes', '--no-context-files', '--tools', 'read,bash,edit,write,grep,find,ls', '--session-dir', '.benchmark/sessions', '--thinking', options.thinking, '--model', options.model, '@BENCHMARK_PROMPT.md'];
  const child = spawn(pi, args, { cwd: root, stdio: 'inherit', detached: true, env: { ...process.env, BENCHMARK_COMMAND_TIMEOUT_SECONDS: String(options.commandTimeoutSeconds), BENCHMARK_GUARD_DIR: root, BENCHMARK_DEADLINE_MS: String(deadlineMs), BENCHMARK_GUARD_ATTEMPT_NONCE: nonce, BENCHMARK_GUARD_LAUNCHER_PID: String(process.pid) } });
  const ownership = makeOwnership(child.pid);
  let spawnError = null;
  child.once('error', error => { spawnError = error; });
  const exited = new Promise(resolveExit => { child.once('error', error => resolveExit({ error })); child.once('exit', (status, signal) => resolveExit({ status, signal })); });
  const interval = setInterval(() => ownership.observe(), 25); ownership.observe();
  let timer; const deadline = new Promise(resolveDeadline => { timer = setTimeout(() => resolveDeadline({ deadline: true }), Math.max(1, deadlineMs - Date.now())); });
  let manual = null, notifyManual;
  const manualEvent = new Promise(resolveManual => { notifyManual = resolveManual; });
  const onInt = () => { manual ??= 'SIGINT'; notifyManual({ manual: true }); };
  const onTerm = () => { manual ??= 'SIGTERM'; notifyManual({ manual: true }); };
  process.once('SIGINT', onInt); process.once('SIGTERM', onTerm);
  const cleanup = async () => { clearInterval(interval); clearTimeout(timer); process.off('SIGINT', onInt); process.off('SIGTERM', onTerm); ownership.stop(); };
  try {
    // Watch signals during the handshake too; no five-second uninterruptible window.
    const loaded = await Promise.race([waitForGuard(guard, child, nonce, () => spawnError), deadline, manualEvent]);
    if (loaded?.deadline || manual || !loaded) {
      await terminate(child, ownership);
      const status = loaded?.deadline ? 124 : manual === 'SIGINT' ? 130 : manual === 'SIGTERM' ? 143 : 1;
      const reason = loaded?.deadline ? 'deadline' : manual ?? 'guard-load-failed';
      attempt.stopReason = reason; attempt.exitCode = status; attempt.endedAt = stamp(); attempt.actualElapsedSeconds = (Date.now() - now) / 1000; metadata.lastExitCode = status; metadata.lastStopReason = reason; writeMeta(metaFile, metadata);
      if (status === 1) throw (spawnError ?? Error('Pi did not acknowledge the local bash timeout guard for this launch; refusing to run without verified guard approval.'));
      return status;
    }
    writeFileSync(approval, JSON.stringify({ nonce, piPid: child.pid, launcherPid: process.pid, approvedAt: stamp() }) + '\n');
    const outcome = await Promise.race([exited, deadline, manualEvent]);
    if (outcome.deadline || outcome.manual || manual) await terminate(child, ownership);
    else ownership.observe(); // normal Pi exit: clean captured background descendants too
    if (!outcome.deadline && !outcome.manual && !manual) await terminate(child, ownership);
    const completed = validPhase(phase, nonce, child.pid, deadlineMs);
    const final = outcome.deadline ? { status: 124, reason: completed ? 'deadline-after-agent-completed' : 'deadline' } : (outcome.manual || manual) ? { status: manual === 'SIGINT' ? 130 : 143, reason: manual } : outcome.error ? { status: 1, reason: 'spawn-error', error: outcome.error } : { status: outcome.status ?? 1, reason: outcome.signal ? `signal-${outcome.signal}` : 'pi-exit' };
    attempt.endedAt = stamp(); attempt.stopReason = final.reason; attempt.exitCode = final.status; attempt.actualElapsedSeconds = (Date.now() - now) / 1000; attempt.completedBeforeDeadline = completed; metadata.lastExitCode = final.status; metadata.lastStopReason = final.reason; metadata.lastElapsedSeconds = attempt.actualElapsedSeconds; writeMeta(metaFile, metadata);
    if (final.error) throw final.error;
    return final.status;
  } finally { await cleanup(); }
}
export async function main() { try { process.exitCode = await launch(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
