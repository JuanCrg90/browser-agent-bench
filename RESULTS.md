# Run record template

Copy this file per task/run. Keep records outside the model workspace. Use `unavailable` for unmeasured values, never an invented zero.

## Identity and environment

- Benchmark version: Browser Builder v1.1
- Date:
- Run ID / repetition (1–3):
- Task:
- Model ID / revision / file hash:
- Quantization:
- Provider / inference runtime and version:
- Inference CPU / GPU / RAM / VRAM:
- Browser machine hardware (if different):
- Context limit / compaction policy:
- Temperature / top-p / seed / other sampling settings:
- Prompt caching policy:
- Agent harness / version / system instructions:
- Available tools / browser tools / global skills:
- Node / pnpm / Vite / Three.js versions:
- Starter lockfile / prompt / harness runtime hashes:
- Browser version / OS / viewport / device scale / refresh rate:
- Enforced run lifetime / bash timeout; token/tool-count policy and accounting method:
- Manual stops, continuations, restarts, or coaching (and timestamps):
- Deviations / policy violations:

## Phase measurements

| Metric | Initial | Follow-up |
| --- | --- | --- |
| Elapsed wall time | | |
| Input tokens | | |
| Output tokens | | |
| Reasoning tokens (if exposed) | | |
| Time to first token | | |
| Runtime-reported decode tokens/sec | | |
| Tool calls | | |
| Peak inference VRAM | | |
| Stop reason: handoff / token / tool / timeout / error | | |
| Source snapshot path | | |
| Transcript / logs path | | |
| Screenshots / traces path | | |
| Build result | | |
| Test result | | |

## Initial functional checks

Enter 0 or 5 for each F item. Distinguish failure from inability to verify.

| Check | Score | Evidence / expected vs actual |
| --- | ---: | --- |
| F1 | | |
| F2 | | |
| F3 | | |
| F4 | | |
| F5 | | |
| F6 | | |
| F7 | | |
| F8 | | |
| F9 | | |
| F10 | | |
| Functional subtotal / 50 | | |

## Initial shared checks

| Dimension | Score | Evidence |
| --- | ---: | --- |
| Visual hierarchy / 5 | | |
| Interaction clarity / 5 | | |
| Layout and finish / 5 | | |
| R1: build and meaningful tests / 5 | | |
| R2: runtime/failure handling / 5 | | |
| Code clarity and reproducibility / 5 | | |
| Shared subtotal / 30 | | |

## Optional legacy follow-up checks

| Check | Score | Evidence / regressions |
| --- | ---: | --- |
| U1 | | |
| U2 | | |
| U3 | | |
| U4: all initial functional checks rerun | | |
| Follow-up subtotal / 20 | | |

- Initial subtotal / 80:
- Follow-up subtotal / 20:
- Default initial quality / 80:
- Optional legacy total quality / 100:
- Policy compliance: compliant / noncompliant (explain)
- Unverified items and blockers:
- Assumptions / evaluator notes:

## Optional WebGL rendering measurements

Inference stopped if sharing the GPU. Use the fixed procedure in `EVALUATION.md`.

| Trace | Median frame time (ms) | p95 frame time (ms) | Method / trace path |
| --- | ---: | ---: | --- |
| 1 | | | |
| 2 | | | |
| 3 | | | |

## Cross-model summary template

Fill this only after all three repetitions of all three tasks. Each task cell is median quality with min–max range; overall quality is the mean of the three task medians. Report per-task phase times in the detailed records rather than hiding slow tasks in one aggregate.

| Model / quantization | Dashboard median [range] | WebGL median [range] | Game median [range] | Overall initial quality / 80 | Failed or timed-out initial runs / 9 | Noncompliant runs / 9 |
| --- | --- | --- | --- | ---: | ---: | ---: |
| | | | | | | |

There are nine initial sessions per model. Legacy follow-ups, if used separately, are optional and not part of the default score. Preserve every run, including failures. Do not replace an unsuccessful run with a cherry-picked retry.
