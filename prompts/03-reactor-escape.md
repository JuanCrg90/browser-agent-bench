# Task 3: Reactor Escape

Build a complete top-down HTML5 Canvas survival game. The player must collect five energy cells and then reach an exit while avoiding moving enemies. Use Canvas 2D and generated graphics; no game engine.

## Fixed level

Use a logical 800 x 600 playfield with a 20-unit solid border. Coordinates below are logical world units, independent of CSS size.

- Player: circle, radius 12, starts at (60, 60), speed 180 units/second, 3 health.
- Walls: axis-aligned rectangles `(x, y, width, height)` at (180, 100, 30, 300), (360, 0, 30, 260), and (540, 300, 30, 280). The border still applies where a wall reaches the edge.
- Energy cells: circles, radius 8, centered at (110, 500), (280, 100), (460, 480), (650, 120), and (720, 500).
- Exit: rectangle at (730, 30, 40, 40).
- Enemy A: circle, radius 14, patrols horizontally between (240, 300) and (320, 300), at 100 units/second.
- Enemy B: circle, radius 14, patrols vertically between (460, 80) and (460, 420), at 120 units/second.
- Enemy C: circle, radius 14, patrols horizontally between (620, 240) and (740, 240), at 140 units/second.

Enemies begin at their first endpoint, move toward the second, and reverse at endpoints. Render from these world coordinates; do not randomize the level.

## Required features

1. Provide a title screen with instructions and a Start button, active gameplay, a paused state, a win screen, and a lose screen. Clearly show health, collected cells, and elapsed time.
2. Support WASD and arrow-key movement. Normalize diagonal input so it is not faster. Prevent game keys from scrolling the page while gameplay has focus; do not hijack keys in unrelated HTML controls.
3. Solid walls and the border block the player's circle. Use stable collision handling so fast movement or a slow frame does not tunnel through walls. Sliding along a wall must remain possible.
4. Collect a cell when the player's circle overlaps it. Each cell counts once and disappears after collection. The exit wins only when all five have been collected and the player overlaps it.
5. Enemy contact removes one health, then grants one second of damage immunity. Clearly indicate immunity. At zero health, stop gameplay and show a lose screen.
6. Pause/Resume with an HTML control and P or Escape during play. Pause stops movement, patrols, damage-immunity countdown, and the game timer. Automatically pause on lost window focus or hidden tab; require explicit resume.
7. Restart from paused, won, or lost states. Reset player position, health, cells, enemy positions/directions, timer, key state, and temporary effects. Repeated restarts must not create extra listeners or animation loops.
8. Use elapsed time with bounded substeps or equivalent robust collision handling. Simulating the same input at 30, 60, and 120 FPS should produce approximately the same outcome.
9. Store the fastest successful active-play completion time in localStorage. Losing must not update it. Show the record on the title and result screens. Malformed or unavailable storage must not prevent play.
10. Scale the canvas to fit the available viewport while preserving its aspect ratio and world geometry. Test at 1440 x 900 and 800 x 600 CSS pixels. Mobile touch controls are not required.

## Visual direction

A readable industrial escape room with distinguishable walls, hazards, collectibles, and exit. Give the locked exit a visible explanation. Use HTML buttons and instructions around the canvas; no audio is required.

## Tests

Include meaningful tests for wall/border collisions, collection counting, the win gate, damage immunity, pause/timer behavior, restart, and best-time comparison. Keep movement conventional; do not add a dash ability in this initial version.
