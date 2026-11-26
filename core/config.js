// all game names live here, each with the build it was checked on (null + 'unverified' if not)
export const BUILD = 'c686e625ec';
// MODULES finders, Save/Player predicates, Player keys and Combat.tick re-checked on c686e625ec
// key groups and recipes below were last tested on PREV_BUILD
export const PREV_BUILD = '0f79e510c9';

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
// own functions only, not inherited
const fns = (...names) => o => names.every(n => hasOwn(o, n) && typeof o[n] === 'function');
const keys = (...names) => o => names.every(n => n in o);
const both = (...ps) => o => ps.every(p => p(o));

// c686e625ec
export function isChunkMap(m) {
  if (!(m instanceof Map) || m.size === 0) return false;
  for (const v of m.values()) {
    return !!v && typeof v === 'object' && typeof v.cx === 'number' && typeof v.cy === 'number' && v.terr instanceof Uint8Array &&
      Array.isArray(v.props) && v.propAt instanceof Map;
  }
  return false;
}
export const DEX_LENGTH = 1082; // DEX length on c686e625ec
export function isDexArray(a) { return Array.isArray(a) && a.length === DEX_LENGTH && !!a[0] && a[0].dex === 1 && 'bst' in a[0]; }

function mod(pred, source) { return Object.freeze({ pred, verified: BUILD, source }); }

// findModules wraps these in try/catch, a throw = no match
export const MODULES = Object.freeze({
  Game: mod(fns('startRun', 'debugTime', 'togglePause'), 'Game'),
  Spawner: mod(both(fns('burst', 'update'), keys('CAP')), 'Spawner'),
  EnemyMgr: mod(both(fns('add'), keys('count', 'bossAlive', 'shinies')), 'EnemyMgr'),
  Gacha: mod(fns('costOf', 'pool', 'debugForceShiny'), 'Gacha'),
  World: mod(fns('isFree', 'breakProp'), 'World'),
  Pickups: mod(fns('pullAll'), 'Pickups'),
  Moves: mod(fns('levelUp', 'evoInfo', 'evolve'), 'Moves'),
  Projectiles: mod(fns('spawn', 'clearOrbs'), 'Projectiles'),
  // fns('tick') alone matches 37 objects; fns('tick','begin','air') is the charge-move module, not this one
  Combat: mod(fns('tick', 'resolve', 'ghostCast', 'ghostOrbit', 'updateFields'), 'Combat, the per-frame one'),
  RunUI: mod(fns('showItemChoice'), 'RunUI'),
  Items: mod(keys('BY', 'TREATS', 'roll'), 'Items (held)'),
  Judgment: mod(keys('judgedText'), 'Judgment (Arceus)'),
  Enemies: mod(fns('bagAt'), 'Enemies (defs)'),
  Sprites: mod(fns('hasShiny', 'preload'), 'Sprites'),
  // 'active' alone matches 9 objects. Coop.active is an accessor returning a boolean
  Coop: mod(o => hasOwn(o, 'active') && hasOwn(o, 'puppets') && hasOwn(o, 'mates'), 'Coop'),
  Rift: mod(fns('debugSkipTo', 'enterRequest'), 'Rift'),
  // each of these matches exactly 1 object on c686e625ec
  Chunks: mod(isChunkMap, 'chunk Map keyed by numeric tile key'),
  Dex: mod(isDexArray, 'DEX array, 1082 entries'),
  Balance: mod(o => typeof o.legendHp === 'function', 'Balance (legendHp, legendDmg, guardS.legend)'),
  // hide(id) adds class 'hidden', isOpen(id) checks it
  UI: mod(fns('hide', 'isOpen', '$'), 'UI'),
  Account: mod(o => typeof o.guest === 'boolean' && 'syncState' in o && 'save' in o && 'loggedIn' in o, 'Account, used for guest detection'),
  Save: mod(o => typeof o.coins === 'number' && 'upgrades' in o && 'pstat' in o, 'Save object'),
});

