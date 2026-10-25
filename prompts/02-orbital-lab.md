# Task 2: Orbital Lab

Build an interactive educational WebGL scene using the installed Three.js package and its bundled OrbitControls. This is a stylized orbital explorer, not a scientifically accurate simulator.

## Scene specification

Use a central star at the origin and exactly five planets on circular orbits in the XZ plane. Use the following fixed data; sizes and distances are arbitrary scene units, periods are simulation seconds.

| Planet | Radius | Orbit radius | Period | Color |
| --- | ---: | ---: | ---: | --- |
| Ember | 0.35 | 3 | 8 | #ef8354 |
| Vale | 0.50 | 5 | 12 | #67b99a |
| Azure | 0.55 | 7 | 18 | #4ea8de |
| Cinder | 0.40 | 9 | 25 | #c77d60 |
| Halo | 0.80 | 12 | 36 | #cdb4db |

The star radius is 1. Initial angles are zero: at simulation time zero every planet lies on the positive X axis. For each planet, use `angle = 2 * PI * simulationTime / period`, `x = orbitRadius * cos(angle)`, and `z = orbitRadius * sin(angle)`.

## Required features

1. Render the star, five visually distinct planets, orbit paths, and lighting that makes the scene readable. Use procedural geometry/materials only; no remote textures or models.
2. Start with a camera position and target that show the complete system. Support orbit, zoom, and pan through OrbitControls. Include a Reset view button.
3. Clicking a planet selects it through raycasting. Show its name, radius, orbit radius, and period in an HTML information panel. Visually mark the selection without changing orbital math.
4. Include a keyboard-accessible HTML planet picker that produces the same selection as clicking the scene. Camera dragging must not accidentally count as a planet click.
5. Provide Pause/Resume and a labeled simulation-speed slider from 0.25x to 4x, initially 1x. Show the current speed and simulation time. Pause freezes simulation time and orbital motion while camera controls and selection remain usable.
6. Base simulation on elapsed time. Changing speed must not reset time or teleport planets. When the tab becomes hidden, suspend simulation advancement; returning to it must not cause a large catch-up jump.
7. Handle resizing: canvas dimensions and camera aspect must match the available container. Cap renderer pixel ratio at 2. HTML controls must remain usable at 375 x 812 and 1440 x 900 CSS pixels without page-level horizontal overflow.
8. If WebGL initialization fails, show a useful HTML fallback rather than a blank screen or uncaught error.
9. Avoid duplicate animation loops/listeners. Clean up controls, renderer, geometries, materials, listeners, and animation scheduling when the scene is torn down.

## Visual direction

An approachable observatory console with a readable legend and unobtrusive controls. Planets must be distinguishable by names and selection state, not color alone. Keep overlays from blocking the entire scene on a small screen.

## Tests

Include meaningful tests for orbital positions at known simulation times and for pause/speed clock behavior. Orbit calculations should be testable without a WebGL context. Do not add a planet-following camera in this initial version.
