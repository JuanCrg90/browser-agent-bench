# Verification

The maintained offline suite needs no model/provider credentials and CI uses no real Pi session or submitted-app execution.

```sh
pnpm test
pnpm check
```

`pnpm test` uses local stubs and process fixtures. `pnpm check` performs JavaScript syntax checks only; it is not linting, typechecking, or a security audit. The root has no application build. The starter's install/build smoke is separate: initialize a new child workspace under a fresh external temporary parent using the default installer, then verify its frozen install and production build. A real Pi/browser compatibility smoke is separate and manual, not part of the offline suite or CI.

Example (use a new destination):

```sh
parent=$(mktemp -d)
pnpm bench:init mission-control "$parent/workspace" --no-install
cd "$parent/workspace"
pnpm install --frozen-lockfile
pnpm run build
```

The initializer already performs the frozen install by default; the explicit install above is a reproducibility check. Alternatively, use `--no-install` and run the explicit frozen install and build in the fresh child. Do not repeat the frozen install after the default initializer. Do not run the real-tool smoke against scored artifacts.

### Real-browser preflight

After installing playwright-cli and provisioning Chromium, this command checks the actual CLI and detected browser, opens and closes an isolated browser session, and prints its resolver output. It writes diagnostics only beneath a fresh temporary directory:

```sh
node --input-type=module <<'NODE'
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { preflight } from './scripts/runtime/browser-check.mjs';
const output = mkdtempSync(join(tmpdir(), 'browser-builder-preflight-'));
console.log(JSON.stringify(await preflight({ output }), null, 2));
NODE
```

This exercises the installed CLI/Chromium, not inferred version information; Chromium may require system libraries that are not installed by this project. No apt/sudo automation is provided. A real Pi completion and tool-cap compatibility check is a separate manual check; there is no public script for it, and this documentation does not claim it has been run. See [setup](SETUP.md).
