# IVO-mod 0.4.0

Supported game build: `c686e625ec`.

- New: Stats "Level up" with "Levels to add" (1 to 50). Uses the game's own level-up; each level queues its own card screen.
- New: Automation "Auto evolution" (off, evolve, keep its look) answers the evolution screen at levels 20 and 40, so a hidden Background run no longer stalls there. The form-change screen is answered the same way but has not been seen in a test yet.
- New: Locator "Live" switches refresh the big chest and radar readouts about twice a second.

# IVO-mod 0.3.2

Supported game build: `c686e625ec`.

- Fix: Background run now runs at real speed in a hidden tab. Chrome slows hidden-tab timers to about one tick per second, and the old driver ran one game frame per tick (about 30x slow). Each tick now replays the real time that passed. Confirmed in a hidden tab with Auto rewards on.

# IVO-mod 0.3.1

Supported game build: `c686e625ec`.

- New: Auto items (always take, only into a free slot, always keep). It closes the item screen the same way the game's own card click does.
- New: `node tools/check-build.mjs` checks whether the game build changed, and `diagnose()` in the console lists which game parts and keys still match.

# IVO-mod 0.3.0

Supported game build: `c686e625ec`. A game update can change the build and break features; on any other build the menu starts with features disabled. Every modded run is marked as practice through the game's own debug flag. The menu does not touch leaderboards or score submission.

## What is new

- Automation tab: Auto rewards (first card, new moves first, upgrades first, stats first) and Background run.
- Locator tab: Locate nearest big chest and Rare target radar, as on-click info text.
- Chests: Place chests nearby and Place big chests nearby.
- Rift type (18 types) with Open rift of chosen type, and Rift boss on map (pick a legendary by Pokedex number).
- Add coins (save), in guest mode only.
- Fix: auto-pick timing. The game ignores picks for 0.6 s after a screen opens, so Auto rewards now waits about 0.7 s per card.
- Fix: stat sliders carry over to new runs.
- Minimise button is now a wide dash.

## Known limits

- Auto rewards never picks a "forget a move" card, and evolution screens stay manual.
- Coins work only in guest mode, by design, and never edit a signed-in save.
- Automation modes can only be changed while playing, not during a level-up screen.
- Violentmonkey is untested; Tampermonkey is confirmed.
- The userscript needs the DevTools step on every page load.

# IVO-mod 0.2.0

First release. Verified on build `c686e625ec`.

- Core with the Stats, Powers and Spawns features, two connectors (Chrome extension and Tampermonkey userscript), and the panel with F2 toggle, drag and minimise.
- IVO-mod branding across the panel, extension and userscript.
- Presets tab (save, load, overwrite, delete) and a "Game paused" veil over the panel during pause and level-up.
- Extension: auto-connects on every game tab load; the manual Connect in the popup stays.
