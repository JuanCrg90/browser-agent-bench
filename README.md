# Browser Builder Benchmark v1.1

Three coding-agent tasks for comparing local models: a dashboard, a WebGL scene, and an HTML5 game. Measures browser-development quality, follow-up reliability, and inference efficiency separately. This is not a general programming benchmark.

## Quick start

**Linux only:** the launcher requires `/proc` for process ownership and cleanup. Maintainer tests additionally require Git and Python 3. Supported Node.js minimum is 22.19.0; the local reference environment is Node 26.10.0, pnpm 12.14.0, Pi 1.4.0, playwright-cli 0.1.21, and Chromium 156.0.8078.4. Pi 1.3.0 is historical only. These reference versions are not a claim of clean-machine validation. Use a configured provider/model ID from `pi --list-models`; choose an ID supported by your configured provider. Configure credentials yourself; this project does not edit global settings.

See [setup](docs/SETUP.md), [verification](docs/VERIFICATION.md), [security](SECURITY.md), [contributing](CONTRIBUTING.md), [license](LICENSE), and [third-party notes](THIRD_PARTY.md).

Before the first command, replace each `PROVIDER/MODEL` placeholder with an exact ID listed by `pi --list-models` for your configured provider. Use fresh destination children such as these for each run.

From this directory, initialize a new run and immediately open an interactive Pi session:

```sh
pnpm bench:init mission-control ../benchmark-runs/mission-1 \
  --model PROVIDER/MODEL --thinking low --start
```

The initializer copies the frozen starter, installs dependencies with `pnpm install --frozen-lockfile`, stages only the initial prompt and appropriate fixture, and launches Pi after setup succeeds. The prompt is sent automatically; no copy/paste is needed. Installation time is outside the benchmark timing.

To prepare now and open Pi later:

```sh
pnpm bench:init orbital-lab ../benchmark-runs/orbital-1 \
  --model PROVIDER/MODEL
cd ../benchmark-runs/orbital-1
node start-benchmark.mjs
```

You can omit `--model` during initialization and select it when launching instead:

```sh
pnpm bench:init reactor-escape ../benchmark-runs/game-1
cd ../benchmark-runs/game-1
node start-benchmark.mjs --model PROVIDER/MODEL --thinking low
```

Use exact provider/model IDs from `pi --list-models`; use the `openai-codex` provider for GPT models. The launcher requires an explicit model rather than silently using Pi's global default. Pi may clamp thinking levels to model capabilities; verify the effective level in the session and record it.

### Initializer options

```text
pnpm bench:init TASK DESTINATION [--model PROVIDER/ID] [--thinking LEVEL] [--run-timeout-seconds N] [--command-timeout-seconds N] [--browser-executable PATH] [--no-browser] [--start] [--no-install]
```

