// Explicit, workspace-local Pi extension. It deliberately records no command text.
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const configured = Number(process.env.BENCHMARK_COMMAND_TIMEOUT_SECONDS);
const cap = Number.isFinite(configured) && configured > 0 ? configured : 120;
const deadlineMs = Number(process.env.BENCHMARK_DEADLINE_MS);
const root = resolve(process.env.BENCHMARK_GUARD_DIR || process.cwd());
const nonce = process.env.BENCHMARK_GUARD_ATTEMPT_NONCE || '';
const launcherPid = Number(process.env.BENCHMARK_GUARD_LAUNCHER_PID);
const log = resolve(root, '.benchmark/tool-events.jsonl');
const handshake = resolve(root, '.benchmark/guard-loaded.json');
const approval = resolve(root, '.benchmark/guard-approved.json');
const phase = resolve(root, '.benchmark/phase.json');
const now = () => new Date().toISOString();
function record(event) {
  try { mkdirSync(dirname(log), { recursive: true }); appendFileSync(log, JSON.stringify({ at: now(), ...event }) + '\n'); } catch { /* diagnostics must not break Pi */ }
}
function effectiveTimeout(value) {
  const requested = Number(value);
  const requestedCap = Number.isFinite(requested) && requested > 0 ? Math.min(requested, cap) : cap;
  const remaining = Number.isFinite(deadlineMs) ? Math.max(0.001, (deadlineMs - Date.now()) / 1000) : requestedCap;
  return Math.min(requestedCap, remaining);
}
function sameAttempt(value) {
  return value && value.nonce === nonce && Number(value.piPid) === process.pid && Number(value.launcherPid) === launcherPid;
}
function readJson(file) { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } }
function latestAssistantStopReason(ctx) {
  // agent_settled intentionally has no result. The session branch is authoritative,
  // including after recovery/compaction, so inspect its most recent assistant message.
  try {
    for (const entry of ctx.sessionManager.getBranch().slice().reverse()) {
      const message = entry?.type === 'message' ? entry.message : null;
      if (message?.role === 'assistant') return message.stopReason;
    }
  } catch { /* a missing session is not a successful completion */ }
  return null;
}

export { effectiveTimeout };
export default function benchmarkLimits(pi) {
  pi.on('session_start', () => {
    pi.setActiveTools([]);
    try {
      writeFileSync(handshake, JSON.stringify({ nonce, piPid: process.pid, launcherPid, loadedAt: now(), commandTimeoutSeconds: cap }) + '\n');
    } catch { /* launcher notices absent handshake */ }
    record({ type: 'guard-loaded', commandTimeoutSeconds: cap });
  });
  pi.on('before_agent_start', async (_event, ctx) => {
    record({ type: 'agent-start', messageType: _event.messageType ?? 'unknown' });
    // A continuation is not a completion; invalidate a prior successful settle.
    try { rmSync(phase, { force: true }); } catch { /* best effort */ }
    // Pi begins a prompt after session_start. Do not permit its first provider request
    // until this exact process/attempt has received launcher approval.
    const until = Date.now() + 5000;
    while (Date.now() < until) {
      if (sameAttempt(readJson(approval))) {
        pi.setActiveTools(['read', 'bash', 'edit', 'write', 'grep', 'find', 'ls']);
        return;
      }
      await new Promise(resolveDelay => setTimeout(resolveDelay, 20));
    }
    record({ type: 'guard-approval-missing' });
    ctx.abort();
  });
  pi.on('agent_settled', (event, ctx) => {
    const stopReason = latestAssistantStopReason(ctx);
    if (event.aborted || stopReason !== 'stop') {
      record({ type: 'agent-settled-unsuccessful', aborted: Boolean(event.aborted), stopReason });
      return;
    }
    try { writeFileSync(phase, JSON.stringify({ nonce, piPid: process.pid, completedAt: now(), stopReason }) + '\n'); } catch { /* metadata is best effort */ }
    record({ type: 'agent-settled-success' });
  });
  pi.on('tool_call', (event) => {
    if (Number.isFinite(deadlineMs) && Date.now() >= deadlineMs) return { block: true, reason: 'Benchmark lifetime deadline has elapsed.' };
    if (event.toolName !== 'bash' || !event.input || typeof event.input !== 'object') return;
    const requestedTimeoutValid = Number.isFinite(Number(event.input.timeout)) && Number(event.input.timeout) > 0;
    const timeout = effectiveTimeout(event.input.timeout);
    // Pi retains this object by reference; replacing it silently bypasses the tool args.
    event.input.timeout = timeout;
    record({ type: 'bash', toolCallId: event.toolCallId, effectiveTimeoutSeconds: timeout, requestedTimeoutValid });
  });
}
