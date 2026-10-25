# Setup

This repository and launcher support Linux only; `/proc` is required. Prerequisites are user-supplied Node.js >=22.19.0, Linux, Git, and Python 3 (Git/Python 3 are needed for maintainer tests). The local reference setup is Node 26.10.0, pnpm 12.14.0, Pi 1.4.0, playwright-cli 0.1.21, and Chromium 156.0.8078.4; these are reference values, not universal compatibility guarantees.

## Tool versions and installation

Root tool pins: pnpm 12.14.0 (`packageManager`); Node minimum 22.19.0 (`engines`). The frozen starter pins Vite 8.3.4 and Three.js 0.186.1. Pi and playwright-cli are external tools, not root dependencies. NPM top-level pins do not freeze transitive dependencies; record resolved versions and browser details for comparisons.

If you need the tools, you can provision an isolated user-owned prefix. Run this yourself in your shell; it changes only this shell's PATH and does not replace an existing working toolchain. Choose a fresh prefix if this one already contains tools you rely on. No sudo or configuration edits are needed. This is a convenience for isolated installation, not a permissions bypass; Pi's normal npm install works without lifecycle scripts (see the [Pi 1.4 README](https://github.com/earendil-works/pi/tree/main/packages/coding-agent)).

```sh
tools="$HOME/.local/share/browser-builder-tools"
npm install --global --prefix "$tools" --ignore-scripts pnpm@12.14.0 @earendil-works/pi-coding-agent@1.4.0 @playwright/cli@0.1.21
export PATH="$tools/bin:$PATH"
node --version
pnpm --version
pi --version
playwright-cli --version
pi --offline --list-models
```

See the current [Pi coding-agent source](https://github.com/earendil-works/pi/tree/main/packages/coding-agent) and its [model documentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/models.md). Model/provider authentication is user-managed: use `/login` for supported built-in providers, or configure compatible external endpoints in private `models.json` under `PI_CODING_AGENT_DIR` (default `~/.pi/agent`). Never commit credentials or private configuration. This project does not change global settings. External provider compatibility and transitive package versions are not guaranteed by these pins.

From the repository root, install the repository's locked dependencies (there are no root dependencies):

```sh
pnpm install --frozen-lockfile
```

## Browser policy

Provision Chromium before timing, for example with `playwright-cli install-browser chromium`; this command is outside benchmark timing. Record the resolver's actual result and executable hash, rather than assuming a particular build. To print the detected executable/version and hash:

```sh
node --input-type=module -e 'import { findBrowser } from "./scripts/runtime/browser-check.mjs"; import { execFileSync } from "node:child_process"; const browser = findBrowser(); console.log(browser); console.log(execFileSync(browser, ["--version"], { encoding: "utf8" }).trim());'
browser=$(node --input-type=module -e 'import { findBrowser } from "./scripts/runtime/browser-check.mjs"; console.log(findBrowser())')
sha256sum "$browser"
```

Chromium 156.0.8078.4 is a local reference, not a promise that `install-browser` produces that build. The initializer does not download a browser. Its default discovers locally cached Playwright Chromium; `PLAYWRIGHT_BROWSERS_PATH` controls the browser cache and `BENCHMARK_BROWSER_EXECUTABLE` can provide an executable path. Record actual paths and versions. Browser packages may have external system-library requirements; resolve those in your environment without assuming this project installs them. `--no-browser` is an explicit, incomparable no-browser policy, not an automatic fallback; compare only runs with the same declared policy. See [Playwright CLI](https://github.com/microsoft/playwright-cli) and [Playwright browser management](https://playwright.dev/docs/browsers).

See the [README](../README.md) for invocation and benchmark protocol, and [verification](VERIFICATION.md) for maintained checks.
