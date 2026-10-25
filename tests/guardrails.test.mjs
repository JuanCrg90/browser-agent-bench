import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { effectiveTimeout } from '../scripts/runtime/limits.mjs';
const root = resolve(fileURLToPath(new URL('..', import.meta.url))); const initCli = join(root, 'scripts/init-workspace.mjs'); const scratch = () => mkdtempSync(join(tmpdir(), 'benchmark-guard-'));
const sleep = ms => new Promise(resolveSleep => setTimeout(resolveSleep, ms));
function initialize(dest) { const r = spawnSync(process.execPath, [initCli, 'mission-control', dest, '--model', 'local/a', '--no-install', '--no-browser'], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); }
function executable(file, source) { writeFileSync(file, `#!${process.execPath}\n${source}`); chmodSync(file, 0o755); return file; }
function ackSource(extra = '') { return `const fs=require('fs');fs.writeFileSync('.benchmark/guard-loaded.json',JSON.stringify({nonce:process.env.BENCHMARK_GUARD_ATTEMPT_NONCE,piPid:process.pid,launcherPid:Number(process.env.BENCHMARK_GUARD_LAUNCHER_PID)}));${extra}`; }
function runner(dest, pi, args = [], stdio = 'ignore') { return spawn(process.execPath, ['-e', `import(${JSON.stringify(`file://${join(dest, '.benchmark/launcher.mjs')}`)}).then(({launch})=>launch({cwd:${JSON.stringify(dest)},argv:${JSON.stringify(args)},pi:${JSON.stringify(pi)}}).then(x=>process.exit(x)).catch(e=>{console.error(e.message);process.exit(1)}))`], { stdio }); }

test('guard mutates Pi shared tool input and only records settled stop completions', async () => {
  const dir = scratch(), old = { root: process.env.BENCHMARK_GUARD_DIR, nonce: process.env.BENCHMARK_GUARD_ATTEMPT_NONCE, launcher: process.env.BENCHMARK_GUARD_LAUNCHER_PID }; process.env.BENCHMARK_GUARD_DIR = dir; process.env.BENCHMARK_GUARD_ATTEMPT_NONCE = 'nonce'; process.env.BENCHMARK_GUARD_LAUNCHER_PID = String(process.pid);
  const module = await import(`file://${join(root, 'scripts/runtime/limits.mjs')}?guard=${Date.now()}`); const handlers = {}; let activeTools = []; module.default({ on: (name, fn) => { handlers[name] = fn; }, setActiveTools: tools => { activeTools = tools; } }); handlers.session_start();
  const input = { command: 'secret', timeout: 999 }, event = { toolName: 'bash', toolCallId: 'x', input }; handlers.tool_call(event); assert.strictEqual(event.input, input); assert.equal(input.timeout, 120); assert.equal(module.effectiveTimeout('wat'), 120);
  writeFileSync(join(dir, '.benchmark/guard-approved.json'), JSON.stringify({ nonce: 'nonce', piPid: process.pid, launcherPid: process.pid })); writeFileSync(join(dir, '.benchmark/phase.json'), '{}'); await handlers.before_agent_start({}, { abort() { throw Error('should be approved'); } }); assert.equal(existsSync(join(dir, '.benchmark/phase.json')), false); assert.deepEqual(activeTools, ['read', 'bash', 'edit', 'write', 'grep', 'find', 'ls']);
  const ctx = { sessionManager: { getBranch: () => [{ type: 'message', message: { role: 'assistant', stopReason: 'length' } }] } }; handlers.agent_settled({ aborted: false }, ctx); assert.equal(existsSync(join(dir, '.benchmark/phase.json')), false); ctx.sessionManager.getBranch = () => [{ type: 'message', message: { role: 'assistant', stopReason: 'stop' } }]; handlers.agent_settled({ aborted: false }, ctx); assert.equal(JSON.parse(readFileSync(join(dir, '.benchmark/phase.json'))).stopReason, 'stop');
  process.env.BENCHMARK_GUARD_DIR = old.root; process.env.BENCHMARK_GUARD_ATTEMPT_NONCE = old.nonce; process.env.BENCHMARK_GUARD_LAUNCHER_PID = old.launcher;
});
test('deadline kills reparented stubborn separate-session descendants but not sentinel', async () => {
  const dir = scratch(), dest = join(dir, 'work'), pidFile = join(dir, 'child.pid'); initialize(dest);
  const pi = executable(join(dir, 'pi'), ackSource(`const {spawn}=require('child_process');const c=spawn(process.execPath,['-e',${JSON.stringify(`require('fs').writeFileSync(${JSON.stringify(pidFile)},String(process.pid));process.on('SIGTERM',()=>{});setInterval(()=>{},1000)`) }],{detached:true,stdio:'ignore'});c.unref();process.on('SIGTERM',()=>process.exit(0));setInterval(()=>{},1000);`));
  const sentinel = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { detached: true, stdio: 'ignore' }); sentinel.unref(); const launch = runner(dest, pi, ['--run-timeout-seconds', '0.25'], 'pipe'); const [status] = await new Promise(resolveClose => launch.on('close', (...a) => resolveClose(a))); assert.equal(status, 124); const childPid = Number(readFileSync(pidFile, 'utf8')); await sleep(100); assert.throws(() => process.kill(childPid, 0)); assert.doesNotThrow(() => process.kill(sentinel.pid, 0)); process.kill(-sentinel.pid, 'SIGKILL');
});
test('normal Pi exit cleans an observed background child and handshake is nonce/pid bound', async () => {
  const dir = scratch(), dest = join(dir, 'work'), pidFile = join(dir, 'normal-child.pid'); initialize(dest);
  const pi = executable(join(dir, 'pi'), ackSource(`const {spawn}=require('child_process');const c=spawn(process.execPath,['-e',${JSON.stringify(`require('fs').writeFileSync(${JSON.stringify(pidFile)},String(process.pid));process.on('SIGTERM',()=>{});setInterval(()=>{},1000)`) }],{detached:true,stdio:'ignore'});c.unref();setTimeout(()=>process.exit(0),120);`));
  const launch = runner(dest, pi); const [status] = await new Promise(resolveClose => launch.on('close', (...a) => resolveClose(a))); assert.equal(status, 0); const childPid = Number(readFileSync(pidFile, 'utf8')); await sleep(100); assert.throws(() => process.kill(childPid, 0));
  const bad = executable(join(dir, 'bad'), `require('fs').writeFileSync('.benchmark/guard-loaded.json','{}');setInterval(()=>{},1000);`); const failed = runner(dest, bad); const [badStatus] = await new Promise(resolveClose => failed.on('close', (...a) => resolveClose(a))); assert.equal(badStatus, 1);
});
test('ENOENT and manual signals during handshake are bounded and preserve status', async () => {
  const dir = scratch(), dest = join(dir, 'work'); initialize(dest); const missing = runner(dest, join(dir, 'does-not-exist')); const [missingStatus] = await new Promise(resolveClose => missing.on('close', (...a) => resolveClose(a))); assert.equal(missingStatus, 1);
  const pi = executable(join(dir, 'slow'), 'process.on("SIGTERM",()=>{});setInterval(()=>{},1000);'); const interrupted = runner(dest, pi); await sleep(80); interrupted.kill('SIGINT'); const [status] = await new Promise(resolveClose => interrupted.on('close', (...a) => resolveClose(a))); assert.equal(status, 130); const meta = JSON.parse(readFileSync(join(dest, '.benchmark/run.json'))); assert.equal(meta.lastExitCode, 130);
});
test('detached Pi retains interactive PTY stdin', () => {
  const dir = scratch(), dest = join(dir, 'work'), character = join(dir, 'character'); initialize(dest);
  const pi = executable(join(dir, 'pty-pi'), ackSource(`process.stdin.once('data',data=>{require('fs').writeFileSync(${JSON.stringify(character)},data);process.exit(0)});`));
  const entry = join(dir, 'run.mjs'); writeFileSync(entry, `import {launch} from ${JSON.stringify(`file://${join(dest, '.benchmark/launcher.mjs')}`)};process.exit(await launch({cwd:${JSON.stringify(dest)},pi:${JSON.stringify(pi)}}));`);
  const python = "import os,pty,subprocess,sys,time\nmaster,slave=pty.openpty()\np=subprocess.Popen([sys.argv[1],sys.argv[2]],stdin=slave,stdout=slave,stderr=slave,close_fds=True)\nos.close(slave)\ntime.sleep(.35)\nos.write(master,b'Q\\n')\nstatus=p.wait(timeout=12)\nos.close(master)\nsys.exit(status)\n";
  const result = spawnSync('python3', ['-c', python, process.execPath, entry], { encoding: 'utf8', timeout: 15000 }); assert.equal(result.status, 0, `${result.stderr}${result.stdout}`); assert.match(readFileSync(character, 'utf8'), /^Q/);
});