- Tasks: `mission-control`, `orbital-lab`, `reactor-escape`.
- `DESTINATION`: a new path outside this benchmark source directory. Existing destinations, including empty directories, are refused; no files are overwritten or deleted.
- `--model`: model to use when launching; can be overridden through the generated launcher.
- `--thinking`: `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, or `max`; defaults to `low`.
- `--run-timeout-seconds`: positive finite lifetime deadline (default 3600; maximum 86400). It starts when Pi starts, excludes setup/browser preflight, includes idle TUI time, and is not reset by manual continuation.
- `--command-timeout-seconds`: positive finite cap for every Pi `bash` call (default 120; maximum 86400). Missing, invalid, and longer requested tool timeouts are capped; shorter valid requests are retained.
- `--browser-executable`: explicit cached Chromium executable. The default detects the locally installed Playwright Chromium; nothing is downloaded.
- `--no-browser`: explicit offline/no-browser policy. The model is told browser verification is unavailable.
- `--start`: open interactive Pi after installation; requires `--model` and cannot be combined with `--no-install`.
- `--no-install`: generate files without installing dependencies. Before launching, run `pnpm install --frozen-lockfile` in the generated workspace.
- `--help`: show usage without creating files.

Initialization works from other directories using `node /absolute/path/to/browser-builder-benchmark/scripts/init-workspace.mjs ...`. Destination paths are relative to your current directory, not the script directory. If installation fails, the command exits unsuccessfully and retains the partial workspace for inspection; it never launches Pi. Repair the dependency problem and install there, or choose a new destination for a fresh run.

### Generated workspace

- `package.json`, `pnpm-lock.yaml`, `index.html`, and `src/`: the identical minimal starter for every task.
- `BENCHMARK_PROMPT.md`: shared instructions plus the selected initial task.
- `public/mission-control.json`: dashboard data, only for Mission Control.
- `start-benchmark.mjs`: small standalone interactive Pi launcher. It accepts model/thinking/limit/browser overrides and imports only copied `.benchmark/` runtime modules.
- `.benchmark/run.json`: task, setup status, requested model/thinking, timestamps, Node/pnpm pin, and lockfile/prompt hashes. Requested values are not proof of the effective model or thinking level.
- `.benchmark/sessions/`: Pi's persisted sessions after launching.

The launcher disables discovered extensions, MCP, skills, prompt templates, themes, context files, and project-trust resources. It validates and explicitly loads only its copied `.benchmark/limits.mjs` after `--no-extensions`. The guard disables tools at session startup and enables them only after a nonce/PID-bound launcher approval; a missing or invalid handshake stops the run. It keeps your configured model catalog and credentials. Browser preflight verifies the installed `playwright-cli` and launches/closes cached Chromium before the Pi timer begins. The copied `.benchmark/browser-check.mjs` is the standardized bounded loopback browser checker; it captures snapshot, screenshot, and diagnostics and always closes its own session. No browser installation/download or global configuration write occurs.

These flags reduce accidental context differences; they are **not a sandbox**. The model can still read files and run commands with your account's permissions. Evaluator/follow-up files are not copied into the workspace, but use OS/container isolation if they must be inaccessible. `--offline` disables Pi startup network requests, not inference traffic or network-capable tools.

The scripts enforce only a wall lifetime deadline and bash-call timeout cap; they do not yet enforce token or tool-call-count caps. A deadline records exit 124; SIGINT/SIGTERM delivered to the launcher record 130/143; ordinary Pi exits are preserved. Pi's own interactive Ctrl-C may abort only the current agent operation, not the launcher, and does not reset the lifetime deadline. Metadata records selected limits, timing, stop reason, and whether Pi finished before the lifetime deadline. A successfully settled answer is tracked separately from process exit; if the lifetime expires afterward, exit 124 is still recorded with `deadline-after-agent-completed` rather than implying the answer was unfinished. Every launch starts a fresh initial session; do not use the launcher to resume a follow-up. Default evaluation is initial-only /80. Legacy follow-ups remain optional documentation and are not launched, prompted, or coached automatically.

## Files

| File | Audience | Purpose |
| --- | --- | --- |
| [COMMON.md](COMMON.md) | Model | Shared implementation instructions |
| [01-mission-control.md](prompts/01-mission-control.md) | Model, initial phase | Dashboard task |
| [02-orbital-lab.md](prompts/02-orbital-lab.md) | Model, initial phase | WebGL task |
| [03-reactor-escape.md](prompts/03-reactor-escape.md) | Model, initial phase | Canvas game task |
| [followups/](followups/) | Model, follow-up phase only | One fixed change per task |
| [mission-control.json](fixtures/mission-control.json) | Dashboard model | Fixed input data |
| [EVALUATION.md](EVALUATION.md) | Evaluator only | Checks and scoring |
| [RESULTS.md](RESULTS.md) | Evaluator only | Reusable run record |
| [scripts/init-workspace.mjs](scripts/init-workspace.mjs) | Operator | Workspace initializer and launcher generator |
| [starter/](starter/) | Initializer | Frozen empty Vite app and dependency lockfile |
| [tests/](tests/) | Maintainer | Offline CLI, safety, and launcher regression tests |

## 1. Prepare one starter

Use the initializer above to copy the supplied empty vanilla JavaScript + HTML + CSS Vite app into an isolated scratch directory. Its commands are:

- `pnpm run dev --host 127.0.0.1`: starts the development server.
- `pnpm run build`: produces a production build.
- `pnpm run preview --host 127.0.0.1`: serves the production build.
- `pnpm test`: runs `node --test`.

Use pnpm exclusively. The supplied starter pins Vite 8.3.4, Three.js 0.186.1, pnpm 12.14.0, and transitive dependencies through `pnpm-lock.yaml`. It contains no task implementation. Do not regenerate the lockfile or update versions between compared runs. If you deliberately adopt a different starter, freeze and record it for the entire comparison; do not mix results from different starter hashes.

Use the same frozen starter, including Three.js, for every task and model. Dependency installation happens before timing. Do not resolve fresh package versions for each run. The model may import Three.js only in Orbital Lab.

Provide browser inspection tools to every model or none; record the policy. If unavailable, models must disclose that limitation rather than claim browser verification. Do not preload task-specific solutions, tests, design assets, or libraries.

## 2. Start an initial phase

1. Initialize a new destination with the chosen task/model; the script copies the starter and performs the frozen installation outside the timed session.
2. For Mission Control, the initializer stages `fixtures/mission-control.json` at `public/mission-control.json` automatically.
3. Use `--start` or the generated launcher to open a fresh session with the same system instructions, tools, and permissions across models. No reviewer agents or external model assistance.
4. The launcher submits `BENCHMARK_PROMPT.md`, containing the complete text of `COMMON.md` followed by the chosen task, as the initial message.
5. The launcher starts its enforced lifetime timer when Pi starts (after install/browser preflight), before submitting the prompt; it includes idle TUI time and never resets. Let the model inspect, implement, and verify within the budget.
6. Stop when it hands off or reaches a limit. Save its transcript, source, build output, and screenshots as the initial snapshot before sending any follow-up.
7. Evaluate the initial snapshot using `EVALUATION.md`. Do not send evaluation feedback to the model.

Keep evaluator files and unreleased follow-ups outside the model's accessible workspace. Do not give it this entire directory.

## 3. Optional legacy follow-up

Continue the same conversation and workspace, using the matching file from `followups/` verbatim. Do not add bug reports, hints, or custom coaching. Start a separate timer and budget. Save and evaluate the final snapshot independently. Do not let follow-up repairs retroactively improve the initial score.

If the initial output does not run, still send the same follow-up; score each phase from its actual evidence. A blocked run gets no ad hoc rescue prompt.

## 4. Initial-only budgets and repeats

Recommended starting preset, fixed before comparing models: the enforced initial-session wall deadline is 60 minutes and every bash call is capped at 120 seconds. Token and tool-call counts are record-only until a future harness version enforces them. Legacy follow-up budgets are optional and are not part of the default /80 evaluation.

Stop at the first reached limit. Include reasoning tokens where the provider exposes them; record the accounting method. Tokenizers differ, so this is a practical agent-budget comparison, not identical compute. If the harness cannot enforce a limit, choose and record a supported policy before all runs rather than silently varying it. Keep context size sufficient and equal where supported; record truncation/compaction.

Run each task three times per model: nine fresh initial sessions. No follow-ups are required. Randomize model/task order. Preserve failed and timed-out runs. Report median and range per task; overall quality is the mean of the three task medians.

## 5. Report quality and speed separately

Record model identifier/version, model-file hash if available, quantization, inference runtime/version, CPU/GPU/RAM/VRAM, context size, sampling settings, prompt caching policy, tool availability, and dependency/browser versions. Record inference hardware and browser hardware separately when different.

Report initial and follow-up elapsed time, input/output/reasoning tokens where available, time to first token, decode tokens/sec if provided by the runtime, tool calls, peak VRAM if available, stop reason, and quality scores. Do not derive decode speed from total agent time, which includes tools and builds.

When inference and rendering share a GPU, stop inference before browser performance measurements. Fix browser version, viewport, device scale factor, display refresh rate, and renderer. Measure rendering in a foreground tab on the production build.

Use `RESULTS.md` for each run. Do not combine quality and speed into an unexplained single number.

## Browser checks

After building and starting a preview server with its logs captured, use the same helper for every model:

```sh
node .benchmark/browser-check.mjs --url http://127.0.0.1:4173/ --width 375 --height 812
node .benchmark/browser-check.mjs --url http://127.0.0.1:4173/ --width 1440 --height 900
```

For interaction tests, write a local function-expression file (no imports/exports), for example:

```js
async page => {
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  return { title: await page.title() };
}
```

Pass it using `--script ./browser-checks.mjs`. It runs after navigation inside the same isolated, time-bounded session. Navigation/interaction console errors, page errors, and the script's return value are captured in the console-result file. The helper prints paths to the DOM snapshot, screenshot, console result, and command diagnostics. Capture is evidence, not an automatic acceptance score; inspect the output and never claim the app passed just because the helper exited successfully.

## Continuing existing runs

New guardrails apply only to newly initialized v1.1 workspaces. Existing workspaces and running Pi sessions are not patched or restarted. A manually stopped/resumed old run should be labeled as such; do not compare it as an uninterrupted timed run. Use a new destination for the next comparable attempt. v1.1 changes shared tool instructions and browser policy, so keep its results separate from v1.0 baselines. Record `runtimeSha256` as well as prompt/starter hashes.

## Maintainer verification

```sh
pnpm test
pnpm check
```

These run the initializer's offline regression tests and JavaScript syntax checks using Node built-ins; no root dependencies are needed. The tests use stub package-manager/model commands and do not start a real model. Separately smoke-test real setup with a new temporary workspace, then run `pnpm run build` there. A starter's empty test suite is intentional; the evaluated model must add meaningful behavioral tests to earn rubric credit.

## Guardrail limitations

The Linux launcher uses `/proc` parent/start-time identity snapshots to terminate Pi and descendants it observes. It never uses `pkill`/`killall` or touches unrelated pre-existing servers/browsers. A hostile process that deliberately daemonizes/reparents before collection can escape ownership tracking; this is not a sandbox. Browser checks accept only loopback HTTP(S) target URLs; this is not an outbound-network sandbox. The helper operation deadline is at most 90 seconds, plus at most 5 seconds for closing its own session. If the helper is forcibly killed before cleanup, its isolated browser has a 30-second idle timeout as a fallback. Linux/POSIX cleanup is required; other platforms fail clearly.

## Scope and limitations

No deployment, backend, accounts, mobile game controls, real astronomical physics, or downloaded art. Evaluator checks are manual protocols, not an implemented automated application acceptance suite. Model-written tests support the evidence but never replace independent checks. This package contains prompts, evaluation documents, a frozen starter, and workspace setup/session-launch scripts; it is not an automatic scoring runner.
