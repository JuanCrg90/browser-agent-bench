# Shared implementation instructions

You are being evaluated as a coding agent. Implement the task that follows in the current workspace; do not merely describe a solution.

## Environment and constraints

- The workspace contains an empty vanilla JavaScript Vite starter. Use HTML, CSS, and JavaScript ES modules, without a UI framework or TypeScript.
- Use pnpm exclusively, with the version pinned in `package.json`. Preserve `pnpm-lock.yaml`.
- Vite and Three.js are already installed and pinned. Three.js is permitted only for the WebGL task. Do not add or upgrade dependencies, change the lockfile, or use a CDN.
- No backend, external APIs, remote assets, downloaded fonts, external code search, or other model/agent assistance. Use procedural graphics, CSS, system fonts, and supplied data. Local installed package source/documentation may be inspected.
- Preserve the provided dev/build/preview/test commands. Add application code and meaningful tests using the available tooling. Do not weaken or remove existing checks.
- Read `.benchmark/browser-policy.json` before browser verification. When it says available, use only `node .benchmark/browser-check.mjs --url http://127.0.0.1:PORT --width N --height N [--script ./browser-checks.mjs]`; the optional script is a Playwright `async page => { ... }` function expression for exercising interactions in the same bounded session. It accepts loopback HTTP URLs only, creates an isolated session, and records snapshot/screenshot/diagnostics paths. Keep both dev-server streams in a documented log if redirecting them. Firefox `--dump-dom` is unsupported. When policy says unavailable (`--no-browser`), state that browser behavior was not verified; do not invent results.
- Every bash call is capped at 120 seconds by default; the whole Pi session has a 60-minute lifetime deadline. Do not alter or bypass the launcher, guard, browser helper, or browser policy. Longer-lived dev servers must run in the background with visible log paths.
- Implement only the current request. Do not anticipate future features.
- Do not ask clarifying questions. Use the explicit requirements; for unspecified details choose a simple reasonable behavior and document it.

## Quality bar

Deliver a complete usable application, not a static mockup, placeholder, or screenshot. Prefer clear code and reliable behavior to unnecessary abstractions. Use real controls with accessible names. Make instructions, errors, and application state visible. Avoid unexpected external requests and uncaught errors.

Use elapsed time, not frame counts, for animation or game logic. Handle browser resizing appropriately. Storage failures must not prevent use of the app.

## Verification and handoff

Before handing off, run `pnpm test` and `pnpm run build`. Add focused logic tests appropriate to the task. If browser tools exist, inspect the application and exercise its main interactions. Report failures honestly.

Create an application `README.md` containing startup commands, controls, implementation notes, and known limitations.

In your final response include:

1. What you implemented and the principal files changed.
2. Commands actually run and their outcomes.
3. Browser checks actually performed, if any.
4. Known failures, assumptions, and incomplete requirements.

Do not claim a check passed unless you ran it. Do not commit or push changes.