function group(keyMap, source) { return Object.freeze({ keys: Object.freeze(keyMap), verified: PREV_BUILD, source }); }

export const PLAYER_PRED = o => 'xpNext' in o && 'maxHp' in o && 'moves' in o;
export const PLAYER = group({ hp: 'hp', maxHp: 'maxHp', x: 'x', y: 'y', dead: 'dead', atkMul: 'atkMul',
  cdMul: 'cdMul', spdMul: 'spdMul', magnet: 'magnet', xpMul: 'xpMul', moves: 'moves', statsTaken: 'statsTaken',
  hurt: 'hurt', heal: 'heal' },
  'Player own keys; atkMul write and effect checked, spdMul write checked. hurt/heal are on the prototype (wrap targets)');
export const GAME = group({ state: 'state', st: 'st', time: 'time', debugTime: 'debugTime', startRun: 'startRun', playing: 'playing', debugLevelUp: 'debugLevelUp' },
  'Game state values, st.time, debugTime; debugLevelUp fires a real showLevelUp (tested in game)');
export const COMBAT = group({ tick: 'tick' }, 'Combat');
export const COOP = group({ active: 'active' }, 'Coop');
export const RIFT = group({ inArena: 'inArena', enterRequest: 'enterRequest' }, 'Rift keys; enterRequest works in game');
export const JUDGMENT = group({ active: 'active', cinematic: 'cinematic' }, 'Rift.enterRequest reads Judgment.active; Judgment has active and cinematic');

// wrapped for 1.2 s, 200/200 calls had the player as args[1] (args[0] dt, args[2] run time)
export const TICK_PLAYER_ARG = Object.freeze({
  value: 1, verified: BUILD, state: 'verified', source: 'wrapped Combat.tick, 200/200 calls had the player as arg 1',
});

// leads: names/call shapes not checked in game yet. features using them stay off unless opts.allowLeads === true
export const LEADS = {};
// confirmed in game on BUILD. still listed in feature leads for provenance but not registered, so they gate nothing
export const CONFIRMED = new Set(['Player.activeGroup', 'Player.anim', 'Player.animPlay', 'Player.faintArgs', 'Move.lvl', 'Move.def',
  'Move.sizeKeys', 'EvoInfo.ready', 'EnemyMgr.all', 'Enemy.die()', 'Projectile.owner', 'Projectile.friendly', 'Projectile.ghost',
  'Projectile.orb', 'Projectile.vx', 'Projectile.vy', 'Projectile.homing', 'Projectile.pierce', 'Projectile.hits', 'Projectile.phits',
  'Projectile.hitLog', 'Spawner.update.dtArg', 'Player.heal(maxHp)', 'Moves.levelUp(move)', 'Moves.evoInfo(move,statsTaken)',
  'Moves.evolve(move)', 'World.isFree(x,y,r)', 'Treasure.meowth',
  // seen in game later
  'Enemy.legend', 'Projectiles.clearOrbs(player)']);
function lead(name, source) { if (!CONFIRMED.has(name)) LEADS[name] = Object.freeze({ state: 'lead', verified: null, source }); }
function leads(grp, keyMap, source) {
  for (const k of Object.keys(keyMap)) lead(`${grp}.${k}`, source);
  return Object.freeze({ keys: Object.freeze({ ...keyMap }), state: 'lead', verified: null, source });
}

export const PLAYER_LEAD = leads('Player', { activeGroup: 'activeGroup', anim: 'anim', animPlay: 'play',
  faintArgs: Object.freeze(['Faint', Object.freeze({ hold: true })]) }, 'player anim + faint');
