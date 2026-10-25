import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { findBrowser, loopbackUrl, preflight, browserCheck } from '../scripts/runtime/browser-check.mjs';
const helper = fileURLToPath(new URL('../scripts/runtime/browser-check.mjs', import.meta.url));
const scratch = () => mkdtempSync(join(tmpdir(), 'benchmark-browser-'));
function executable(file, body) { writeFileSync(file, `#!${process.execPath}\n${body}`); chmodSync(file, 0o755); return file; }
function fixture(mode = '') {
  const root = scratch(), calls = join(root, 'calls.jsonl');
  const browser = executable(join(root, 'chromium'), 'console.log("Chromium test version");');
  const cli = executable(join(root, 'playwright-cli'), `
const fs=require('node:fs');const args=process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(calls)},JSON.stringify(args)+'\\n');
if(args.includes('run-code')&&${JSON.stringify(mode)}==='hang')setInterval(()=>{},1000);
else if(args.includes('run-code')&&${JSON.stringify(mode)}==='fail'){console.error('navigation failed');process.exit(9)}
else if(args.includes('close')&&${JSON.stringify(mode)}==='close-fail'){console.error('close broke');process.exit(5)}
else if(args.includes('run-code'))console.log(JSON.stringify({consoleErrors:['console probe'],pageErrors:[]}));
else console.log('cli test version');
`);
  return { root, calls, browser, cli, events: () => existsSync(calls) ? readFileSync(calls, 'utf8').trim().split('\n').map(JSON.parse) : [] };
}
test('preflight verifies actual CLI/browser versions and closes its own session', async () => {
  const f = fixture();
  const result = await preflight({ executable: f.browser, cli: f.cli, output: join(f.root, 'preflight') });
  assert.equal(result.executable, f.browser); assert.equal(result.browserVersion, 'Chromium test version');
  assert.equal(result.cliVersion, 'cli test version');
  const events = f.events().filter(args => args[0].startsWith('-s='));
  assert.ok(events[0].includes('open')); assert.ok(events[1].includes('close')); assert.equal(events[0][0], events[1][0]);
  assert.equal(JSON.parse(readFileSync(result.config)).browser.isolated, true);
});
test('invalid browser executable, remote URLs, credentials, dimensions, and limits fail before output mutation', async () => {
  const f = fixture(); assert.throws(() => findBrowser(f.root), /executable/);
  for (const url of ['https://example.com', 'http://u:p@localhost', 'file:///tmp/test']) assert.throws(() => loopbackUrl(url));
  for (const options of [{ width: 1.2 }, { height: 0 }, { deadlineSeconds: 91 }]) {
    const output = join(f.root, 'untouched');
    await assert.rejects(browserCheck({ url: 'http://localhost', executable: f.browser, cli: f.cli, output, ...options }));
    assert.equal(existsSync(output), false);
  }
});
test('viewport precedes navigation, console output persists, and DOM/screenshot paths are explicit', async () => {
  const f = fixture(); const result = await browserCheck({ url: 'http://localhost:3000', width: 375, height: 812, executable: f.browser, cli: f.cli, output: join(f.root, 'check') });
  const events = f.events();
  assert.ok(events[0].includes('about:blank'));
  assert.deepEqual(events[1].slice(1), ['resize', '375', '812']);
  assert.ok(events[2].includes('run-code'));
  assert.match(events[2].at(-1), /page.on\('console'/);
  assert.match(events[2].at(-1), /page.goto/);
  assert.deepEqual(JSON.parse(readFileSync(result.console)), { consoleErrors: ['console probe'], pageErrors: [] });
  assert.ok(events.some(args => args.includes('snapshot') && args.includes(result.snapshot)));
  assert.ok(events.some(args => args.includes('screenshot') && args.includes(result.screenshot)));
  assert.ok(events.at(-1).includes('close'));
  assert.ok(events.every(args => args[0] === events[0][0]));
});
test('failed navigation closes its own session and keeps diagnostic stderr', async () => {
  const f = fixture('fail'), output = join(f.root, 'failed');
  await assert.rejects(browserCheck({ url: 'http://localhost', executable: f.browser, cli: f.cli, output }), /navigation failed/);
  assert.ok(f.events().at(-1).includes('close'));
});
test('operation timeout is bounded and still closes its own session', async () => {
  const f = fixture('hang'), started = Date.now();
  await assert.rejects(browserCheck({ url: 'http://localhost', executable: f.browser, cli: f.cli, output: join(f.root, 'timeout'), deadlineSeconds: 0.2 }));
  assert.ok(Date.now() - started < 3000);
  assert.ok(f.events().at(-1).includes('close'));
});
test('cleanup failure is surfaced, not falsely reported as success', async () => {
  const f = fixture('close-fail');
  await assert.rejects(browserCheck({ url: 'http://localhost', executable: f.browser, cli: f.cli, output: join(f.root, 'bad') }), /close broke/);
});
test('copied helper uses policy next to itself even from a different working directory', async () => {
  const f = fixture(), copied = join(f.root, 'runtime'); mkdirSync(copied);
  copyFileSync(helper, join(copied, 'browser-check.mjs'));
  writeFileSync(join(copied, 'browser-policy.json'), JSON.stringify({ available: true, executable: f.browser }));
  const loaded = await import(pathToFileURL(join(copied, 'browser-check.mjs')).href);
  assert.equal(loaded.findBrowser(), f.browser);
  writeFileSync(join(copied, 'browser-policy.json'), JSON.stringify({ available: false }));
  assert.throws(() => loaded.findBrowser(f.browser), /disabled/);
});
test('cached Chromium discovery uses numeric versions', () => {
  const root = scratch(), old = process.env.PLAYWRIGHT_BROWSERS_PATH;
  try {
    for (const version of ['99', '100']) { const directory = join(root, `chromium-${version}`, 'chrome-linux64'); mkdirSync(directory, { recursive: true }); executable(join(directory, 'chrome'), ''); }
    process.env.PLAYWRIGHT_BROWSERS_PATH = root;
    assert.match(findBrowser(), /chromium-100/);
  } finally { if (old === undefined) delete process.env.PLAYWRIGHT_BROWSERS_PATH; else process.env.PLAYWRIGHT_BROWSERS_PATH = old; }
});
test('interaction script runs within the bounded navigation/capture operation', async () => {
  const f = fixture(), script = join(f.root, 'interaction.mjs');
  writeFileSync(script, 'async page => { return { probe: "interaction sentinel" }; }');
  await browserCheck({ url: 'http://localhost', executable: f.browser, cli: f.cli, output: join(f.root, 'scenario'), script });
  const capture = f.events().find(args => args.includes('run-code')).at(-1);
  assert.match(capture, /interaction sentinel/);
  assert.match(capture, /scriptResult/);
});
test('SIGTERM closes the helper-owned session and exits143', async () => {
  const f = fixture('hang');
  const child = spawn(process.execPath, [helper, '--url', 'http://localhost', '--browser-executable', f.browser, '--output', join(f.root, 'interrupt')], { env: { ...process.env, PATH: f.root }, stdio: 'ignore' });
  const exited = new Promise(resolve => child.once('exit', resolve));
  const until = Date.now() + 3000;
  while (!f.events().some(args => args.includes('run-code')) && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(f.events().some(args => args.includes('run-code')));
  child.kill('SIGTERM');
  assert.equal(await exited, 143);
  assert.ok(f.events().at(-1).includes('close'));
});
