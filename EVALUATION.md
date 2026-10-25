# Evaluator guide — do not send to the model

## Rules

Evaluate the initial snapshot before the follow-up. Use a fresh browser profile or clear origin storage before each task run. Preserve storage only for explicit reload/persistence checks. Use the production build when available; if it fails, record that and inspect the dev version where possible without repairing source.

Each F and U item is worth 5 points, awarded only if every clause passes. A blocked or unverified item scores 0; explain whether it failed or could not be checked. No points for code that merely appears to implement the feature. Use independent browser checks and, where useful, an evaluator-owned temporary logic harness outside the submitted source. Never modify the solution to make it pass. Model-written tests alone are insufficient evidence.

Default evaluation is initial-only: F1–F10 (50) plus visual quality, robustness, and maintainability (30), maximum 80. The legacy follow-up U1–U4 (20) is optional comparison documentation only; this v1.1 launcher does not implement or send follow-ups. Do not coach a model from evaluation results.

Capture reproducible evidence: viewport, steps, expected/actual outcome, screenshot or trace path, and console output. During evaluation, interference such as model inference on a shared GPU must be stopped.

## Task 1: Mission Control

At untouched fixture state expect 12 tasks: 4 Todo, 4 In progress, 4 Done, 4 overdue, 33% complete. Project progress: Launchpad 25%, Observatory 50%, Workbench 25%. Overdue IDs: t02, t06, t09, t11. t04 is due on the reference date and is not overdue; completed historical tasks are not overdue.

| ID | Check (5 points each) |
| --- | --- |
| F1 | Fixture loads; all three projects and all 12 tasks are represented with the correct fields. |
| F2 | All global counts and project/overall percentages match the untouched fixture expectations above. |
| F3 | Search `REVIEW` finds t02, t06, t11. Adding Todo leaves t11; adding Launchpad leaves no matches. Search also matches assignee substrings case-insensitively. |
| F4 | Ascending deadline order is t01,t09,t05,t10,t02,t11,t06,t07,t04,t03,t12,t08. Descending reverses date groups but keeps ID ascending within ties. Filtering does not break sorting. |
| F5 | Editing t02 to Done updates its row, global Done to 5, In progress to 3, overdue to 3, Launchpad to 50%, and overall completion to 42%. |
| F6 | Blank/whitespace title or assignee and an invalid/empty date cannot save. Valid edits to every permitted field save; Cancel discards modifications. |
| F7 | Save a distinctive title and status, reload twice, and verify edits and summaries survive with exactly 12 tasks and no duplicates. |
| F8 | Keyboard-only modal operation: accessible name, initial focus inside, Tab and Shift+Tab contained, Escape closes, sensible focus restored even if filtering removed the edited row. |
| F9 | Unmatched search shows a useful empty state; Clear filters restores all 12 tasks. Global summaries do not change just because filters change. |
| F10 | With storage cleared, block/delay the fixture request using browser tools: loading is visible; failure shows an error and retry; unblocking and retrying loads the fixture. |

### Follow-up

| ID | Check (5 points each) |
| --- | --- |
| U1 | Edit t02, save, reload twice, then Undo. Every edited field and all summaries return to the original values; reload confirms the restored values persist. Undo is then unavailable. |
| U2 | Save edit A to t02, then edit B to t03. Undo restores only B. A remains saved; Cancel and invalid saves do not replace the pending undo entry. |
| U3 | Filter to In progress; change t02 to Done so it disappears. Undo brings it back under the same filters/sort and preserves usable keyboard focus. No edit means no available undo; malformed undo data does not crash or corrupt the task list. |
| U4 | Rerun F1–F10 from appropriate clean/controlled state. All still pass. |

## Task 2: Orbital Lab

For timing checks, use an independent logic probe if exported functions permit it; also exercise the real UI. For example, Ember at simulation time 2 is approximately (0, 0, 3), at 4 is (-3, 0, 0), and at 8 is (3, 0, 0), within 0.01 units. At speed 2x, 3 seconds of active elapsed time advances simulation time by 6 seconds. A 5-second pause advances it by 0. Do not judge time scaling from screenshots alone.

| ID | Check (5 points each) |
| --- | --- |
| F1 | One star and exactly five planets, orbit paths, correct fixed data, and an initial overview showing the complete system. |
| F2 | Orbital positions and periods follow the specified equations, including the known-time examples, without depending on frame rate. |
| F3 | Mouse orbit, zoom, pan, and Reset view work. Reset returns the initial overview without resetting simulation time. |
| F4 | Clicking each visible planet selects that planet and displays all specified information. A camera drag does not inadvertently select another planet. |
| F5 | Keyboard-operable HTML selection chooses each planet and produces the same information/selection indication as pointer picking. |
| F6 | Pause freezes displayed time and orbital positions for at least 5 seconds while selection and camera controls remain usable; resume continues without a jump. |
| F7 | Slider spans 0.25x–4x and shows its value; changes preserve current simulation time/position, and subsequent advancement scales correctly. |
| F8 | Hide the tab for at least 5 seconds, return, and confirm no hidden-time catch-up jump; subsequent movement resumes normally. |
| F9 | At both specified viewports and after repeated resizing, canvas size/aspect match its container and all controls remain accessible. |
| F10 | In a browser context with WebGL disabled before load, the app shows a useful HTML fallback without an uncaught initialization error. |

### Follow-up

| ID | Check (5 points each) |
| --- | --- |
| U1 | Follow is disabled without selection. Enabling it preserves camera position and target; subsequent frames translate both by the selected planet's displacement within numerical tolerance. Orbit/zoom remain usable without snapping. |
| U2 | Switch planets while following: no immediate camera/target jump; subsequent translation follows the new selection. Disabling follow preserves current camera/target. |
| U3 | Pausing stops follow translation while camera controls remain usable. Reset view disables follow and restores the original overview. |
| U4 | Rerun F1–F10. All still pass. |