export const MOVE_LEAD = leads('Move', { lvl: 'lvl', def: 'def', sizeKeys: Object.freeze(['size']) }, 'only size exists (radius, width absent)');
export const MOVE_DEF = group({ maxLvl: 'maxLvl' }, 'Move defs');
export const EVO_LEAD = leads('EvoInfo', { ready: 'ready' }, 'evoInfo().ready');
export const ENEMY_LEAD = leads('Enemy', { legend: 'legend' }, 'own key on the rift legendary. remote/judge never showed up, dropped');
export const ENEMYMGR_LEAD = leads('EnemyMgr', { all: 'all' }, 'all() is a method, not in the EnemyMgr keys');
export const PROJ_LEAD = leads('Projectile', { owner: 'owner', friendly: 'friendly', ghost: 'ghost', orb: 'orb',
  vx: 'vx', vy: 'vy', homing: 'homing', pierce: 'pierce', hits: 'hits', phits: 'phits', hitLog: 'hitLog' }, 'projectile fields');
export const SPAWNER_UPDATE_DT_ARG = Object.freeze({ value: 0, verified: null, state: 'lead', source: 'Spawner.update(dt, who, time)' });
lead('Spawner.update.dtArg', SPAWNER_UPDATE_DT_ARG.source);
lead('Player.heal(maxHp)', 'heal to full');
lead('Moves.levelUp(move)', 'returns falsy when it cannot level');
lead('Moves.evoInfo(move,statsTaken)', 'evo readiness');
lead('Moves.evolve(move)', 'evolve a ready move');
lead('Projectiles.clearOrbs(player)', 'clear orbs before KO');
lead('World.isFree(x,y,r)', 'free spot check');
lead('Enemy.die()', 'hp=0 then die()');
lead('Treasure.meowth', 'dex 52, loot coins');

// groups used by Stats/Powers/Spawns
export const ENEMY = group({ ctor: 'constructor', name: 'name', dex: 'dex', dead: 'dead', shiny: 'shiny', boss: 'boss', behavior: 'behavior',
  sc: 'sc', hp: 'hp', x: 'x', y: 'y', r: 'r', life: 'life', die: 'die', makeShiny: 'makeShiny', update: 'update' },
  'Enemy instances, own keys + prototype methods; life from the treasure Gholdengo');
export const ENEMY_DEF = group({ thief: 'thief', loot: 'loot' }, 'def behavior thief, loot');
export const ENEMYMGR = group({ add: 'add', count: 'count' }, 'EnemyMgr');
export const SPAWNER = group({ update: 'update', burst: 'burst', cap: 'CAP' }, 'Spawner');
export const ENEMIES = group({ defForDex: 'defForDex' }, 'Enemies');
export const SPRITES = group({ hasShiny: 'hasShiny', preload: 'preload' }, 'Sprites, preload is async');
export const WORLD = group({ isFree: 'isFree' }, 'World, argument shape is still a lead');
export const PICKUPS = group({ pullAll: 'pullAll' }, 'Pickups');
export const MOVES = group({ levelUp: 'levelUp', evoInfo: 'evoInfo', evolve: 'evolve' }, 'Moves');
export const PROJECTILES = group({ spawn: 'spawn', clearOrbs: 'clearOrbs' }, 'Projectiles');
// Projectiles.count is gone, all() returns the live array
export const PROJECTILES_ALL = Object.freeze({ key: 'all', verified: BUILD, source: 'Projectiles own keys' });
export const GACHA = group({ forceShiny: 'debugForceShiny' }, 'debugForceShiny(n) forces the next n results shiny');

// treasure carrier recipe. gholdengo tested in game, meowth only by recipe (lead 'Treasure.meowth')
export const TREASURE = Object.freeze({
  hpBase: 60, hpPerSec: 95, spd: 92, dmg: 0, xp: 10, life: 15, scale: Object.freeze({ hp: 1, spd: 1, dmg: 1 }),
  verified: PREV_BUILD, source: 'treasure Gholdengo, tested in game',
  gholdengo: Object.freeze({ dex: 1000, hpMul: 1.5, loot: 'ticket10' }),
  meowth: Object.freeze({ dex: 52, hpMul: 1, loot: 'coins' }),
});

// our own limits, not game facts
export const LIMITS = Object.freeze({
  mobHard: 256, mobMargin: 10, projectiles: 650, swarmMax: 50, treasureMax: 10, chestMax: 10, radarMax: 5, chunkScanMax: 4096, coinsMax: 1000000, levelsMax: 50, speciesMax: 1082, gachaMax: 100,
  state: 'policy', source: 'mob cap CAP+10 hard 256; projectile cap 650; speciesMax = DEX length, a UI bound only',
});

