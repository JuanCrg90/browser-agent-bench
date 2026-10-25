# Follow-up: Follow the selected planet

Extend the existing Orbital Lab without replacing it.

Add a keyboard-accessible Follow selected planet toggle, disabled until a planet is selected.

- Enabling follow must not immediately move the camera or its look-at target. Preserve their current world-space values at the instant of enabling.
- Thereafter, translate both the camera position and OrbitControls target by the selected planet's world-space displacement each frame. The existing camera offset should be preserved; do not force a new zoom or orientation.
- Keep orbit and zoom usable while following. Update any internal controls state as needed so the next controls update does not produce a jump.
- Switching the selected planet while following must not immediately move the camera or target. Rebase the displacement reference to the new selection, then follow its subsequent movement.
- Disabling follow preserves the current camera position and target. Pause stops follow translation, while camera controls remain usable.
- Reset view disables follow and restores the original overview. Selection may remain.
- Do not regress picking, the HTML planet picker, speed controls, resizing, fallback, or cleanup.

Add focused tests for zero displacement at enable/reselection, equal translation of camera and target, and no follow translation while paused. Run the existing tests and production build. Update the app README and report actual verification results and remaining limitations.