### Rendering report (not quality points)

On the production build at 1440 x 900, fixed device scale factor 1, and the app's pixel-ratio cap of 2: reset view, run at 1x, warm up for 10 seconds, then collect a 30-second foreground frame-time trace. Record median and p95 frame time, browser/GPU/refresh rate, and method. Repeat three times. Do not compare traces from different hardware as if they measure model inference performance. Leave results unavailable if tracing is not supported; do not substitute a guessed FPS value.

## Task 3: Reactor Escape

Use the specified level and world coordinates. Do not award points for a different randomly generated or simplified level. For timing/physics comparisons, independently exercise the submitted simulation at 30, 60, and 120 steps/second for the same 1-second input sequence where feasible. Collision-free displacement should differ by at most 2 world units. Browser observations must corroborate logic probes.

| ID | Check (5 points each) |
| --- | --- |
| F1 | Title/instructions, start, gameplay HUD, pause, win, and lose states exist and transition correctly. |
| F2 | Specified player, all walls, five cells, exit, and three enemies are present at the fixed coordinates; enemies follow the specified patrols. |
| F3 | WASD/arrows work; diagonals are not faster; equivalent elapsed input gives consistent movement at 30/60/120 FPS. Game keys do not scroll gameplay or hijack unrelated controls. |
| F4 | Walking into each wall and border cannot penetrate it; diagonal movement can slide along walls. Slow-frame or equivalent deterministic tests do not tunnel through geometry. |
| F5 | Every cell increments the count once and disappears. Exit overlap before five cells cannot win; after five it does. |
| F6 | Enemy contact removes one health, immunity prevents further damage for one active second, immunity is visible, and zero health produces a stopped lose state. |
| F7 | Button/P/Escape pause freezes player, enemies, immunity, and timer. Lost focus/hidden tab auto-pauses; returning does not auto-resume or cause a jump. |
| F8 | Restart from paused/won/lost resets all specified state. Ten restarts do not multiply movement speed, key handling, patrol speed, or animation loops. |
| F9 | Only a faster successful completion replaces the saved best active-play time. A slower win or loss does not; record survives reload and appears on title/results. |
| F10 | At 1440 x 900 and 800 x 600, the canvas remains within the page, aspect ratio is preserved, and scaling does not change collision geometry. |

### Follow-up

| ID | Check (5 points each) |
| --- | --- |
| U1 | Space dashes at 600 units/second for 0.15 active seconds; direction locks to current/last movement, normalized diagonally, defaulting right. Holding Space does not auto-repeat, and cooldown prevents reactivation for 2 active seconds from activation. |
| U2 | Dash cannot cross any wall or border, including under slow-frame conditions; cells, exit, and enemy contact still work along the traversed path. Dash itself adds no damage immunity. |
| U3 | Visible readiness matches cooldown. Pause freezes dash/cooldown, and restart clears both and restores default last direction. |
| U4 | Rerun F1–F10. All still pass. |

## Shared initial-snapshot scoring: 30 points

### Visual quality and usability: 15

Score each dimension 0, 3, or 5. Use anonymized screenshots and the same interaction script where practical. Two independent human ratings are preferable; if used, average them and record disagreement.

| Dimension | 0 | 3 | 5 |
| --- | --- | --- | --- |
| Hierarchy/readability | Core information unreadable or missing | Readable but inconsistent/crowded | Clear typography, spacing, grouping, and contrast throughout |
| Interaction clarity | Controls/states misleading or undiscoverable | Core controls understandable, some weak feedback | Clear labels, instructions, selection, validation, and state feedback |
| Layout/finish | Broken primary layout or unusable controls | Usable with minor layout defects | Coherent finish and usable layouts at every required viewport |

Do not reward extra unrequested features, expensive assets, or a preferred personal art style.

### Robustness: 10

- **R1 — 5 points:** Evaluator independently runs `pnpm run build` and `pnpm test`; both succeed, and the test suite has at least one meaningful behavioral assertion. Empty/placeholder tests do not qualify.
- **R2 — 5 points:** Full normal interaction script produces no uncaught exceptions or unexpected external requests; relevant failure/cleanup checks below also pass.
  - Dashboard: malformed task storage and denied localStorage do not crash; fixture data remains usable and user input is not executed as HTML.
  - WebGL: source inspection confirms teardown cancels scheduling, removes listeners, disposes controls/renderer and scene resources. Exercise teardown/reinitialization if an entry point exists; distinguish inspection from runtime evidence.
  - Game: malformed best-time storage and denied localStorage do not crash; holding a movement key across blur/resume does not leave movement stuck after release.

Block/clear storage only within the isolated app origin. When injecting malformed JSON, identify the application's actual keys rather than assuming a schema.

### Code clarity and reproducibility: 5

- **0:** No usable startup instructions, or largely opaque/incomplete source.
- **3:** Reproducible setup and understandable code, with some tangled logic or weak tests.
- **5:** Accurate README, clear separation of core logic from rendering/UI, meaningful task-specific tests, and honest limitations. Small applications do not need elaborate architecture.

## Results policy

Record all F/U/V/R/code scores and their evidence, including 0 for failed or unverified items. Keep the initial and final artifacts. Flag dependency/stack/network-policy violations and report such runs separately from compliant runs; do not silently rank them as comparable. Quality remains distinct from wall time, inference throughput, and browser frame time. See `README.md` for repeat/aggregation rules and `RESULTS.md` for the record template.