// automation, c686e625ec
export const RUNUI = Object.freeze({
  keys: Object.freeze({ showLevelUp: 'showLevelUp', pick: 'pick', offering: 'offering', showItemChoice: 'showItemChoice', showEvo: 'showEvo', showForm: 'showForm', pickEvo: 'pickEvo' }),
  verified: BUILD, source: 'RunUI members: showLevelUp, pick(i) 0-based, offering() boolean, showItemChoice, showEvo, showForm, pickEvo',
});
// showLevelUp(level, options, callback, waiting=false), arg indices. waiting is the co-op wait flag
export const LEVELUP = Object.freeze({
  optionsArg: 1, waitingArg: 3, optionType: 'type', optionKey: 'key', types: Object.freeze({ new: 'new', up: 'up', stat: 'stat', evo: 'evo' }),
  // a 'forget' card opens the forget-a-move screen, auto rewards never picks it
  forgetKey: 'forget',
  state: 'levelup', verified: BUILD,
  source: 'showLevelUp args; option {type:"new"|"up"|"stat", key}; Game.state "levelup"',
});
// showItemChoice(cur, incoming, callback, free=-1): callback(slot) with slot >= 0 equips into that slot, -1 keeps.
export const ITEMCHOICE = Object.freeze({
  callbackArg: 2, freeArg: 3, keep: -1, state: 'choice', verified: BUILD,
  source: 'showItemChoice(cur, incoming, callback(slot), free=-1); Game.state "choice"',
  // card click runs UI.hide('scr-item') then callback(slot). ran that directly in game: state choice -> playing,
  // screen hidden, item equipped or kept (-1). the 600 ms guard is only on the click handler
  screenId: 'scr-item', uiHide: 'hide',
  closeScreen: Object.freeze({ state: 'verified', verified: BUILD, source: 'UI.hide(screenId) then callback(slot), ran in game' }),
});
// browser facts, not game names
export const BROWSER = Object.freeze({
  hiddenKeys: Object.freeze({ hidden: 'hidden', visibilityState: 'visibilityState' }), visibleValue: 'visible',
  rafKey: 'requestAnimationFrame',
  rafOwnership: Object.freeze({ state: 'verified', verified: BUILD,
    source: 'window.requestAnimationFrame is own, writable, configurable; hidden/visibilityState are configurable get-only accessors on Document.prototype' }),
  driveMs: 50, // our setInterval period for the hidden-tab loop driver
  frameMs: 34, // game clamps each frame to 1/30 s, so one step = one full game frame
  maxCatchUpFrames: 900, // per driver tick, covers timer throttling (900 = 30 s of game). untuned
  source: 'game reads document.hidden; loop is requestAnimationFrame(ba)',
});
// NOTE: RunUI.pick does nothing for 0x258 ms (600) after a choice screen opens
// showEvo(player, {k, all, half, opts}, cb) / showForm(player, {forms:[{form}]}, cb): list is opts (or forms.map(form)) + [0],
// pickEvo(i) hides #scr-evo and calls cb(list[i]), last index (0) is "Keep its look". Game.state is 'choice' while open
// showEvo + pickEvo(0) evolved Scorbunny into Raboot in game, showForm only read from source
export const EVOCHOICE = Object.freeze({
  dataArg: 1, callbackArg: 2, opts: 'opts', forms: 'forms', state: 'choice', verified: BUILD,
  source: 'RunUI.showEvo, showForm, pickEvo and the form trigger caller, read from source',
});
export const AUTOMATION = Object.freeze({ pickDelayMs: 700, state: 'verified', verified: BUILD, source: 'pick guard is H=now+0x258; 700 ms delay held up with 10 queued level-ups' });

