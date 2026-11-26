# IVO-mod

Mod menu for [pokesurvivor.com](https://pokesurvivor.com/). It's an in-game panel with stats, powers, spawns, some automation, a locator and presets.

It's for messing around in guest / practice runs. Anything you do with the menu marks the run as practice using the game's own debug flag, and it never touches the leaderboard or score submission.

> [!IMPORTANT]
> Works on game build `c686e625ec` (0.4.0 was tested on that one). If the game updates, the menu turns its features off by itself until I check the new build, so an update can break stuff for a bit.

## Install

Grab the latest from [Releases](https://github.com/M4tiassHD/pokesurvivor-ivo-mod/releases/latest). There are two ways to run it, you only need one.

### Chrome extension (easiest)

1. Download `ivo-mod-connector-<version>.zip` and unzip it (or just use the `extension/` folder if you cloned the repo)
2. Go to `chrome://extensions`, turn on Developer mode
3. Load unpacked, pick the unzipped folder
4. Open pokesurvivor.com. It connects by itself every time the game loads

Chrome will show the "started debugging this browser" bar while it's connected. That's normal, the extension uses the `debugger` permission to get at the game. It only asks for `debugger`, `storage` and the pokesurvivor.com host.

The popup has Connect / Disconnect buttons if you want to do it by hand. Badge says `ON` when connected and `ERR` when something went wrong (open the popup to see what).

### Userscript (Tampermonkey)

1. Open [the raw userscript](https://github.com/M4tiassHD/pokesurvivor-ivo-mod/raw/main/userscript/ivo-mod.user.js) and Tampermonkey will offer to install it. On newer Chrome you might have to enable "Allow User Scripts" in the extension details first. Haven't tried Violentmonkey.
2. Every time you load the game:
   - open DevTools, Console tab
   - run `queryObjects(Object.prototype)`
   - right click the array it prints, "Store as global variable"
3. You should see `[IVO-mod] Installed.` in the console

The DevTools step is annoying but there's no way around it. The game keeps everything inside closures, so a normal page script can't reach it. DevTools can, so you hand the objects over from there. The extension does exactly that for you automatically, which is why it's the easier option.

## Using it

- F2 shows/hides the panel. Drag it by the top bar, `-` minimises it
- Sliders apply when you let go. Each one has its own Reset
- The panel greys out ("Game paused") on pause and level-up screens
- Stat changes stick when you start a new run
- Disconnect asks for a second click so you don't hit it by accident
- Most things only work during a run. Automation modes can only be changed while you're actually playing, not with a level-up screen open

## What's in it

Everything here was tested in game on `c686e625ec` unless I say otherwise. Names are the ones you see in the panel.

**Stats**
- Damage, Attack speed, Movement speed, Pickup range, Experience gain, Max HP. These are multipliers and carry over between runs
- Levels to add (1-50) + Level up. Each level gives you its own card screen, one after the other, so turn on Auto rewards if you're adding a lot
- Coins to add + Add coins (save). Guest mode only, on purpose. It won't touch a logged in save

**Powers**
- God mode, Freeze enemies, Arsenal (all moves fire), Area multiplier, Vacuum loot
- Radial shots, Homing, Pierce
- Heal to full, Pull all loot, Max all moves, Evolve ready moves, Clear normal enemies, Defeat all enemies, Die (KO)

**Spawns**
- Spawn rate, Shiny chance %
- Spawn count / Species (dex number) / Chosen species shiny, used by Wild swarm, Spawn chosen species and Shiny pack
- Treasure Gholdengo, Treasure Meowth
- Place chests nearby, Place big chests nearby. Big chests open when you stand next to them for a bit and drop the usual loot (coins, tickets, an item...)
- Open rift, or pick one of the 18 types with Rift type + Open rift of chosen type
- Rift boss on map: put any legendary (by dex number, shiny if you want) on the map
- Gacha: force shiny for the next N gacha results

**Automation**
- Auto rewards: picks level-up cards for you. Modes: first card, new moves first, upgrades first, stats first. It never picks the "forget a move" card
- Auto items: handles the held item swap screen. Always take, only into a free slot, or always keep
- Auto evolution: handles the evolution screen at level 20 and 40. "evolve" takes the first option, "keep its look" says no. It should also handle the form change screen the same way, but I haven't run into that one yet so it's untested
- Background run: the run keeps going when you switch tabs. You want Auto rewards and Auto evolution on too, otherwise it just sits on the first card screen. After ~5 min hidden Chrome throttles the tab even harder, so long hidden runs fall a bit behind real time

The auto stuff waits about 0.7s before picking because the game ignores clicks for 0.6s after a screen opens.

**Locator**
- Locate nearest big chest: distance, direction and how far it's unlocked, e.g. `big chest 389px NE, unlock 0.0/3.5`
- Rare target radar: nearby shinies, bosses and legendaries with distance and direction, plus the rift portal if there is one

Click to get a one-off reading, or flip the Live switch and it updates about twice a second while you walk around.

**Presets**

Save / load / overwrite / delete named sets of settings. They're stored in your browser. If you load one outside a run it only applies the parts that make sense there and tells you what it skipped.

## Problems

- Badge says `ERR`: open the popup, the error is there
- Userscript says modules are missing: the game probably hadn't finished loading. Do the DevTools step again
- Everything is greyed out / disabled: you're on a different game build than `c686e625ec`

## When the game updates

```sh
node tools/check-build.mjs
```

Prints "same build", or "NEW BUILD" with the new hash (exits with 2). If it's new, connect the menu and paste this in the console to see what still matches and what moved:

```js
JSON.stringify(globalThis[Symbol.for('ps.core.installed')].diagnose(), null, 1)
```

## Building

Just needs Node.

```sh
node tools/build.mjs
```

That writes `dist/core.js`, `extension/core.js` and `userscript/ivo-mod.user.js`.

Tests:

```sh
node --test ui/test/*.test.mjs userscript/test/*.test.mjs "core/test/*.test.mjs" extension/test/expr.test.mjs
```

## License

MIT, see [LICENSE](LICENSE).
