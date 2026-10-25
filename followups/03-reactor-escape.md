# Follow-up: Add a collision-safe dash

Extend the existing Reactor Escape game without replacing it.

Add a dash triggered by Space during active gameplay.

- A dash lasts 0.15 seconds and moves at 600 world units/second in place of normal movement speed.
- Its direction is the normalized movement direction at activation, or the last nonzero movement direction if no movement key is held. Before the player has moved, default to right. Lock the direction for that dash.
- Cooldown is 2 seconds of active gameplay measured from activation. Holding Space must not auto-repeat dash; require release and a new press.
- Dash must not pass through walls or the playfield border, including during slow frames. Resolve collisions throughout its movement, not just at the final position.
- Dash grants no extra damage immunity. Collecting cells, enemy contact, and reaching the exit still work along its path.
- Display cooldown readiness clearly. Pause freezes dash duration and cooldown. Restart clears both and restores the default last direction.
- Preserve ordinary movement speed, diagonal normalization, all existing states, best-time persistence, and restart reliability.

Add focused tests for thin-wall collision during dash, one activation per key press, cooldown timing, direction locking, and pause/restart behavior. Run the existing tests and production build. Update the app README and report actual verification results and remaining limitations.