// world chunks, props, rift, legends, guest (c686e625ec)
export const WORLD_CHUNK = Object.freeze({
  keys: Object.freeze({ cx: 'cx', cy: 'cy', terr: 'terr', props: 'props', propAt: 'propAt', propAll: 'propAll', specials: 'specials' }),
  tile: 32, chunk: 512, tilesPerChunk: 16, terrLen: 256, floor: 0,
  verified: BUILD, source: 'chunk keys, TS 32, CW 512, terr 0 floor / 1 wall / 2 liquid; terr index (ty-cy*16)*16+(tx-cx*16) from the breakProp code',
});
// World members used for placement. chunk(cx,cy,true) peeks the chunk Map (read from source, never called)
export const WORLD_LIVE = Object.freeze({ chunk: 'chunk', tile: 'TS', cw: 'CW', verified: BUILD,
  source: 'TS, CW read in game; chunk(cx,cy,peek) from source only' });
export const PROP = Object.freeze({
  keys: Object.freeze({ id: 'id', type: 'type', tx: 'tx', ty: 'ty', kind: 'kind', x: 'x', y: 'y', used: 'used', open: 'open' }),
  types: Object.freeze({ chest: 'chest', bigchest: 'bigchest' }), footInset: 4, chestTime: 3.5,
  table: Object.freeze({
    chest: Object.freeze({ solid: true, hp: 22, r: 12, kind: 0, special: false }),
    bigchest: Object.freeze({ solid: true, hp: Infinity, r: 14, kind: 1, special: true }), // kind 1..2 seen in game, 1 is ours
  }),
  verified: BUILD, source: 'prop factory in World; chest insert tested, bigchest insert not',
});
// our placement policy. ring 3 and clearance 30 are the tested values, outer ring is ours
export const PLACEMENT = Object.freeze({ ringMin: 3, ringMax: 6, clearR: 30, state: 'policy', source: 'ring 3, isFree 30, tested' });
// hand-made insert (kind 1, specials, propAll, propAt) unlocked in the game's radius and opened at 3.5, breakProp
// removed it from every structure. loot after opening not seen (screens overlapped)
export const BIGCHEST_INSERT = Object.freeze({ state: 'verified', verified: BUILD, source: 'insert + unlock + open worked in game, loot not seen' });
export const RIFT_LIVE = Object.freeze({
  keys: Object.freeze({ portal: 'rift', debugNextType: 'debugNextType', inArena: 'inArena' }), portal: Object.freeze({ x: 'x', y: 'y', ttl: 'ttl' }),
  verified: BUILD, source: 'Rift.rift portal {x,y,ttl,t} or null; debugNextType(type) then enterRequest() tested (fire -> Heatran)',
});
export const ARENA_TYPES = Object.freeze(['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy']);
// rift legendary def (Rift module, function P). idx and n are Balance.legendHp's 1st and 3rd args: rift schedule
// index (max(0, C-1)) and player count. only idx 0 tested, so idx 0 and n 1 (solo)
export const LEGEND = Object.freeze({
  spd: Object.freeze({ base: 48, slope: 0.6, ref: 78, max: 105 }), xpBase: 500, xpPerSec: 1.2, shotDmgMul: 0.5, shotCd: 0.9, range: 300,
  rangedTypes: Object.freeze(['psychic', 'electric', 'ghost', 'fairy', 'fire', 'water', 'ice', 'dragon']),
  idx: 0, players: 1, dps: 0, calibrated: 0, spawnDist: Object.freeze([230, 300]),
  keys: Object.freeze({ legend: 'legend', guardS: 'guardS', flying: 'flying', leg: 'leg', types: 'types', spd: 'spd', dex: 'dex', name: 'name' }),
  balance: Object.freeze({ legendHp: 'legendHp', legendDmg: 'legendDmg', guardS: 'guardS', guardLegend: 'legend' }),
  verified: BUILD, source: 'legend def read from the Rift module',
});
export const ACCOUNT = Object.freeze({ keys: Object.freeze({ guest: 'guest', save: 'save' }), verified: BUILD,
  source: 'Account.guest === true in guest, never use loggedIn' });
