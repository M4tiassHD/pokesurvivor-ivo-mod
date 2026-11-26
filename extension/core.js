function psInstall(objects, opts) {
'use strict';
// --- config.js
// all game names live here, each with the build it was checked on (null + 'unverified' if not)
const BUILD = 'c686e625ec';
// MODULES finders, Save/Player predicates, Player keys and Combat.tick re-checked on c686e625ec
// key groups and recipes below were last tested on PREV_BUILD
const PREV_BUILD = '0f79e510c9';

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
// own functions only, not inherited
const fns = (...names) => o => names.every(n => hasOwn(o, n) && typeof o[n] === 'function');
const keys = (...names) => o => names.every(n => n in o);
const both = (...ps) => o => ps.every(p => p(o));

// c686e625ec
function isChunkMap(m) {
  if (!(m instanceof Map) || m.size === 0) return false;
  for (const v of m.values()) {
    return !!v && typeof v === 'object' && typeof v.cx === 'number' && typeof v.cy === 'number' && v.terr instanceof Uint8Array &&
      Array.isArray(v.props) && v.propAt instanceof Map;
  }
  return false;
}
const DEX_LENGTH = 1082; // DEX length on c686e625ec
function isDexArray(a) { return Array.isArray(a) && a.length === DEX_LENGTH && !!a[0] && a[0].dex === 1 && 'bst' in a[0]; }

function mod(pred, source) { return Object.freeze({ pred, verified: BUILD, source }); }

// findModules wraps these in try/catch, a throw = no match
const MODULES = Object.freeze({
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

const PLAYER_PRED = o => 'xpNext' in o && 'maxHp' in o && 'moves' in o;
const PLAYER = group({ hp: 'hp', maxHp: 'maxHp', x: 'x', y: 'y', dead: 'dead', atkMul: 'atkMul',
  cdMul: 'cdMul', spdMul: 'spdMul', magnet: 'magnet', xpMul: 'xpMul', moves: 'moves', statsTaken: 'statsTaken',
  hurt: 'hurt', heal: 'heal' },
  'Player own keys; atkMul write and effect checked, spdMul write checked. hurt/heal are on the prototype (wrap targets)');
const GAME = group({ state: 'state', st: 'st', time: 'time', debugTime: 'debugTime', startRun: 'startRun', playing: 'playing', debugLevelUp: 'debugLevelUp' },
  'Game state values, st.time, debugTime; debugLevelUp fires a real showLevelUp (tested in game)');
const COMBAT = group({ tick: 'tick' }, 'Combat');
const COOP = group({ active: 'active' }, 'Coop');
const RIFT = group({ inArena: 'inArena', enterRequest: 'enterRequest' }, 'Rift keys; enterRequest works in game');
const JUDGMENT = group({ active: 'active', cinematic: 'cinematic' }, 'Rift.enterRequest reads Judgment.active; Judgment has active and cinematic');

// wrapped for 1.2 s, 200/200 calls had the player as args[1] (args[0] dt, args[2] run time)
const TICK_PLAYER_ARG = Object.freeze({
  value: 1, verified: BUILD, state: 'verified', source: 'wrapped Combat.tick, 200/200 calls had the player as arg 1',
});

// leads: names/call shapes not checked in game yet. features using them stay off unless opts.allowLeads === true
const LEADS = {};
// confirmed in game on BUILD. still listed in feature leads for provenance but not registered, so they gate nothing
const CONFIRMED = new Set(['Player.activeGroup', 'Player.anim', 'Player.animPlay', 'Player.faintArgs', 'Move.lvl', 'Move.def',
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

const PLAYER_LEAD = leads('Player', { activeGroup: 'activeGroup', anim: 'anim', animPlay: 'play',
  faintArgs: Object.freeze(['Faint', Object.freeze({ hold: true })]) }, 'player anim + faint');
const MOVE_LEAD = leads('Move', { lvl: 'lvl', def: 'def', sizeKeys: Object.freeze(['size']) }, 'only size exists (radius, width absent)');
const MOVE_DEF = group({ maxLvl: 'maxLvl' }, 'Move defs');
const EVO_LEAD = leads('EvoInfo', { ready: 'ready' }, 'evoInfo().ready');
const ENEMY_LEAD = leads('Enemy', { legend: 'legend' }, 'own key on the rift legendary. remote/judge never showed up, dropped');
const ENEMYMGR_LEAD = leads('EnemyMgr', { all: 'all' }, 'all() is a method, not in the EnemyMgr keys');
const PROJ_LEAD = leads('Projectile', { owner: 'owner', friendly: 'friendly', ghost: 'ghost', orb: 'orb',
  vx: 'vx', vy: 'vy', homing: 'homing', pierce: 'pierce', hits: 'hits', phits: 'phits', hitLog: 'hitLog' }, 'projectile fields');
const SPAWNER_UPDATE_DT_ARG = Object.freeze({ value: 0, verified: null, state: 'lead', source: 'Spawner.update(dt, who, time)' });
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
const ENEMY = group({ ctor: 'constructor', name: 'name', dex: 'dex', dead: 'dead', shiny: 'shiny', boss: 'boss', behavior: 'behavior',
  sc: 'sc', hp: 'hp', x: 'x', y: 'y', r: 'r', life: 'life', die: 'die', makeShiny: 'makeShiny', update: 'update' },
  'Enemy instances, own keys + prototype methods; life from the treasure Gholdengo');
const ENEMY_DEF = group({ thief: 'thief', loot: 'loot' }, 'def behavior thief, loot');
const ENEMYMGR = group({ add: 'add', count: 'count' }, 'EnemyMgr');
const SPAWNER = group({ update: 'update', burst: 'burst', cap: 'CAP' }, 'Spawner');
const ENEMIES = group({ defForDex: 'defForDex' }, 'Enemies');
const SPRITES = group({ hasShiny: 'hasShiny', preload: 'preload' }, 'Sprites, preload is async');
const WORLD = group({ isFree: 'isFree' }, 'World, argument shape is still a lead');
const PICKUPS = group({ pullAll: 'pullAll' }, 'Pickups');
const MOVES = group({ levelUp: 'levelUp', evoInfo: 'evoInfo', evolve: 'evolve' }, 'Moves');
const PROJECTILES = group({ spawn: 'spawn', clearOrbs: 'clearOrbs' }, 'Projectiles');
// Projectiles.count is gone, all() returns the live array
const PROJECTILES_ALL = Object.freeze({ key: 'all', verified: BUILD, source: 'Projectiles own keys' });
const GACHA = group({ forceShiny: 'debugForceShiny' }, 'debugForceShiny(n) forces the next n results shiny');

// treasure carrier recipe. gholdengo tested in game, meowth only by recipe (lead 'Treasure.meowth')
const TREASURE = Object.freeze({
  hpBase: 60, hpPerSec: 95, spd: 92, dmg: 0, xp: 10, life: 15, scale: Object.freeze({ hp: 1, spd: 1, dmg: 1 }),
  verified: PREV_BUILD, source: 'treasure Gholdengo, tested in game',
  gholdengo: Object.freeze({ dex: 1000, hpMul: 1.5, loot: 'ticket10' }),
  meowth: Object.freeze({ dex: 52, hpMul: 1, loot: 'coins' }),
});

// our own limits, not game facts
const LIMITS = Object.freeze({
  mobHard: 256, mobMargin: 10, projectiles: 650, swarmMax: 50, treasureMax: 10, chestMax: 10, radarMax: 5, chunkScanMax: 4096, coinsMax: 1000000, levelsMax: 50, speciesMax: 1082, gachaMax: 100,
  state: 'policy', source: 'mob cap CAP+10 hard 256; projectile cap 650; speciesMax = DEX length, a UI bound only',
});

// automation, c686e625ec
const RUNUI = Object.freeze({
  keys: Object.freeze({ showLevelUp: 'showLevelUp', pick: 'pick', offering: 'offering', showItemChoice: 'showItemChoice', showEvo: 'showEvo', showForm: 'showForm', pickEvo: 'pickEvo' }),
  verified: BUILD, source: 'RunUI members: showLevelUp, pick(i) 0-based, offering() boolean, showItemChoice, showEvo, showForm, pickEvo',
});
// showLevelUp(level, options, callback, waiting=false), arg indices. waiting is the co-op wait flag
const LEVELUP = Object.freeze({
  optionsArg: 1, waitingArg: 3, optionType: 'type', optionKey: 'key', types: Object.freeze({ new: 'new', up: 'up', stat: 'stat', evo: 'evo' }),
  // a 'forget' card opens the forget-a-move screen, auto rewards never picks it
  forgetKey: 'forget',
  state: 'levelup', verified: BUILD,
  source: 'showLevelUp args; option {type:"new"|"up"|"stat", key}; Game.state "levelup"',
});
// showItemChoice(cur, incoming, callback, free=-1): callback(slot) with slot >= 0 equips into that slot, -1 keeps.
const ITEMCHOICE = Object.freeze({
  callbackArg: 2, freeArg: 3, keep: -1, state: 'choice', verified: BUILD,
  source: 'showItemChoice(cur, incoming, callback(slot), free=-1); Game.state "choice"',
  // card click runs UI.hide('scr-item') then callback(slot). ran that directly in game: state choice -> playing,
  // screen hidden, item equipped or kept (-1). the 600 ms guard is only on the click handler
  screenId: 'scr-item', uiHide: 'hide',
  closeScreen: Object.freeze({ state: 'verified', verified: BUILD, source: 'UI.hide(screenId) then callback(slot), ran in game' }),
});
// browser facts, not game names
const BROWSER = Object.freeze({
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
const EVOCHOICE = Object.freeze({
  dataArg: 1, callbackArg: 2, opts: 'opts', forms: 'forms', state: 'choice', verified: BUILD,
  source: 'RunUI.showEvo, showForm, pickEvo and the form trigger caller, read from source',
});
const AUTOMATION = Object.freeze({ pickDelayMs: 700, state: 'verified', verified: BUILD, source: 'pick guard is H=now+0x258; 700 ms delay held up with 10 queued level-ups' });

// world chunks, props, rift, legends, guest (c686e625ec)
const WORLD_CHUNK = Object.freeze({
  keys: Object.freeze({ cx: 'cx', cy: 'cy', terr: 'terr', props: 'props', propAt: 'propAt', propAll: 'propAll', specials: 'specials' }),
  tile: 32, chunk: 512, tilesPerChunk: 16, terrLen: 256, floor: 0,
  verified: BUILD, source: 'chunk keys, TS 32, CW 512, terr 0 floor / 1 wall / 2 liquid; terr index (ty-cy*16)*16+(tx-cx*16) from the breakProp code',
});
// World members used for placement. chunk(cx,cy,true) peeks the chunk Map (read from source, never called)
const WORLD_LIVE = Object.freeze({ chunk: 'chunk', tile: 'TS', cw: 'CW', verified: BUILD,
  source: 'TS, CW read in game; chunk(cx,cy,peek) from source only' });
const PROP = Object.freeze({
  keys: Object.freeze({ id: 'id', type: 'type', tx: 'tx', ty: 'ty', kind: 'kind', x: 'x', y: 'y', used: 'used', open: 'open' }),
  types: Object.freeze({ chest: 'chest', bigchest: 'bigchest' }), footInset: 4, chestTime: 3.5,
  table: Object.freeze({
    chest: Object.freeze({ solid: true, hp: 22, r: 12, kind: 0, special: false }),
    bigchest: Object.freeze({ solid: true, hp: Infinity, r: 14, kind: 1, special: true }), // kind 1..2 seen in game, 1 is ours
  }),
  verified: BUILD, source: 'prop factory in World; chest insert tested, bigchest insert not',
});
// our placement policy. ring 3 and clearance 30 are the tested values, outer ring is ours
const PLACEMENT = Object.freeze({ ringMin: 3, ringMax: 6, clearR: 30, state: 'policy', source: 'ring 3, isFree 30, tested' });
// hand-made insert (kind 1, specials, propAll, propAt) unlocked in the game's radius and opened at 3.5, breakProp
// removed it from every structure. loot after opening not seen (screens overlapped)
const BIGCHEST_INSERT = Object.freeze({ state: 'verified', verified: BUILD, source: 'insert + unlock + open worked in game, loot not seen' });
const RIFT_LIVE = Object.freeze({
  keys: Object.freeze({ portal: 'rift', debugNextType: 'debugNextType', inArena: 'inArena' }), portal: Object.freeze({ x: 'x', y: 'y', ttl: 'ttl' }),
  verified: BUILD, source: 'Rift.rift portal {x,y,ttl,t} or null; debugNextType(type) then enterRequest() tested (fire -> Heatran)',
});
const ARENA_TYPES = Object.freeze(['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy']);
// rift legendary def (Rift module, function P). idx and n are Balance.legendHp's 1st and 3rd args: rift schedule
// index (max(0, C-1)) and player count. only idx 0 tested, so idx 0 and n 1 (solo)
const LEGEND = Object.freeze({
  spd: Object.freeze({ base: 48, slope: 0.6, ref: 78, max: 105 }), xpBase: 500, xpPerSec: 1.2, shotDmgMul: 0.5, shotCd: 0.9, range: 300,
  rangedTypes: Object.freeze(['psychic', 'electric', 'ghost', 'fairy', 'fire', 'water', 'ice', 'dragon']),
  idx: 0, players: 1, dps: 0, calibrated: 0, spawnDist: Object.freeze([230, 300]),
  keys: Object.freeze({ legend: 'legend', guardS: 'guardS', flying: 'flying', leg: 'leg', types: 'types', spd: 'spd', dex: 'dex', name: 'name' }),
  balance: Object.freeze({ legendHp: 'legendHp', legendDmg: 'legendDmg', guardS: 'guardS', guardLegend: 'legend' }),
  verified: BUILD, source: 'legend def read from the Rift module',
});
const ACCOUNT = Object.freeze({ keys: Object.freeze({ guest: 'guest', save: 'save' }), verified: BUILD,
  source: 'Account.guest === true in guest, never use loggedIn' });

// --- finders.js
const MAX_OBJECTS = 2000000; // ~51,600 objects at the menu, bound anyway

function isObj(o) { return o !== null && (typeof o === 'object' || typeof o === 'function'); }
function safe(pred, o) { try { return pred(o) === true; } catch { return false; } }

function findModules(objects, table) {
  const names = Object.keys(table);
  const hits = Object.fromEntries(names.map(n => [n, { n: 0, first: null }]));
  const total = Number(objects && objects.length) || 0;
  const len = Math.min(total, MAX_OBJECTS);
  for (let i = 0; i < len; i++) {
    let o;
    try { o = objects[i]; } catch { continue; }
    if (!isObj(o)) continue;
    for (const name of names) {
      if (safe(table[name].pred, o)) {
        const h = hits[name];
        if (h.n++ === 0) h.first = o;
      }
    }
  }
  const found = {}, missing = [], ambiguous = {};
  for (const name of names) {
    const h = hits[name];
    if (h.n === 1) found[name] = h.first;
    else if (h.n === 0) missing.push(name);
    else ambiguous[name] = h.n;
  }
  return { found, missing, ambiguous, truncated: total > MAX_OBJECTS };
}

function parseBuild(src) {
  try { return new URL(String(src), 'https://base.invalid/').searchParams.get('v') || null; } catch { return null; }
}

// null = no tag or no v param, not the same as a mismatching string
function readBuild(doc) {
  try {
    const el = doc && doc.querySelector('script[src*="app.min.js"]');
    if (!el) return null;
    return parseBuild(el.getAttribute ? el.getAttribute('src') : el.src);
  } catch { return null; }
}

// --- patch.js
function createPatcher() {
  const list = [];
  let seq = 0;
  const installed = e => {
    try { return Object.getOwnPropertyDescriptor(e.obj, e.key)?.value === e.wrapper; } catch { return false; }
  };
  function undo(e) {
    if (!installed(e)) return 'left';
    try { Object.defineProperty(e.obj, e.key, e.descriptor); return 'restored'; } catch { return 'failed'; }
  }
  function wrap(obj, key, makeWrapper) {
    const d = Object.getOwnPropertyDescriptor(obj, key);
    if (!d || !('value' in d) || !d.writable || !d.configurable || typeof d.value !== 'function') {
      throw new Error(`cannot wrap ${String(key)}: not an own writable configurable function`);
    }
    const wrapper = makeWrapper(d.value);
    if (typeof wrapper !== 'function') throw new Error(`wrapper for ${String(key)} is not a function`);
    const e = { id: ++seq, obj, key, descriptor: d, wrapper };
    try {
      Object.defineProperty(obj, key, { ...d, value: wrapper });
      list.push(e);
    } catch (err) {
      undo(e);
      throw err;
    }
    return e.id;
  }
  function unwrap(id) {
    const i = list.findIndex(e => e.id === id);
    if (i < 0) return { id, status: 'unknown' };
    const [e] = list.splice(i, 1);
    return { id, key: e.key, status: undo(e) };
  }
  // reverse order, a patch someone else re-wrapped is left alone and reported
  function restoreAll() {
    const out = { restored: 0, left: [], failed: [] };
    for (const e of list.splice(0).reverse()) {
      const s = undo(e);
      if (s === 'restored') out.restored++;
      else (s === 'left' ? out.left : out.failed).push({ id: e.id, key: e.key });
    }
    return out;
  }
  return { wrap, unwrap, restoreAll, count: () => list.length };
}

// --- run.js


function validPlayer(o) {
  try { return o !== null && typeof o === 'object' && PLAYER_PRED(o) === true; } catch { return false; }
}

const fin = Number.isFinite;

function canAct(h) {
  try {
    const m = h.m, P = PLAYER.keys;
    const need = ['Game', 'Coop', 'Rift', 'Judgment'].filter(n => !m[n]);
    if (need.length) return { ok: false, reason: `not located on this build: ${need.join(', ')}` };
    if (m.Coop[COOP.keys.active]) return { ok: false, reason: 'co-op run' };
    if (m.Game[GAME.keys.state] !== GAME.keys.playing) return { ok: false, reason: 'no run in progress' };
    const p = h.player;
    if (!p) return { ok: false, reason: h.capture.error ? `player capture failed: ${h.capture.error}` : 'player not captured yet' };
    if (p[P.dead]) return { ok: false, reason: 'player is dead' };
    if (![P.hp, P.x, P.y].every(k => fin(p[k]))) return { ok: false, reason: 'player fields not finite' };
    if (m.Rift[RIFT.keys.inArena]) return { ok: false, reason: 'in rift arena' };
    if (m.Judgment[JUDGMENT.keys.active]) return { ok: false, reason: 'judgment active' };
    return { ok: true, reason: null };
  } catch (e) {
    return { ok: false, reason: `guard threw: ${e && e.message}` };
  }
}

// menu actions need no run, solo only
function canMenuAct(h) {
  const c = h.m.Coop;
  if (!c) return { ok: false, reason: 'not located on this build: Coop' };
  if (c[COOP.keys.active]) return { ok: false, reason: 'co-op run' };
  return { ok: true, reason: null };
}

// every modded action calls this first, flag is never cleared
function markPractice(h) {
  const G = GAME.keys, g = h.m.Game, t = g && g[G.st] && g[G.st][G.time];
  if (!g || typeof g[G.debugTime] !== 'function' || !fin(t)) throw new Error('practice flag unavailable');
  g[G.debugTime](t);
}

function setPlayer(h, p) {
  if (h.player === p) return;
  h.player = p;
  if (h.onPlayer) try { h.onPlayer(); } catch { /* never let a listener error reach the game */ }
}

function observe(h, c) {
  if (h.m.Coop && h.m.Coop[COOP.keys.active]) return;
  if (c === h.player) {
    if (c && c[PLAYER.keys.dead]) setPlayer(h, null);
    else if (c && h.pendingReapply && h.reapply) h.reapply();
    return;
  }
  if (validPlayer(c) && !c[PLAYER.keys.dead]) setPlayer(h, c);
}

// Combat.tick grabs the player, Game.startRun drops it. half-done install gets rolled back
function installCapture(h, patcher) {
  const ids = [];
  try {
    ids.push(patcher.wrap(h.m.Combat, COMBAT.keys.tick, orig => function (...args) {
      if (!h.dead) try { observe(h, args[TICK_PLAYER_ARG.value]); } catch { /* never block the game */ }
      return Reflect.apply(orig, this, args);
    }));
    ids.push(patcher.wrap(h.m.Game, GAME.keys.startRun, orig => function (...args) {
      if (!h.dead) setPlayer(h, null);
      return Reflect.apply(orig, this, args);
    }));
    h.capture.state = 'installed';
    return { ok: true };
  } catch (e) {
    for (const id of ids.reverse()) patcher.unwrap(id);
    h.capture.state = 'failed';
    h.capture.error = String((e && e.message) || e);
    return { ok: false, error: h.capture.error };
  }
}

// --- diagnose.js


// config key groups -> the MODULES entry whose object carries them, string key names only
const DIAG_GROUPS = Object.freeze([
  ['GAME', 'Game', GAME], ['COMBAT', 'Combat', COMBAT], ['COOP', 'Coop', COOP], ['RIFT', 'Rift', RIFT], ['RIFT_LIVE', 'Rift', RIFT_LIVE],
  ['JUDGMENT', 'Judgment', JUDGMENT], ['ENEMYMGR', 'EnemyMgr', ENEMYMGR], ['SPAWNER', 'Spawner', SPAWNER], ['ENEMIES', 'Enemies', ENEMIES],
  ['SPRITES', 'Sprites', SPRITES], ['WORLD', 'World', WORLD], ['WORLD_LIVE', 'World', WORLD_LIVE], ['PICKUPS', 'Pickups', PICKUPS],
  ['MOVES', 'Moves', MOVES], ['PROJECTILES', 'Projectiles', PROJECTILES], ['GACHA', 'Gacha', GACHA], ['RUNUI', 'RunUI', RUNUI],
  ['ACCOUNT', 'Account', ACCOUNT],
]);

// `in` only so accessors never run, a throwing has-trap counts as absent
function splitKeys(obj, names) {
  const present = [], absent = [];
  for (const k of names) {
    let has = false;
    try { has = obj !== null && (typeof obj === 'object' || typeof obj === 'function') && k in obj; } catch { has = false; }
    (has ? present : absent).push(k);
  }
  return { present, absent };
}

// not property names (gave false positives): GAME.keys.playing is a state value, and groups
// without a .keys map keep verified/source/state inline
const VALUE_KEYS = new Set(['playing']);
const META = new Set(['verified', 'source', 'state']);
function keyNames(g) {
  const inline = !(g && g.keys), m = (g && (g.keys || g)) || {};
  const skip = k => VALUE_KEYS.has(k) || (inline && META.has(k));
  return [...new Set(Object.entries(m).filter(([k, v]) => typeof v === 'string' && !skip(k)).map(([, v]) => v))];
}

function moduleStatus(h, modules) {
  const out = {};
  for (const name of Object.keys(modules)) {
    const amb = h.ambiguous && h.ambiguous[name];
    const ok = !!(h.m && h.m[name]);
    out[name] = { status: ok ? 'ok' : amb ? 'ambiguous' : 'missing', matches: ok ? 1 : amb || 0, verified: modules[name].verified };
  }
  return out;
}

function diagnose(h, cfg) {
  try {
    const modules = moduleStatus(h, cfg.modules);
    const groups = [];
    for (const [name, mod, g] of cfg.groups) {
      const obj = h.m && h.m[mod];
      if (!obj) { groups.push({ group: name, module: mod, located: false, verified: g.verified }); continue; }
      groups.push({ group: name, module: mod, located: true, verified: g.verified, ...splitKeys(obj, keyNames(g)) });
    }
    const player = h.player ? { captured: true, verified: cfg.player.verified, ...splitKeys(h.player, keyNames(cfg.player)) } : { captured: false };
    const all = Object.values(modules);
    const modBad = all.filter(m => m.status !== 'ok').length;
    const keysMissing = groups.reduce((n, g) => n + (g.absent ? g.absent.length : 0), 0) + (player.absent ? player.absent.length : 0);
    const seen = h.build ? h.build.seen : null;
    const summary = `${all.length - modBad} ok, ${keysMissing} missing keys, ${modBad} modules missing/ambiguous`;
    return { build: { expected: cfg.build, seen, state: seen === null ? 'unknown' : seen === cfg.build ? 'match' : 'mismatch' }, modules, groups, player, summary };
  } catch (e) {
    return { error: String((e && e.message) || e), summary: 'diagnose failed' };
  }
}

const diagnoseHandle = h => diagnose(h, { build: BUILD, modules: MODULES, groups: DIAG_GROUPS, player: PLAYER });

// --- api.js




const KINDS = ['toggle', 'slider', 'action', 'select'];
// run = canAct + markPractice, menu = solo only, local = UI setting, never touches the game
const SCOPES = ['run', 'menu', 'local'];
const ownKey = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

function defineFeature(d) {
  const bad = m => { throw new Error(`feature ${d && d.id}: ${m}`); };
  if (!d || typeof d.id !== 'string' || !d.id) bad('id required');
  if (!KINDS.includes(d.kind)) bad('bad kind');
  if (!Array.isArray(d.needs) || d.needs.some(n => !(n in MODULES))) bad('needs must list known modules');
  if (typeof d.apply !== 'function' || typeof d.reset !== 'function') bad('apply and reset required');
  if (d.kind === 'slider' && ![d.min, d.max, d.step, d.default].every(Number.isFinite)) bad('slider needs finite min/max/step/default');
  if (d.kind === 'select' && !(Array.isArray(d.options) && d.options.length)) bad('select needs options');
  if (d.leads !== undefined && !(Array.isArray(d.leads) && d.leads.every(n => ownKey(LEADS, n) || CONFIRMED.has(n)))) bad('leads must name registered or confirmed leads');
  if (d.unknown !== undefined && !(Array.isArray(d.unknown) && d.unknown.every(n => typeof n === 'string' && n))) bad('unknown must be strings');
  if (d.scope !== undefined && !SCOPES.includes(d.scope)) bad('bad scope');
  return Object.freeze({ category: 'Misc', label: d.id, leads: [], unknown: [], scope: 'run', ...d });
}

function clampValue(f, v) {
  if (f.kind === 'toggle') return !!v;
  if (f.kind === 'action') return undefined;
  if (f.kind === 'select') {
    if (!f.options.includes(v)) throw new Error('value not in options');
    return v;
  }
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error('value not a finite number');
  let r = Math.min(f.max, Math.max(f.min, n));
  if (f.step > 0) r = Math.min(f.max, f.min + Math.round((r - f.min) / f.step) * f.step);
  return Number(r.toFixed(6));
}

function createApi({ h, features, cleanup, expectedBuild, captureLeads = [] }) {
  const byId = new Map(features.map(f => [f.id, f]));
  const dflt = f => (f.kind === 'toggle' ? !!f.default : f.default);
  const values = new Map(features.map(f => [f.id, dflt(f)]));
  const subs = new Set();
  const emit = () => { for (const fn of [...subs]) try { fn(); } catch { /* ignore listener errors */ } };
  h.values = values;
  // new run = new player object, so per-player writes get re-applied. retried from run.js ticks until canAct passes
  h.reapply = () => {
    h.pendingReapply = false;
    if (!h.player || h.dead) return;
    const todo = features.filter(f => f.perPlayer && values.get(f.id) !== dflt(f) && !disabledReason(f));
    if (!todo.length) return;
    if (!canAct(h).ok) { h.pendingReapply = true; return; }
    try { markPractice(h); } catch { h.pendingReapply = true; return; }
    for (const f of todo) try { f.apply(h, values.get(f.id)); } catch { /* one bad field must not stop the rest */ }
  };
  h.onPlayer = () => { h.reapply(); emit(); };

  function disabledReason(f) {
    if (h.gate) return h.gate;
    const bad = f.needs.filter(n => !h.m[n]);
    if (bad.length) return `not located on this build: ${bad.join(', ')}`;
    if (f.unknown.length) return `not located on this build: ${f.unknown.join(', ')}`;
    const open = f.leads.filter(n => n in LEADS);
    if (!h.allowLeads && open.length) return `unverified on this build: ${open.join(', ')}`;
    return null;
  }
  const fail = error => ({ ok: false, error: String((error && error.message) || error) });
  const view = f => {
    const reason = disabledReason(f);
    return { id: f.id, category: f.category, label: f.label, kind: f.kind, min: f.min, max: f.max,
      step: f.step, options: f.options, value: values.get(f.id), default: dflt(f), scope: f.scope, live: !!f.live, enabled: !reason, reason };
  };

  // lead names in use, for one confirmation pass in game
  function leadsInUse() {
    const use = new Map();
    const add = (name, id) => { if (!use.has(name)) use.set(name, []); use.get(name).push(id); };
    for (const f of features) for (const n of f.leads) if (n in LEADS) add(n, f.id);
    for (const n of captureLeads) add(n, 'capture');
    return [...use].map(([name, ids]) => ({ name, ...LEADS[name], features: ids }));
  }

  const api = {
    list: () => features.map(view),
    get: id => (byId.has(id) ? view(byId.get(id)) : null),
    set(id, value) {
      const f = byId.get(id);
      if (!f) return fail('unknown feature');
      const why = disabledReason(f);
      if (why) return fail(why);
      let v;
      try { v = clampValue(f, value); } catch (e) { return fail(e); }
      const g = f.scope === 'local' ? { ok: true } : f.scope === 'menu' ? canMenuAct(h) : canAct(h);
      if (!g.ok) return fail(g.reason);
      let out;
      try { if (f.scope === 'run') markPractice(h); out = f.apply(h, v); } catch (e) { return fail(e); }
      const done = r => { values.set(id, v); emit(); return r === undefined ? { ok: true, value: v } : { ok: true, value: v, info: r }; };
      // async actions re-check the run themselves after each await
      if (out && typeof out.then === 'function') return out.then(done, fail);
      return done(out);
    },
    reset(id) {
      const f = byId.get(id);
      if (!f) return fail('unknown feature');
      try { f.reset(h); } catch (e) { return fail(e); }
      values.set(id, dflt(f));
      emit();
      return { ok: true };
    },
    resetAll: () => features.map(f => [f.id, api.reset(f.id)]),
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    status: () => ({
      leads: { allowed: h.allowLeads === true, inUse: leadsInUse() },
      build: { expected: expectedBuild, seen: h.build.seen, state: h.build.state, gate: h.gate },
      modules: { found: Object.keys(h.m), missing: [...h.missing], ambiguous: { ...h.ambiguous }, truncated: h.truncated },
      player: { captured: !!h.player, tickArg: h.tickArg },
      capture: { ...h.capture },
      patches: h.patcher.count(),
      installed: !h.dead,
      // states seen: playing, levelup, choice, paused, over. null = Game missing or not a string
      game: { state: (() => { try { const v = h.m.Game && h.m.Game[GAME.keys.state]; return typeof v === 'string' ? v : null; } catch { return null; } })() },
    }),
    // read-only, in-checks only, never throws
    diagnose: () => diagnoseHandle(h),
    uninstall() { const r = cleanup(); subs.clear(); return r; },
  };
  return api;
}

// --- features/common.js




const finite = Number.isFinite;
function noop() { /* nothing to undo */ }

// game clears the practice flag on every startRun, so re-mark once per captured player
function modded(h) {
  const p = h.player, c = h.m.Coop;
  if (h.dead || !p || !c || c[COOP.keys.active]) return false;
  if (h.scratch.marked !== p) {
    try { markPractice(h); } catch { return false; }
    h.scratch.marked = p;
  }
  return true;
}

function installWraps(h, specs) {
  const ids = [];
  try { for (const [obj, key, make] of specs) ids.push(h.patcher.wrap(obj, key, make)); }
  catch (e) { dropWraps(h, ids); throw e; }
  return ids;
}
function dropWraps(h, ids) {
  for (const id of ids.slice().reverse()) h.patcher.unwrap(id);
  ids.length = 0;
}

// features in a group share one wrap, installed while any opt is non-default
function setShared(h, group, defaults, name, value, makeSpecs) {
  const key = `shared:${group}`;
  const s = h.scratch[key] || (h.scratch[key] = { opts: { ...defaults }, ids: [] });
  const prev = s.opts[name];
  s.opts[name] = value;
  const active = Object.keys(defaults).some(k => s.opts[k] !== defaults[k]);
  if (active && !s.ids.length) {
    try { s.ids = installWraps(h, makeSpecs(s)); }
    catch (e) { s.opts[name] = prev; if (!s.ids.length && !Object.keys(defaults).some(k => s.opts[k] !== defaults[k])) delete h.scratch[key]; throw e; }
  }
  if (!active) { dropWraps(h, s.ids); delete h.scratch[key]; }
}

// d = feature fields + { group, defaults, name, specs(h, sharedState) -> [[obj, key, makeWrapper]] }
function wrapFeature(d) {
  const { group, defaults, name, specs, ...rest } = d;
  const set = (h, v) => setShared(h, group, defaults, name, v, s => specs(h, s));
  return defineFeature({ ...rest, default: defaults[name], apply: set, reset: h => set(h, defaults[name]) });
}

function clampInt(v, lo, hi) {
  const n = Number(v);
  if (!finite(n)) throw new Error('value not a finite number');
  return Math.max(lo, Math.min(hi, Math.floor(n)));
}
// Spawner.CAP + 10, hard max 256
function mobLimit(cap) { return finite(cap) && cap >= 1 ? Math.min(LIMITS.mobHard, cap + LIMITS.mobMargin) : NaN; }
function roomFor(count, limit, want) {
  return finite(count) && finite(limit) && finite(want) ? Math.max(0, Math.min(Math.floor(want), limit - count)) : 0;
}
function radialAngles(n) { const a = []; for (let i = 1; i <= n; i++) a.push(Math.PI * 2 * i / (n + 1)); return a; }
function rotate(vx, vy, a) { const c = Math.cos(a), s = Math.sin(a); return [vx * c - vy * s, vx * s + vy * c]; }
// clock going backwards = new run
function dueEvery(t, last, every) { return finite(t) && (!finite(last) || t < last || t - last >= every); }
// first spot at +x, so a single spawn lands at (px + d, py)
function ringSpots(px, py, n, d) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = Math.PI * 2 * i / n; out.push({ x: px + Math.cos(a) * d, y: py + Math.sin(a) * d }); }
  return out;
}

const val = (h, id) => h.values.get(id);

function enemyList(h) {
  const all = h.m.EnemyMgr[ENEMYMGR_LEAD.keys.all]();
  if (!Array.isArray(all)) throw new Error('enemy list unavailable');
  return all;
}
// Enemy class = any live enemy's ctor, same enemy gives the sc multipliers
function enemySample(h) {
  const E = ENEMY.keys;
  const e = enemyList(h).find(x => x && typeof x === 'object' && !x[E.dead] && typeof x[E.ctor] === 'function' && x[E.ctor].prototype);
  if (!e) throw new Error('no enemy to read the constructor from');
  return { Enemy: e[E.ctor], sample: e };
}

// --- features/stats.js




const COINS_AMOUNT = 'stats.coinsAmount';
const LEVELS_AMOUNT = 'stats.levelsAmount';
// guest saves only. loggedIn is true in guest too, so check Account.guest === true
function guestSave(account, save) {
  if (!account || account[ACCOUNT.keys.guest] !== true) throw new Error('only in guest mode');
  if (!save || typeof save.coins !== 'number' || (account[ACCOUNT.keys.save] && account[ACCOUNT.keys.save] !== save)) throw new Error('save handle does not match the account');
  return save;
}

// ratio from the value read before the first write
// inverse divides, for cdMul
function ratioStat({ id, label, field, min, max, step, inverse = false }) {
  const key = PLAYER.keys[field];
  return defineFeature({
    id, category: 'Stats', label, kind: 'slider', needs: ['Game', 'Combat'], min, max, step, default: 1, perPlayer: true,
    apply(h, v) {
      const p = h.player, s = h.scratch[id] || (h.scratch[id] = {});
      if (s.player !== p) {
        if (!finite(p[key]) || p[key] <= 0) throw new Error(`${key} is not a positive finite number`);
        s.player = p; s.base = p[key];
      }
      p[key] = inverse ? s.base / v : s.base * v;
    },
    reset(h) {
      const s = h.scratch[id];
      if (s && s.player) s.player[key] = s.base;
      delete h.scratch[id];
    },
  });
}

const HP = 'stats.hp';

const STATS = [
  ratioStat({ id: 'stats.damage', label: 'Damage', field: 'atkMul', min: 1, max: 10, step: 0.1 }),
  ratioStat({ id: 'stats.attackSpeed', label: 'Attack speed', field: 'cdMul', min: 0.5, max: 10, step: 0.25, inverse: true }),
  ratioStat({ id: 'stats.movement', label: 'Movement speed', field: 'spdMul', min: 0.5, max: 3, step: 0.1 }),
  ratioStat({ id: 'stats.pickup', label: 'Pickup range', field: 'magnet', min: 1, max: 30, step: 0.5 }),
  ratioStat({ id: 'stats.xp', label: 'Experience gain', field: 'xpMul', min: 1, max: 50, step: 1 }),
  // hp is filled to the new max
  defineFeature({
    id: HP, category: 'Stats', label: 'Max HP', kind: 'slider', needs: ['Game', 'Combat'], min: 1, max: 100, step: 0.5, default: 1, perPlayer: true,
    apply(h, v) {
      const p = h.player, P = PLAYER.keys, s = h.scratch[HP] || (h.scratch[HP] = {});
      if (s.player !== p) {
        if (!finite(p[P.maxHp]) || p[P.maxHp] <= 0) throw new Error('maxHp is not a positive finite number');
        s.player = p; s.base = p[P.maxHp];
      }
      p[P.maxHp] = Math.round(s.base * v);
      p[P.hp] = p[P.maxHp];
    },
    reset(h) {
      const s = h.scratch[HP], P = PLAYER.keys;
      if (s && s.player) { s.player[P.maxHp] = s.base; if (s.player[P.hp] > s.base) s.player[P.hp] = s.base; }
      delete h.scratch[HP];
    },
  }),
  defineFeature({
    id: LEVELS_AMOUNT, category: 'Stats', label: 'Levels to add', kind: 'slider', scope: 'local', needs: [], min: 1, max: LIMITS.levelsMax, step: 1, default: 1,
    apply: noop, reset: noop,
  }),
  // debugLevelUp: level++ and one queued level-up screen per call, tested in game
  defineFeature({
    id: 'stats.levelUp', category: 'Stats', label: 'Level up', kind: 'action', needs: ['Game', 'Combat'],
    apply(h) {
      const up = h.m.Game[GAME.keys.debugLevelUp];
      if (typeof up !== 'function') throw new Error('Game.debugLevelUp not found');
      const n = clampInt(val(h, LEVELS_AMOUNT), 1, LIMITS.levelsMax);
      for (let i = 0; i < n; i++) up();
      return `+${n} level${n > 1 ? 's' : ''} (one card screen each)`;
    },
    reset: noop,
  }),
  defineFeature({
    id: COINS_AMOUNT, category: 'Stats', label: 'Coins to add', kind: 'slider', scope: 'local', needs: [], min: 100, max: LIMITS.coinsMax, step: 100, default: 1000,
    apply: noop, reset: noop,
  }),
  // coins write on a guest save lands in game. never touches a signed-in save
  defineFeature({
    id: 'stats.coins', category: 'Stats', label: 'Add coins (save)', kind: 'action', scope: 'menu', needs: ['Save', 'Account'],
    apply(h) {
      const save = guestSave(h.m.Account, h.m.Save), n = clampInt(val(h, COINS_AMOUNT), 1, LIMITS.coinsMax), next = save.coins + n;
      if (!Number.isSafeInteger(next)) throw new Error('coins would overflow');
      save.coins = next;
      return `+${n} coins (now ${next}; the HUD updates after the run)`;
    },
    reset: noop,
  }),
];

// --- features/powers.js




const P = PLAYER.keys, E = ENEMY.keys, PL = PLAYER_LEAD.keys, MV = MOVE_LEAD.keys, PJ = PROJ_LEAD.keys;
const VACUUM_EVERY = 0.5;   // s
const MOVE_SLOTS = 32;      // slice bound
const ENEMY_BATCH = 256;    // slice bound

const GOD = wrapFeature({
  id: 'powers.god', category: 'Powers', label: 'God mode', kind: 'toggle', needs: ['Game', 'Combat', 'Coop'],
  group: 'powers.god', defaults: { on: false }, name: 'on',
  // player exists here (apply runs after canAct), wrap goes on its prototype
  specs: (h, s) => {
    const proto = Object.getPrototypeOf(h.player);
    if (!proto) throw new Error('player has no prototype');
    return [[proto, P.hurt, orig => function (...args) {
      if (s.opts.on && this === h.player && modded(h)) return undefined;
      return Reflect.apply(orig, this, args);
    }]];
  },
});

const STASIS = wrapFeature({
  id: 'powers.stasis', category: 'Powers', label: 'Freeze enemies', kind: 'toggle', needs: ['Game', 'Combat', 'Coop', 'EnemyMgr'],
  leads: ['EnemyMgr.all'], group: 'powers.stasis', defaults: { on: false }, name: 'on',
  specs: (h, s) => {
    const { Enemy } = enemySample(h);
    return [[Enemy.prototype, E.update, orig => function (...args) {
      if (s.opts.on && modded(h)) return undefined;
      return Reflect.apply(orig, this, args);
    }]];
  },
});

// arsenal, area and vacuum share one Combat.tick wrap
const TICK_GROUP = 'powers.tick';
const TICK_DEFAULTS = { arsenal: false, area: 1, vacuum: false };
const TICK_LEADS = [];
function tickSpecs(h, s) {
  return [[h.m.Combat, COMBAT.keys.tick, orig => function (...args) {
    const pl = args[TICK_PLAYER_ARG.value];
    if (pl !== h.player || !modded(h)) return Reflect.apply(orig, this, args);
    const o = s.opts, undo = [];
    try {
      if (o.arsenal && Array.isArray(pl[P.moves])) {
        const d = Object.getOwnPropertyDescriptor(pl, PL.activeGroup);
        Object.defineProperty(pl, PL.activeGroup, { configurable: true, writable: true, value: () => pl[P.moves].slice(0, MOVE_SLOTS) });
        undo.push(() => (d ? Object.defineProperty(pl, PL.activeGroup, d) : delete pl[PL.activeGroup]));
      }
      if (o.area !== 1 && Array.isArray(pl[P.moves])) {
        for (const m of pl[P.moves].slice(0, MOVE_SLOTS)) for (const k of MV.sizeKeys) {
          if (m && finite(m[k]) && m[k] > 0) { const before = m[k]; m[k] = before * o.area; undo.push(() => { m[k] = before; }); }
        }
      }
      if (o.vacuum) {
        const g = h.m.Game, t = g[GAME.keys.st] && g[GAME.keys.st][GAME.keys.time];
        if (g[GAME.keys.state] === GAME.keys.playing && dueEvery(t, s.last, VACUUM_EVERY)) { h.m.Pickups[PICKUPS.keys.pullAll](); s.last = t; }
      }
      return Reflect.apply(orig, this, args);
    } finally {
      for (const u of undo.reverse()) try { u(); } catch { /* keep restoring */ }
    }
  }]];
}
const tickFeature = (id, label, kind, name, extra) => wrapFeature({
  id, category: 'Powers', label, kind, needs: ['Game', 'Combat', 'Coop', 'Pickups'], group: TICK_GROUP, defaults: TICK_DEFAULTS, name,
  specs: tickSpecs, ...extra,
});
const ARSENAL = tickFeature('powers.arsenal', 'Arsenal (all moves fire)', 'toggle', 'arsenal', { leads: [...TICK_LEADS, 'Player.activeGroup'] });
const AREA = tickFeature('powers.area', 'Area multiplier', 'slider', 'area',
  { min: 1, max: 5, step: 0.1, leads: [...TICK_LEADS, 'Move.sizeKeys'] });
// NOTE: Pickups.pullAll does nothing while Game.state is levelup
const VACUUM = tickFeature('powers.vacuum', 'Vacuum loot', 'toggle', 'vacuum', { leads: TICK_LEADS });

// radial, homing, pierce share one Projectiles.spawn wrap
const PROJ_GROUP = 'powers.proj';
const PROJ_DEFAULTS = { radial: 0, homing: 0, pierce: 0 };
const PROJ_LEADS = ['Projectile.owner', 'Projectile.friendly', 'Projectile.ghost', 'Projectile.orb', 'Projectile.vx',
  'Projectile.vy', 'Projectile.homing', 'Projectile.pierce', 'Projectile.hits', 'Projectile.phits', 'Projectile.hitLog'];
function projSpecs(h, s) {
  return [[h.m.Projectiles, PROJECTILES.keys.spawn, orig => function (input, ...rest) {
    if (!modded(h) || !input || typeof input !== 'object' || input[PJ.owner] !== h.player || input[PJ.friendly] === false || input[PJ.ghost]) {
      return Reflect.apply(orig, this, [input, ...rest]);
    }
    const o = s.opts, mgr = h.m.Projectiles;
    let shot = input;
    if (!input[PJ.orb] && (o.homing || o.pierce)) {
      shot = { ...input };
      if (o.homing) shot[PJ.homing] = Math.max(shot[PJ.homing] || 0, o.homing);
      if (o.pierce) shot[PJ.pierce] = Math.min(100, (shot[PJ.pierce] || 0) + o.pierce);
    }
    const out = Reflect.apply(orig, this, [shot, ...rest]);
    const vx = shot[PJ.vx], vy = shot[PJ.vy];
    if (o.radial && !shot[PJ.orb] && finite(vx) && finite(vy) && Math.hypot(vx, vy) > 0) {
      for (const a of radialAngles(o.radial)) {
        if (!(mgr[PROJECTILES_ALL.key]().length < LIMITS.projectiles)) break;
        const [rx, ry] = rotate(vx, vy, a);
        Reflect.apply(orig, this, [{ ...shot, [PJ.vx]: rx, [PJ.vy]: ry, [PJ.hits]: new Set(), [PJ.phits]: new Set(),
          [PJ.hitLog]: shot[PJ.hitLog] ? new Map() : null }, ...rest]);
      }
    }
    return out;
  }]];
}
const projFeature = (id, label, name, max) => wrapFeature({
  id, category: 'Powers', label, kind: 'slider', needs: ['Game', 'Combat', 'Coop', 'Projectiles'], group: PROJ_GROUP, defaults: PROJ_DEFAULTS,
  name, min: 0, max, step: 1, leads: PROJ_LEADS, specs: projSpecs,
});

const action = d => defineFeature({ category: 'Powers', kind: 'action', reset: noop, ...d });
const ENEMY_LEADS = ['EnemyMgr.all', 'Enemy.die()'];
function defeat(h, all) {
  const list = enemyList(h).filter(e => e && !e[E.dead] &&
    (all || (!e[E.shiny] && !e[E.boss] && !e[ENEMY_LEAD.keys.legend] && e[E.behavior] !== ENEMY_DEF.keys.thief)))
    .slice(0, ENEMY_BATCH);
  if (list.some(e => typeof e[E.die] !== 'function')) throw new Error('enemy defeat handling not exposed');
  for (const e of list) { e[E.hp] = 0; e[E.die](); }
  return `${list.length} enemies defeated`;
}
function eachMove(h, fn) {
  const moves = h.player[P.moves];
  if (!Array.isArray(moves)) throw new Error('player moves unavailable');
  let n = 0;
  for (const m of moves.slice(0, MOVE_SLOTS)) if (m && typeof m === 'object') n += fn(m);
  return n;
}

const POWERS = [
  GOD, STASIS, ARSENAL, AREA, VACUUM,
  projFeature('powers.radial', 'Radial shots', 'radial', 8),
  projFeature('powers.homing', 'Homing', 'homing', 20),
  projFeature('powers.pierce', 'Pierce', 'pierce', 30),
  action({ id: 'powers.heal', label: 'Heal to full', needs: ['Game', 'Combat'], leads: ['Player.heal(maxHp)'],
    apply(h) { const p = h.player; p[P.heal](p[P.maxHp]); return 'healed'; } }),
  action({ id: 'powers.loot', label: 'Pull all loot', needs: ['Game', 'Combat', 'Pickups'],
    apply(h) { h.m.Pickups[PICKUPS.keys.pullAll](); return 'loot pulled'; } }),
  action({ id: 'powers.maxMoves', label: 'Max all moves', needs: ['Game', 'Combat', 'Moves'],
    leads: ['Move.lvl', 'Move.def', 'Moves.levelUp(move)'],
    apply(h) {
      const Mv = h.m.Moves;
      const n = eachMove(h, m => {
        const max = m[MV.def] && m[MV.def][MOVE_DEF.keys.maxLvl];
        let c = 0;
        if (!finite(max)) return 0;
        for (let i = 0; i < 20 && m[MV.lvl] < max; i++) { if (!Mv[MOVES.keys.levelUp](m)) break; c++; }
        return c;
      });
      return `${n} move levels added`;
    } }),
  action({ id: 'powers.evolve', label: 'Evolve ready moves', needs: ['Game', 'Combat', 'Moves'],
    leads: ['Moves.evoInfo(move,statsTaken)', 'EvoInfo.ready', 'Moves.evolve(move)'],
    apply(h) {
      const Mv = h.m.Moves, st = h.player[P.statsTaken];
      const n = eachMove(h, m => { const i = Mv[MOVES.keys.evoInfo](m, st); return i && i[EVO_LEAD.keys.ready] && Mv[MOVES.keys.evolve](m) ? 1 : 0; });
      return `${n} moves evolved`;
    } }),
  action({ id: 'powers.clearNormal', label: 'Clear normal enemies', needs: ['Game', 'Combat', 'EnemyMgr'],
    leads: [...ENEMY_LEADS, 'Enemy.legend'], apply: h => defeat(h, false) }),
  action({ id: 'powers.defeatAll', label: 'Defeat all enemies', needs: ['Game', 'Combat', 'EnemyMgr'],
    leads: ENEMY_LEADS, apply: h => defeat(h, true) }),
  action({ id: 'powers.death', label: 'Die (KO)', needs: ['Game', 'Combat', 'Judgment', 'Projectiles'],
    leads: ['Player.anim', 'Player.animPlay', 'Player.faintArgs', 'Projectiles.clearOrbs(player)'],
    apply(h) {
      const p = h.player, anim = p[PL.anim], clear = h.m.Projectiles[PROJECTILES.keys.clearOrbs];
      if (h.m.Judgment[JUDGMENT.keys.cinematic]) throw new Error('wait for the current cinematic to finish');
      if (!anim || typeof anim[PL.animPlay] !== 'function' || typeof clear !== 'function') throw new Error('KO handling not exposed');
      p[P.hp] = 0; p[P.dead] = true;
      anim[PL.animPlay](PL.faintArgs[0], { ...PL.faintArgs[1] });
      clear.call(h.m.Projectiles, p);
      return 'player defeated';
    } }),
];

// --- features/locator.js





const LC = WORLD_CHUNK.keys, LP = PROP.keys, LE = ENEMY.keys;

// +x east, +y south (canvas, y down)
// TODO: not checked against a real chest yet
function distance(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
const DIRS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
function direction8(dx, dy) {
  if (!finite(dx) || !finite(dy) || (dx === 0 && dy === 0)) return '?';
  return DIRS[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
}
const formatPx = d => `${Math.round(d)}px`;
function formatProgress(open) {
  return finite(open) ? `${Math.min(PROP.chestTime, Math.max(0, open)).toFixed(1)}/${PROP.chestTime}` : `?/${PROP.chestTime}`;
}

// chunk map keys are numbers: 0x200000*(a+0x100000)+(b+0x100000)
const tileKey = (a, b) => 0x200000 * (a + 0x100000) + (b + 0x100000);

function nearestBigChest(chunks, px, py) {
  let best = null, seen = 0;
  for (const ch of chunks.values()) {
    if (++seen > LIMITS.chunkScanMax) break;
    if (!ch || !Array.isArray(ch[LC.props])) continue;
    for (const p of ch[LC.props]) {
      if (!p || p[LP.type] !== PROP.types.bigchest || p[LP.used] || !finite(p[LP.x]) || !finite(p[LP.y])) continue;
      const d = distance(px, py, p[LP.x], p[LP.y]);
      if (!best || d < best.dist) best = { prop: p, dist: d, dx: p[LP.x] - px, dy: p[LP.y] - py };
    }
  }
  return best;
}
function formatBigChest(f) {
  return f ? `big chest ${formatPx(f.dist)} ${direction8(f.dx, f.dy)}, unlock ${formatProgress(f.prop[LP.open])}` : 'none in loaded chunks';
}

function radarLabel(e) {
  const tags = [e[ENEMY_LEAD.keys.legend] && 'legend', e[LE.boss] && 'boss', e[LE.shiny] && 'shiny'].filter(Boolean).join('+');
  const who = typeof e[LE.name] === 'string' && e[LE.name] ? e[LE.name] : `#${e[LE.dex]}`;
  return `${tags} ${who}`;
}
function radarTargets(enemies, px, py, max) {
  const out = [];
  for (const e of enemies) {
    if (!e || typeof e !== 'object' || e[LE.dead] || !(e[LE.shiny] || e[LE.boss] || e[ENEMY_LEAD.keys.legend])) continue;
    if (!finite(e[LE.x]) || !finite(e[LE.y])) continue;
    out.push({ label: radarLabel(e), dist: distance(px, py, e[LE.x], e[LE.y]), dx: e[LE.x] - px, dy: e[LE.y] - py });
  }
  return out.sort((a, b) => a.dist - b.dist).slice(0, max);
}
function formatPortal(portal, px, py) {
  if (!portal) return 'no rift portal';
  const K = RIFT_LIVE.portal, x = portal[K.x], y = portal[K.y], ttl = portal[K.ttl];
  if (![x, y, ttl].every(finite)) return 'rift portal data invalid';
  return `rift portal ${formatPx(distance(px, py, x, y))} ${direction8(x - px, y - py)}, ttl ${Math.max(0, Math.round(ttl))}s`;
}
function formatRadar(targets, portalText) {
  const t = targets.length ? targets.map(x => `${x.label} ${formatPx(x.dist)} ${direction8(x.dx, x.dy)}`) : ['no shiny, boss or legend targets'];
  return [...t, portalText].join(' | ');
}

function ringTiles(ptx, pty, rMin, rMax) {
  const out = [];
  for (let dy = -rMax; dy <= rMax; dy++) for (let dx = -rMax; dx <= rMax; dx++) {
    const d = Math.max(Math.abs(dx), Math.abs(dy));
    if (d >= rMin && d <= rMax) out.push([ptx + dx, pty + dy]);
  }
  return out;
}
function shuffled(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
// terr index is (ty - cy*16)*16 + (tx - cx*16), same as the game's break code
function floorTile(chunks, tx, ty) {
  const n = WORLD_CHUNK.tilesPerChunk, cx = Math.floor(tx / n), cy = Math.floor(ty / n);
  const ch = chunks.get(tileKey(cx, cy));
  if (!ch || ch[LC.cx] !== cx || ch[LC.cy] !== cy || !(ch[LC.terr] instanceof Uint8Array) || ch[LC.terr].length !== WORLD_CHUNK.terrLen) return null;
  const key = tileKey(tx, ty);
  if (ch[LC.terr][(ty - cy * n) * n + (tx - cx * n)] !== WORLD_CHUNK.floor || ch[LC.propAll].has(key)) return null;
  return { chunk: ch, key };
}
// copy of the game's prop factory, wiggle 0 like the insert I tested
function makeProp(type, tx, ty, id) {
  const d = PROP.table[type], T = WORLD_CHUNK.tile;
  if (!d) throw new Error(`unknown prop type ${type}`);
  return { id, type, tx, ty, kind: d.kind, x: tx * T + T / 2, y: ty * T + T - PROP.footInset, r: d.r, hp: d.hp, maxHp: d.hp, solid: d.solid,
    flat: false, destructible: d.hp !== Infinity, flash: 0, wiggle: 0, used: false, charge: 1, open: 0 };
}
// mirrors the game's chunk insert (aC)
function insertProp(chunk, prop) {
  chunk[LC.props].push(prop);
  chunk[LC.propAll].set(tileKey(prop.tx, prop.ty), prop);
  if (prop.solid) chunk[LC.propAt].set(tileKey(prop.tx, prop.ty), prop);
  if (PROP.table[prop.type].special) chunk[LC.specials].push(prop);
}
function lowestId(chunks) {
  let low = 0, seen = 0;
  for (const ch of chunks.values()) {
    if (++seen > LIMITS.chunkScanMax) break;
    for (const p of (ch && ch[LC.props]) || []) if (finite(p && p[LP.id]) && p[LP.id] < low) low = p[LP.id];
  }
  return low;
}
// insert each prop before the next isFree check so it sees the ones already placed
function placeProps({ chunks, type, want, px, py, isFree, rng = Math.random }) {
  const T = WORLD_CHUNK.tile, placed = [];
  let id = Math.min(-1, lowestId(chunks) - 1);
  for (const [tx, ty] of shuffled(ringTiles(Math.floor(px / T), Math.floor(py / T), PLACEMENT.ringMin, PLACEMENT.ringMax), rng)) {
    if (placed.length >= want) break;
    const t = floorTile(chunks, tx, ty);
    if (!t) continue;
    const prop = makeProp(type, tx, ty, id);
    if (!isFree(prop.x, prop.y, PLACEMENT.clearR)) continue;
    insertProp(t.chunk, prop);
    placed.push(prop);
    id--;
  }
  return placed;
}

// chunk Map was found at install, bail if the game swapped it. World.chunk(cx, cy, true) peeks the live one
function liveChunks(h) {
  const chunks = h.m.Chunks, w = h.m.World, p = h.player, W = WORLD_LIVE;
  if (!(chunks instanceof Map) || !w || typeof w[W.chunk] !== 'function') throw new Error('chunk access unavailable');
  if (w[W.tile] !== WORLD_CHUNK.tile || w[W.cw] !== WORLD_CHUNK.chunk) throw new Error('world tile size differs from the verified build');
  const cx = Math.floor(p[PLAYER.keys.x] / WORLD_CHUNK.chunk), cy = Math.floor(p[PLAYER.keys.y] / WORLD_CHUNK.chunk);
  const mine = chunks.get(tileKey(cx, cy));
  if (!mine || w[W.chunk](cx, cy, true) !== mine) throw new Error('chunk map is stale (player chunk not in the game map)');
  return chunks;
}

const LOCATOR_NEEDS = ['Game', 'Coop', 'Rift', 'Judgment'];
function locate(h) {
  const g = canAct(h);
  if (!g.ok) throw new Error(g.reason);
  return h.player;
}
// live = panel shows a Live switch that re-runs it on a timer
const locatorAction = d => defineFeature({ category: 'Locator', kind: 'action', scope: 'menu', reset: noop, live: true, ...d });

const LOCATOR = [
  locatorAction({ id: 'locator.bigChest', label: 'Locate nearest big chest', needs: [...LOCATOR_NEEDS, 'World', 'Chunks'],
    apply(h) { const p = locate(h), ch = liveChunks(h); return formatBigChest(nearestBigChest(ch, p[PLAYER.keys.x], p[PLAYER.keys.y])); } }),
  locatorAction({ id: 'locator.radar', label: 'Rare target radar', needs: [...LOCATOR_NEEDS, 'EnemyMgr'],
    leads: ['EnemyMgr.all'],
    apply(h) {
      const p = locate(h), x = p[PLAYER.keys.x], y = p[PLAYER.keys.y];
      return formatRadar(radarTargets(enemyList(h), x, y, LIMITS.radarMax), formatPortal(h.m.Rift[RIFT_LIVE.keys.portal], x, y));
    } }),
];

// --- features/spawns.js






const SP = PLAYER.keys, SE = ENEMY.keys, SD = ENEMY_DEF.keys;
const SPECIES_RING = 70; // first spawn lands at player.x + 70 in game
const RIFT_TYPE = 'spawns.riftType', LEGEND_DEX = 'spawns.riftBossDex', LEGEND_SHINY = 'spawns.riftBossShiny';
const COUNT = 'spawns.count', DEX = 'spawns.dex', SHINY_FLAG = 'spawns.speciesShiny', GACHA_COUNT = 'spawns.gachaCount';

const spawnAction = d => defineFeature({ category: 'Spawns', kind: 'action', reset: noop, ...d });
const localSetting = d => defineFeature({ category: 'Spawns', scope: 'local', needs: [], apply: noop, reset: noop, ...d });

const RATE = wrapFeature({
  id: 'spawns.rate', category: 'Spawns', label: 'Spawn rate', kind: 'slider', needs: ['Game', 'Combat', 'Coop', 'Spawner'],
  leads: ['Spawner.update.dtArg'], group: 'spawns.rate', defaults: { rate: 1 }, name: 'rate', min: 1, max: 10, step: 0.5,
  specs: (h, s) => [[h.m.Spawner, SPAWNER.keys.update, orig => function (...args) {
    const i = SPAWNER_UPDATE_DT_ARG.value;
    if (modded(h) && finite(args[i]) && args[i] >= 0) args[i] *= s.opts.rate;
    return Reflect.apply(orig, this, args);
  }]],
});

const SHINY_CHANCE = wrapFeature({
  id: 'spawns.shinyChance', category: 'Spawns', label: 'Shiny chance %', kind: 'slider',
  needs: ['Game', 'Combat', 'Coop', 'EnemyMgr', 'Sprites'], group: 'spawns.shiny', defaults: { pct: 0 }, name: 'pct', min: 0, max: 100, step: 1,
  specs: (h, s) => [[h.m.EnemyMgr, ENEMYMGR.keys.add, orig => function (...args) {
    try {
      const e = args[0];
      if (s.opts.pct > 0 && modded(h) && e && typeof e === 'object' && !e[SE.boss] && !e[SE.shiny] && !e[SE.dead] &&
          e[SE.behavior] !== SD.thief && typeof e[SE.makeShiny] === 'function' &&
          h.m.Sprites[SPRITES.keys.hasShiny](e[SE.dex]) && Math.random() < s.opts.pct / 100) e[SE.makeShiny]();
    } catch { /* never block the add */ }
    return Reflect.apply(orig, this, args);
  }]],
});

function liveRun(h) {
  if (h.dead) throw new Error('uninstalled');
  const g = canAct(h);
  if (!g.ok) throw new Error(g.reason);
  return h.player;
}
function mobRoom(h, want) {
  const limit = mobLimit(h.m.Spawner[SPAWNER.keys.cap]);
  const n = roomFor(h.m.EnemyMgr[ENEMYMGR.keys.count], limit, want);
  if (!n) throw new Error('mob limit reached or unavailable');
  return { n, limit };
}
function runTime(h) {
  const G = GAME.keys, t = h.m.Game[G.st] && h.m.Game[G.st][G.time];
  if (!finite(t) || t < 0) throw new Error('run clock unavailable');
  return t;
}

// Enemy class and sc come from an existing enemy
async function spawnSpecies(h, dex, want, shiny) {
  const { Enemy, sample } = enemySample(h), m = h.m;
  const sc = sample[SE.sc];
  if (!sc || ![sc.hp, sc.spd, sc.dmg].every(finite)) throw new Error('enemy scale multipliers unavailable');
  if (shiny && !m.Sprites[SPRITES.keys.hasShiny](dex)) throw new Error('no shiny sprite for that species');
  await m.Sprites[SPRITES.keys.preload]([dex]);
  const p = liveRun(h); // run may have changed during the await
  const { n } = mobRoom(h, want), t = runTime(h);
  let made = 0;
  for (const spot of ringSpots(p[SP.x], p[SP.y], n, SPECIES_RING)) {
    const def = m.Enemies[ENEMIES.keys.defForDex](dex, t);
    if (!def || typeof def !== 'object' || !finite(def[SE.hp])) throw new Error('no enemy definition for that species');
    const e = new Enemy(def, spot.x, spot.y, { hp: sc.hp, spd: sc.spd, dmg: sc.dmg });
    if (shiny) e[SE.makeShiny]();
    m.EnemyMgr[ENEMYMGR.keys.add](e);
    made++;
  }
  return `${made} spawned${shiny ? ' (shiny)' : ''}`;
}

// free spot via World.isFree, ring search
async function spawnTreasure(h, kind, want) {
  const T = TREASURE[kind], { Enemy } = enemySample(h), m = h.m;
  await m.Sprites[SPRITES.keys.preload]([T.dex]);
  const p = liveRun(h), t = runTime(h);
  const { n, limit } = mobRoom(h, clampInt(want, 1, LIMITS.treasureMax));
  const def = { dex: T.dex, behavior: SD.thief, hp: Math.round(TREASURE.hpBase * (1 + t / TREASURE.hpPerSec) * T.hpMul),
    spd: TREASURE.spd, dmg: TREASURE.dmg, xp: TREASURE.xp, [SD.loot]: T.loot };
  let made = 0;
  for (let i = 0; i < n && m.EnemyMgr[ENEMYMGR.keys.count] < limit; i++) {
    let spot = null;
    for (let a = 0; a < 12 && !spot; a++) {
      const ang = Math.random() * Math.PI * 2, d = 230 + Math.random() * 70;
      const x = p[SP.x] + Math.cos(ang) * d, y = p[SP.y] + Math.sin(ang) * d * 0.8;
      if (m.World[WORLD.keys.isFree](x, y, 14)) spot = { x, y };
    }
    if (!spot) break;
    const e = new Enemy({ ...def }, spot.x, spot.y, { ...TREASURE.scale });
    e[SE.life] = TREASURE.life;
    m.EnemyMgr[ENEMYMGR.keys.add](e);
    made++;
  }
  if (!made) throw new Error('no free spawn position found');
  return `${made} treasure carriers spawned`;
}

// uninstall leaves placed chests on purpose, they are plain game props and the game removes them
function placeChests(h, type, want) {
  const p = liveRun(h), chunks = liveChunks(h), w = h.m.World;
  const placed = placeProps({ chunks, type, want, px: p[SP.x], py: p[SP.y], isFree: (x, y, r) => w[WORLD.keys.isFree](x, y, r) === true });
  if (!placed.length) throw new Error('no free floor tile found nearby');
  return `${placed.length} ${type} placed`;
}

// def formula copied from the game's Rift module (function P), bal = Balance
function buildLegendDef(entry, t, bal, idx = LEGEND.idx, n = LEGEND.players) {
  const K = LEGEND.keys, B = LEGEND.balance, S = LEGEND.spd, spd = entry && entry[K.spd], types = entry && entry[K.types];
  if (!entry || !finite(spd) || !Array.isArray(types) || !finite(t) || t < 0 || !bal || typeof bal[B.legendHp] !== 'function' || typeof bal[B.legendDmg] !== 'function') throw new Error('legend inputs unavailable');
  const hp = Math.round(bal[B.legendHp](idx, t, n, LEGEND.dps, LEGEND.calibrated)), dmg = bal[B.legendDmg](t);
  if (!finite(hp) || hp < 1 || !finite(dmg) || dmg < 0) throw new Error('Balance returned unusable numbers');
  return { dex: entry[K.dex], name: entry[K.name], hp, spd: Math.round(Math.min(S.max, Math.max(S.base, S.base + S.slope * (spd - S.ref)))),
    dmg: Math.round(dmg), xp: Math.round(LEGEND.xpBase + LEGEND.xpPerSec * t),
    behavior: types.some(x => LEGEND.rangedTypes.includes(x)) ? 'ranged' : 'charger',
    shotDmg: Math.round(LEGEND.shotDmgMul * dmg), shotCd: LEGEND.shotCd, range: LEGEND.range };
}
function findLegend(dex, number) {
  const e = Array.isArray(dex) ? dex.find(x => x && x[LEGEND.keys.dex] === number) : null;
  return e && e[LEGEND.keys.leg] === true ? e : null;
}

async function spawnRiftBoss(h, number, shiny) {
  const { Enemy } = enemySample(h), m = h.m, entry = findLegend(m.Dex, number);
  if (!entry) throw new Error(`dex ${number} is not a legendary in the game's table`);
  if (shiny && !m.Sprites[SPRITES.keys.hasShiny](number)) throw new Error('no shiny sprite for that species');
  await m.Sprites[SPRITES.keys.preload]([number]);
  const p = liveRun(h);
  mobRoom(h, 1);
  const K = LEGEND.keys, B = LEGEND.balance;
  const def = buildLegendDef(entry, runTime(h), m.Balance);
  const guard = m.Balance[B.guardS] && m.Balance[B.guardS][B.guardLegend];
  if (typeof guard !== 'function') throw new Error('Balance.guardS.legend unavailable');
  let spot = null;
  for (let a = 0; a < 12 && !spot; a++) {
    const ang = Math.random() * Math.PI * 2, d = LEGEND.spawnDist[0] + Math.random() * (LEGEND.spawnDist[1] - LEGEND.spawnDist[0]);
    const x = p[SP.x] + Math.cos(ang) * d, y = p[SP.y] + Math.sin(ang) * d * 0.8;
    if (m.World[WORLD.keys.isFree](x, y, 14)) spot = { x, y };
  }
  if (!spot) throw new Error('no free spawn position found');
  const e = new Enemy(def, spot.x, spot.y, { ...TREASURE.scale }, true);
  e[K.legend] = true; e[K.guardS] = guard(LEGEND.idx); e[K.flying] = false;
  if (shiny) e[SE.makeShiny]();
  m.EnemyMgr[ENEMYMGR.keys.add](e);
  return `${def.name || 'legendary'} spawned (hp ${def.hp})`;
}

const SPECIES_NEEDS = ['Game', 'Combat', 'Coop', 'Rift', 'Judgment', 'Spawner', 'EnemyMgr', 'Enemies', 'Sprites'];
const CHEST_NEEDS = ['Game', 'Combat', 'Coop', 'Rift', 'Judgment', 'World', 'Chunks'];
const SPECIES_LEADS = ['EnemyMgr.all'];
const TREASURE_NEEDS = ['Game', 'Combat', 'Coop', 'Rift', 'Judgment', 'Spawner', 'EnemyMgr', 'Sprites', 'World'];
const TREASURE_LEADS = ['EnemyMgr.all', 'World.isFree(x,y,r)'];

const SPAWNS = [
  RATE, SHINY_CHANCE,
  localSetting({ id: COUNT, label: 'Spawn count', kind: 'slider', min: 1, max: LIMITS.swarmMax, step: 1, default: 5 }),
  localSetting({ id: DEX, label: 'Species (dex number)', kind: 'slider', min: 1, max: LIMITS.speciesMax, step: 1, default: 25 }),
  localSetting({ id: SHINY_FLAG, label: 'Chosen species shiny', kind: 'toggle', default: false }),
  spawnAction({ id: 'spawns.swarm', label: 'Wild swarm', needs: ['Game', 'Combat', 'Spawner', 'EnemyMgr'],
    apply(h) {
      const { n } = mobRoom(h, clampInt(val(h, COUNT), 1, LIMITS.swarmMax)), c = h.m.EnemyMgr, k = ENEMYMGR.keys.count, before = c[k];
      h.m.Spawner[SPAWNER.keys.burst](n);
      return `${c[k] - before} spawned`;
    } }),
  spawnAction({ id: 'spawns.species', label: 'Spawn chosen species', needs: SPECIES_NEEDS, leads: SPECIES_LEADS,
    apply: h => spawnSpecies(h, clampInt(val(h, DEX), 1, LIMITS.speciesMax), clampInt(val(h, COUNT), 1, LIMITS.swarmMax), !!val(h, SHINY_FLAG)) }),
  spawnAction({ id: 'spawns.shinyPack', label: 'Shiny pack (chosen species)', needs: SPECIES_NEEDS, leads: SPECIES_LEADS,
    apply: h => spawnSpecies(h, clampInt(val(h, DEX), 1, LIMITS.speciesMax), clampInt(val(h, COUNT), 1, LIMITS.swarmMax), true) }),
  spawnAction({ id: 'spawns.treasureGholdengo', label: 'Treasure Gholdengo', needs: TREASURE_NEEDS, leads: TREASURE_LEADS,
    apply: h => spawnTreasure(h, 'gholdengo', val(h, COUNT)) }),
  spawnAction({ id: 'spawns.treasureMeowth', label: 'Treasure Meowth', needs: TREASURE_NEEDS, leads: [...TREASURE_LEADS, 'Treasure.meowth'],
    apply: h => spawnTreasure(h, 'meowth', val(h, COUNT)) }),
  localSetting({ id: LEGEND_DEX, label: 'Rift boss legendary (dex number)', kind: 'slider', min: 1, max: LIMITS.speciesMax, step: 1, default: 377 }),
  localSetting({ id: LEGEND_SHINY, label: 'Rift boss shiny', kind: 'toggle', default: false }),
  spawnAction({ id: 'spawns.riftBoss', label: 'Rift boss on map', needs: [...SPECIES_NEEDS, 'World', 'Dex', 'Balance'], leads: SPECIES_LEADS,
    apply: h => spawnRiftBoss(h, clampInt(val(h, LEGEND_DEX), 1, LIMITS.speciesMax), !!val(h, LEGEND_SHINY)) }),
  spawnAction({ id: 'spawns.chest', label: 'Place chests nearby', needs: CHEST_NEEDS,
    apply: h => placeChests(h, PROP.types.chest, clampInt(val(h, COUNT), 1, LIMITS.chestMax)) }),
  spawnAction({ id: 'spawns.bigChest', label: 'Place big chests nearby', needs: CHEST_NEEDS,
    unknown: BIGCHEST_INSERT.state === 'verified' ? [] : ['bigchest insert untested'],
    apply: h => placeChests(h, PROP.types.bigchest, clampInt(val(h, COUNT), 1, LIMITS.chestMax)) }),
  spawnAction({ id: 'spawns.openRift', label: 'Open rift', needs: ['Game', 'Combat', 'Rift'],
    apply(h) { h.m.Rift[RIFT.keys.enterRequest](); return h.m.Rift[RIFT.keys.inArena] ? 'rift entered' : 'no rift entered (blocked)'; } }),
  localSetting({ id: RIFT_TYPE, label: 'Rift type', kind: 'select', options: ARENA_TYPES, default: ARENA_TYPES[0] }),
  spawnAction({ id: 'spawns.openRiftType', label: 'Open rift of chosen type', needs: ['Game', 'Combat', 'Rift'],
    apply(h) {
      const R = h.m.Rift, type = val(h, RIFT_TYPE);
      if (!ARENA_TYPES.includes(type)) throw new Error('unknown rift type');
      R[RIFT_LIVE.keys.debugNextType](type);
      R[RIFT.keys.enterRequest]();
      if (R[RIFT.keys.inArena]) return `${type} rift entered`;
      R[RIFT_LIVE.keys.debugNextType](null); // not entered, don't leave the type queued (game reads L = V as V || L)
      return 'no rift entered (blocked)';
    } }),
  // menu-side, only needs Gacha found + solo, not a live run
  localSetting({ id: GACHA_COUNT, label: 'Gacha forced shinies', kind: 'slider', min: 1, max: LIMITS.gachaMax, step: 1, default: 10 }),
  spawnAction({ id: 'spawns.gachaForceShiny', label: 'Gacha: force shiny', scope: 'menu', needs: ['Gacha', 'Coop'],
    apply(h) {
      const n = clampInt(val(h, GACHA_COUNT), 1, LIMITS.gachaMax);
      h.m.Gacha[GACHA.keys.forceShiny](n);
      h.scratch.gachaForced = true;
      return `next ${n} gacha results forced shiny`;
    },
    reset(h) {
      if (h.scratch.gachaForced && h.m.Gacha) h.m.Gacha[GACHA.keys.forceShiny](0);
      delete h.scratch.gachaForced;
    } }),
];

// --- features/automation.js





const RUI = RUNUI.keys;

const REWARD_MODES = ['off', 'first card', 'new moves first', 'upgrades first', 'stats first'];
const ITEM_MODES = ['off', 'always take', 'only into a free slot', 'always keep'];
const EVO_MODES = ['off', 'evolve', 'keep its look'];

const REWARD_ORDER = {
  'new moves first': [LEVELUP.types.new, LEVELUP.types.evo, LEVELUP.types.up, LEVELUP.types.stat],
  'upgrades first': [LEVELUP.types.evo, LEVELUP.types.up, LEVELUP.types.new, LEVELUP.types.stat],
  'stats first': [LEVELUP.types.stat, LEVELUP.types.evo, LEVELUP.types.up, LEVELUP.types.new],
};
const isForget = o => !o || o[LEVELUP.optionKey] === LEVELUP.forgetKey;
// -1 = nothing to pick; unknown types fall back to the first non-forget card
function chooseCard(options, mode) {
  if (!Array.isArray(options) || !options.length || mode === 'off') return -1;
  const order = REWARD_ORDER[mode];
  const first = options.findIndex(o => !isForget(o)); // -1 if only forget cards, player decides
  if (!order) return mode === 'first card' ? first : -1;
  for (const t of order) {
    const i = options.findIndex(o => !isForget(o) && o[LEVELUP.optionType] === t);
    if (i >= 0) return i;
  }
  return first;
}
// slot for callback(slot), -1 keeps the held item, null = do nothing
function chooseSlot(free, mode) {
  const f = Number.isInteger(free) && free >= 0 ? free : -1;
  if (mode === 'always take') return f >= 0 ? f : 0;
  if (mode === 'only into a free slot') return f >= 0 ? f : ITEMCHOICE.keep;
  if (mode === 'always keep') return ITEMCHOICE.keep;
  return null;
}

// pickEvo index: 0 = first evo/form, n = the trailing "Keep its look", -1 = do nothing
function chooseEvo(n, mode) {
  if (!Number.isInteger(n) || n < 0) return -1;
  if (mode === 'evolve') return n > 0 ? 0 : -1;
  if (mode === 'keep its look') return n;
  return -1;
}

// canAct is hardcoded to "playing", this takes the state so the level-up screens can use it too
function actReason(h, state) {
  try {
    if (h.dead) return 'uninstalled';
    const m = h.m, need = ['Game', 'Coop', 'Rift', 'Judgment', 'RunUI'].filter(n => !m[n]);
    if (need.length) return `not located: ${need.join(', ')}`;
    if (m.Coop[COOP.keys.active]) return 'co-op run';
    if (m.Game[GAME.keys.state] !== state) return `state is not ${state}`;
    if (!h.player || h.player[PLAYER.keys.dead]) return 'no live player';
    if (m.Rift[RIFT.keys.inArena]) return 'in rift arena';
    if (m.Judgment[JUDGMENT.keys.active]) return 'judgment active';
    return null;
  } catch (e) { return `guard threw: ${e && e.message}`; }
}

// pending = token of the newest screen, so a replaced screen never acts
function schedule(h, s, token, state, act) {
  s.pending = token;
  globalThis.setTimeout(() => {
    try {
      if (s.pending !== token) return;
      s.pending = null;
      if (s.opts.mode === 'off' || actReason(h, state) || !modded(h)) return;
      markPractice(h);
      act();
    } catch { /* never reach the game */ }
  }, AUTOMATION.pickDelayMs);
}

const AUTO_REWARDS = wrapFeature({
  id: 'automation.autoRewards', category: 'Automation', label: 'Auto rewards', kind: 'select', options: REWARD_MODES,
  needs: ['Game', 'Coop', 'Rift', 'Judgment', 'RunUI'], group: 'automation.rewards', defaults: { mode: 'off' }, name: 'mode',
  specs: (h, s) => [[h.m.RunUI, RUI.showLevelUp, orig => function (...args) {
    const out = Reflect.apply(orig, this, args);
    try {
      const opts = args[LEVELUP.optionsArg];
      if (s.opts.mode !== 'off' && !args[LEVELUP.waitingArg] && !actReason(h, LEVELUP.state) && modded(h) && chooseCard(opts, s.opts.mode) >= 0) {
        schedule(h, s, opts, LEVELUP.state, () => {
          const ui = h.m.RunUI;
          if (typeof ui[RUI.pick] !== 'function' || typeof ui[RUI.offering] !== 'function' || !ui[RUI.offering]()) return;
          const i = chooseCard(opts, s.opts.mode);
          if (i >= 0 && i < opts.length) ui[RUI.pick](i);
        });
      }
    } catch { /* never reach the game */ }
    return out;
  }]],
});

// both evo screens answer through pickEvo, key = field holding the choices
const evoSpec = (h, s, show, key) => [h.m.RunUI, show, orig => function (...args) {
  const out = Reflect.apply(orig, this, args);
  try {
    const data = args[EVOCHOICE.dataArg], list = data && data[key], n = Array.isArray(list) ? list.length : -1;
    if (s.opts.mode !== 'off' && !actReason(h, EVOCHOICE.state) && modded(h) && chooseEvo(n, s.opts.mode) >= 0) {
      schedule(h, s, args[EVOCHOICE.callbackArg], EVOCHOICE.state, () => {
        const ui = h.m.RunUI, i = chooseEvo(n, s.opts.mode);
        if (i >= 0 && typeof ui[RUI.pickEvo] === 'function') ui[RUI.pickEvo](i);
      });
    }
  } catch { /* never reach the game */ }
  return out;
}];
const AUTO_EVO = wrapFeature({
  id: 'automation.autoEvo', category: 'Automation', label: 'Auto evolution', kind: 'select', options: EVO_MODES,
  needs: ['Game', 'Coop', 'Rift', 'Judgment', 'RunUI'], group: 'automation.evo', defaults: { mode: 'off' }, name: 'mode',
  specs: (h, s) => [evoSpec(h, s, RUI.showEvo, EVOCHOICE.opts), evoSpec(h, s, RUI.showForm, EVOCHOICE.forms)],
});

function makeAutoItems(unknown) {
  return wrapFeature({
    id: 'automation.autoItems', category: 'Automation', label: 'Auto items', kind: 'select', options: ITEM_MODES, unknown,
    needs: ['Game', 'Coop', 'Rift', 'Judgment', 'RunUI', 'UI'], group: 'automation.items', defaults: { mode: 'off' }, name: 'mode',
    specs: (h, s) => [[h.m.RunUI, RUI.showItemChoice, orig => function (...args) {
      const out = Reflect.apply(orig, this, args);
      try {
        const cb = args[ITEMCHOICE.callbackArg], slot = () => chooseSlot(args[ITEMCHOICE.freeArg], s.opts.mode);
        if (s.opts.mode !== 'off' && typeof cb === 'function' && !actReason(h, ITEMCHOICE.state) && modded(h) && slot() !== null) {
          schedule(h, s, cb, ITEMCHOICE.state, () => {
            const v = slot();
            if (v !== null) { h.m.UI[ITEMCHOICE.uiHide](ITEMCHOICE.screenId); cb(v); } // same order as the card click
          });
        }
      } catch { /* never reach the game */ }
      return out;
    }]],
  });
}
const AUTO_ITEMS = makeAutoItems(ITEMCHOICE.closeScreen.state === 'verified' ? []
  : ['RunUI.showItemChoice screen close path (callback alone may leave the screen open)']);

const envOf = h => h.scratch.env || globalThis;

function bgInstall(h) {
  const env = envOf(h), doc = env.document, win = env.window, K = BROWSER.hiddenKeys;
  const proto = env.Document && env.Document.prototype;
  if (!doc || !win || !proto) throw new Error('window/document not available');
  const getters = {};
  for (const k of Object.values(K)) {
    const g = Object.getOwnPropertyDescriptor(proto, k);
    if (!g || typeof g.get !== 'function') throw new Error(`Document.prototype.${k} getter not found`);
    getters[k] = g.get;
  }
  const bg = { saved: {}, stored: null, timer: null, fake: 0, t: null };
  const realHidden = () => !!getters[K.hidden].call(doc);
  try {
    bg.wrapId = h.patcher.wrap(win, BROWSER.rafKey, orig => function (cb) {
      bg.stored = cb;
      // hidden: don't forward, queued real requests would multiply the loop on return
      if (realHidden()) return --bg.fake;
      return Reflect.apply(orig, this, [cb]);
    });
    for (const [k, v] of [[K.hidden, false], [K.visibilityState, BROWSER.visibleValue]]) {
      bg.saved[k] = Object.getOwnPropertyDescriptor(doc, k) || null; // normally absent on the instance
      Object.defineProperty(doc, k, { configurable: true, enumerable: false, get: () => v });
    }
    // hidden tabs get ~1 timer tick/s and the game clamps dt to 1/30, so one frame per tick ran ~30x slow
    // replay the elapsed time as fixed frameMs frames instead
    // TODO: backlog over maxCatchUpFrames is dropped, still falls behind under intensive throttling
    const blocked = () => actReason(h, h.m.Game && h.m.Game[GAME.keys.state]);
    bg.timer = env.setInterval(() => {
      try {
        if (!realHidden()) { bg.t = null; return; }
        if (!bg.stored || blocked() || !modded(h)) return;
        const now = env.performance.now(), step = BROWSER.frameMs;
        bg.t = bg.t === null ? now - step : Math.max(bg.t, now - step * BROWSER.maxCatchUpFrames);
        while (bg.stored && bg.t + step <= now && !blocked()) {
          const cb = bg.stored;
          bg.stored = null;
          bg.t += step;
          cb(bg.t);
        }
      } catch { /* keep the driver alive */ }
    }, BROWSER.driveMs);
  } catch (e) { h.scratch.bg = bg; bgRemove(h); throw e; }
  h.scratch.bg = bg;
}

function bgRemove(h) {
  const bg = h.scratch.bg;
  if (!bg) return;
  delete h.scratch.bg;
  const env = envOf(h);
  if (bg.timer !== null) env.clearInterval(bg.timer);
  for (const [k, d] of Object.entries(bg.saved)) {
    if (d) Object.defineProperty(env.document, k, d); else delete env.document[k];
  }
  if (bg.wrapId !== undefined) h.patcher.unwrap(bg.wrapId);
}

const BACKGROUND_RUN = defineFeature({
  id: 'automation.backgroundRun', category: 'Automation', label: 'Background run', kind: 'toggle', needs: [], scope: 'local', default: false,
  unknown: BROWSER.rafOwnership.state === 'verified' ? [] : ['rAF ownership unverified (window.requestAnimationFrame own/writable)'],
  apply: (h, on) => { if (on) { if (!h.scratch.bg) bgInstall(h); } else bgRemove(h); },
  reset: h => bgRemove(h),
});

const AUTOMATION_FEATURES = [AUTO_REWARDS, AUTO_ITEMS, AUTO_EVO, BACKGROUND_RUN];

// --- features.js






const FEATURES = [...STATS, ...POWERS, ...SPAWNS, ...LOCATOR, ...AUTOMATION_FEATURES];

// --- index.js







const INSTALLED = Symbol.for('ps.core.installed');

function install(objects, opts) {
  opts = opts || {};
  const host = opts.host || globalThis;
  if (host[INSTALLED]) return host[INSTALLED];
  if (!Array.isArray(objects)) throw new Error('install: objects must be an array (queryObjects result)');

  const seen = readBuild(opts.doc !== undefined ? opts.doc : host.document);
  const state = seen === null ? 'unknown' : seen === BUILD ? 'match' : 'mismatch';
  const gate = state === 'match' || opts.allowUnverified === true ? null
    : state === 'unknown' ? 'build unknown' : `unverified build ${seen}`;

  const r = findModules(objects, MODULES);
  const patcher = createPatcher();
  const h = {
    m: r.found, missing: r.missing, ambiguous: r.ambiguous, truncated: r.truncated,
    player: null, dead: false, gate, allowLeads: opts.allowLeads === true, build: { seen, state }, scratch: {}, patcher,
    capture: { state: 'not installed', error: null }, tickArg: TICK_PLAYER_ARG, onPlayer: null,
  };

  let api;
  // used by uninstall and failed setup alike
  function cleanup() {
    if (h.dead) return { restored: 0, left: [], failed: [] };
    h.dead = true;
    if (api) api.resetAll();
    const res = patcher.restoreAll();
    h.player = null;
    try { if (host[INSTALLED] === api) delete host[INSTALLED]; } catch { /* ignore */ }
    return res;
  }

  try {
    api = createApi({ h, features: FEATURES, cleanup, expectedBuild: BUILD, captureLeads: [] });
    if (gate) h.capture.state = `skipped: ${gate}`;
    else if (!h.m.Combat || !h.m.Game) h.capture.state = 'skipped: Game or Combat not located';
    else installCapture(h, patcher); // failure lands in h.capture, rollback is inside
    Object.defineProperty(host, INSTALLED, { value: api, configurable: true, enumerable: false, writable: false });
  } catch (e) {
    cleanup();
    throw e;
  }
  return api;
}

// --- model.js
// panel logic, no dom. same bundle scope as core so top-level names get a ui prefix

const UI_TABS = ['Stats', 'Powers', 'Spawns', 'Automation', 'Locator', 'Presets'];
const UI_NOT_PORTED_REASON = 'not ported yet';
// planned features with no core feature yet, shown as disabled rows
const UI_NOT_PORTED = {};
// scope 'local' = panel-side input that feeds actions, shown under Options
const uiIsLocal = f => f.scope === 'local';

// one entry per tab, plus 'Other' only if a category is not in the layout
function uiGroupTabs(features) {
  const names = [...UI_TABS];
  for (const f of features) if (!names.includes(f.category)) names.push(f.category);
  return names.map(name => {
    const mine = features.filter(f => f.category === name);
    const sections = [
      ['Settings', mine.filter(f => f.kind !== 'action' && !uiIsLocal(f))],
      ['Options', mine.filter(uiIsLocal)],
      ['Actions', mine.filter(f => f.kind === 'action')],
    ].filter(s => s[1].length).map(([title, rows]) => ({ title, rows }));
    return { name, sections, pending: UI_NOT_PORTED[name] || [] };
  });
}

function uiDecimals(step) {
  const s = String(step);
  const e = s.match(/e-(\d+)$/);
  if (e) return Number(e[1]);
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
}

function uiFormatValue(f) {
  if (f.kind === 'toggle') return f.value ? 'On' : 'Off';
  if (f.kind === 'slider') return Number.isFinite(f.value) ? f.value.toFixed(uiDecimals(f.step)) : '';
  if (f.kind === 'select') return String(f.value);
  return '';
}

// same as core clampValue; null = not a number
function uiClampSlider(f, v) {
  const n = Number(v);
  if (v === '' || v === null || !Number.isFinite(n)) return null;
  let r = Math.min(f.max, Math.max(f.min, n));
  if (f.step > 0) r = Math.min(f.max, f.min + Math.round((r - f.min) / f.step) * f.step);
  return Number(r.toFixed(6));
}

// status -> header chips, tone: ok | warn | idle
function uiStatusChips(st) {
  if (!st) return [];
  const b = st.build || {};
  const chips = [];
  if (b.state === 'match') chips.push({ id: 'build', text: 'Build matches', tone: 'ok', title: `Build ${b.seen}` });
  else if (b.state === 'mismatch') chips.push({ id: 'build', text: 'Build mismatch', tone: 'warn', title: `Seen ${b.seen}, expected ${b.expected}` });
  else chips.push({ id: 'build', text: 'Build unknown', tone: 'warn', title: `Expected ${b.expected}` });
  const cap = (st.capture && st.capture.state) || '';
  const got = !!(st.player && st.player.captured);
  chips.push({ id: 'player', text: got ? 'Player found' : 'No player yet', tone: got ? 'ok' : 'idle', title: cap ? `Capture: ${cap}` : '' });
  const n = Number.isFinite(st.patches) ? st.patches : 0;
  chips.push({ id: 'patches', text: n === 1 ? '1 patch' : `${n} patches`, tone: 'idle', title: 'Game functions currently wrapped' });
  const miss = (st.modules && st.modules.missing) || [];
  if (miss.length) chips.push({ id: 'modules', text: `${miss.length} modules missing`, tone: 'warn', title: miss.join(', ') });
  return chips;
}

// set/reset result -> {tone, text}, null if nothing to say
function uiResultNote(r) {
  if (!r) return { tone: 'error', text: 'No result' };
  if (!r.ok) return { tone: 'error', text: r.error || 'Failed' };
  return r.info ? { tone: 'ok', text: String(r.info) } : null;
}

function uiIsHotkey(e, key = 'F2') {
  return !!e && e.key === key && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && !e.repeat;
}

// keep `grab` px of the header on screen so it can be dragged back
function uiClampPos(p, vw, vh, w, grab = 48) {
  const x = Math.min(Math.max(Number.isFinite(p.x) ? p.x : 16, grab - w), Math.max(grab - w, vw - grab));
  const y = Math.min(Math.max(Number.isFinite(p.y) ? p.y : 16, 0), Math.max(0, vh - 32));
  return { x, y };
}

const UI_PREFIX = 'ps.ui.';
function uiLoadPrefs(storage) {
  const get = k => { try { return storage.getItem(UI_PREFIX + k); } catch { return null; } };
  let pos = null;
  try { pos = JSON.parse(get('pos')); } catch { /* ignore */ }
  return {
    pos: pos && Number.isFinite(pos.x) && Number.isFinite(pos.y) ? { x: pos.x, y: pos.y } : null,
    open: get('open') !== '0',
    collapsed: get('collapsed') === '1',
    tab: UI_TABS.includes(get('tab')) ? get('tab') : UI_TABS[0],
  };
}
function uiSavePref(storage, key, value) {
  try { storage.setItem(UI_PREFIX + key, typeof value === 'string' ? value : JSON.stringify(value)); } catch { /* storage blocked */ }
}

// game state -> overlay label, null for playing / menu / unknown
function uiGameOverlay(state) {
  if (state === 'paused') return 'Game paused';
  if (state === 'levelup' || state === 'choice') return 'Game paused \u00b7 level-up';
  if (state === 'over') return 'Run over';
  return null;
}

// store shape: {version:1, presets:{name:{savedAt, values:{id:value}}}}
const UI_PRESETS_KEY = 'presets';
const UI_PRESET_MAX = 40;

function uiPresetName(raw) {
  const name = typeof raw === 'string' ? raw.trim() : '';
  if (!name) return { ok: false, error: 'Enter a name' };
  if (name.length > UI_PRESET_MAX) return { ok: false, error: `Name is longer than ${UI_PRESET_MAX} characters` };
  return { ok: true, name };
}

// {id: value} for every non-action feature
function uiPresetCollect(features) {
  const values = {};
  for (const f of features) if (f.kind !== 'action') values[f.id] = f.value;
  return values;
}

const uiPresetEmpty = () => ({ version: 1, presets: {} });

function uiPresetSave(store, name, values, now) {
  return { version: 1, presets: { ...store.presets, [name]: { savedAt: now, values: { ...values } } } };
}
function uiPresetDelete(store, name) {
  const presets = { ...store.presets };
  delete presets[name];
  return { version: 1, presets };
}
const uiPresetSerialize = store => JSON.stringify(store);

const uiPlain = o => o !== null && typeof o === 'object' && !Array.isArray(o);
// raw localStorage text or null, never throws: {ok:true, store} | {ok:false, error}
function uiPresetParse(text) {
  if (text === null || text === undefined || text === '') return { ok: true, store: uiPresetEmpty() };
  let d;
  try { d = JSON.parse(text); } catch { return { ok: false, error: 'Saved presets are corrupt (not valid JSON)' }; }
  if (!uiPlain(d) || d.version !== 1 || !uiPlain(d.presets)) return { ok: false, error: 'Saved presets are corrupt (unexpected format)' };
  const presets = {};
  for (const [name, p] of Object.entries(d.presets)) {
    if (!uiPresetName(name).ok || name !== name.trim() || !uiPlain(p) || !Number.isFinite(p.savedAt) || !uiPlain(p.values)) return { ok: false, error: `Saved presets are corrupt (preset "${name.slice(0, 40)}")` };
    const values = {};
    for (const [id, v] of Object.entries(p.values)) {
      if (typeof v !== 'boolean' && typeof v !== 'string' && !(typeof v === 'number' && Number.isFinite(v))) return { ok: false, error: `Saved presets are corrupt (value "${id}")` };
      values[id] = v;
    }
    presets[name] = { savedAt: p.savedAt, values };
  }
  return { ok: true, store: { version: 1, presets } };
}

// returns {ops:[{id, op:'reset'|'set', value}], unknown:[id]}; actions and ids core dropped count as unknown
function uiPresetPlan(values, features, defaults) {
  const byId = new Map(features.map(f => [f.id, f]));
  const ops = [], unknown = [];
  for (const [id, value] of Object.entries(values)) {
    const f = byId.get(id);
    if (!f || f.kind === 'action') { unknown.push(id); continue; }
    ops.push({ id, op: id in defaults && defaults[id] === value ? 'reset' : 'set', value });
  }
  return { ops, unknown };
}

function uiPresetSummary(results, unknown = []) {
  const bad = results.filter(r => !r.ok);
  const reasons = [...new Set(bad.map(r => r.error || 'failed'))];
  let text = `Applied ${results.length - bad.length}`;
  if (bad.length) text += `, skipped ${bad.length} (${reasons.join('; ')})`;
  if (unknown.length) text += `${bad.length ? '; ' : ', '}${unknown.length} unknown ignored`;
  if (reasons.includes('no run in progress')) text += '. Load it during a run to apply the rest';
  return { tone: bad.length || unknown.length ? 'warn' : 'ok', text };
}

// --- panel.js


// dom layer over core's api: state from list/get/status, actions through set/reset
const UI_KEY = Symbol.for('ps.ui.mounted');
const UI_WIDTH = 344;
const UI_NOTE_MS = 5000;
const UI_LIVE_MS = 500;
const UI_ISOLATED = ['keydown', 'keyup', 'keypress', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'wheel', 'touchstart'];

const UI_CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.panel { position: fixed; z-index: 2147483000; width: ${UI_WIDTH}px; max-width: calc(100vw - 16px); display: flex; flex-direction: column;
  background: #141a26; color: #e8ecf6; border: 1px solid #2f3a55; border-radius: 10px; box-shadow: 0 12px 40px rgba(0,0,0,.55);
  font: 13px/1.4 "Segoe UI Variable Text","Segoe UI",system-ui,sans-serif; overflow: hidden; }
.panel[hidden] { display: none; }
button, input { font: inherit; color: inherit; }
button { cursor: pointer; }
button:disabled, input:disabled { cursor: not-allowed; }
:focus-visible { outline: 2px solid #8fd3ff; outline-offset: 2px; }
.head { display: flex; align-items: center; gap: 8px; padding: 9px 10px 9px 14px; background: #1b2336; cursor: grab; user-select: none; touch-action: none; }
.head.drag { cursor: grabbing; }
.title { flex: 1; font-weight: 650; font-size: 14px; letter-spacing: .02em; }
.hint { color: #9aa6bf; font-size: 12px; }
.ibtn { width: 26px; height: 26px; border: 1px solid transparent; border-radius: 6px; background: transparent; display: grid; place-items: center; color: #c5cee2; }
.ibtn:hover { background: #26304a; border-color: #37446a; }
.strip { display: flex; flex-wrap: wrap; gap: 4px 12px; padding: 8px 14px; border-bottom: 1px solid #263048; background: #111724; }
.chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #c5cee2; }
.chip i { width: 8px; height: 8px; border-radius: 50%; background: #7d8aa6; flex: none; }
.chip.ok i { background: #4fd1b0; box-shadow: 0 0 6px #4fd1b088; }
.chip.warn i { background: #f0b64a; }
.tabs { display: flex; padding: 0 4px; border-bottom: 1px solid #263048; overflow-x: auto; scrollbar-width: none; }
.tab { flex: 1 0 auto; white-space: nowrap; padding: 9px 5px 8px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #9aa6bf; font-size: 12px; }
.tab:hover { color: #e8ecf6; }
.tab[aria-selected="true"] { color: #fff; border-bottom-color: #4fd1b0; font-weight: 600; }
.body { overflow-y: auto; max-height: min(58vh, 480px); padding: 6px 14px 10px; scrollbar-width: thin; scrollbar-color: #37446a transparent; }
.sect { margin: 12px 0 2px; font-size: 12px; color: #9aa6bf; display: flex; align-items: center; gap: 8px; }
.sect::after { content: ""; flex: 1; height: 1px; background: #263048; }
.row { padding: 7px 0; border-bottom: 1px solid #1d2638; }
.row:last-child { border-bottom: 0; }
.line { display: flex; align-items: center; gap: 10px; min-height: 26px; }
.name { flex: 1; min-width: 0; }
.val { font-variant-numeric: tabular-nums; color: #4fd1b0; min-width: 3.5ch; text-align: right; }
.note { font-size: 12px; margin-top: 3px; color: #9aa6bf; overflow-wrap: anywhere; }
.note:empty { display: none; }
.note.error { color: #ff9a9a; }
.note.ok { color: #7fe0c6; }
.switch { position: relative; flex: none; width: 40px; height: 22px; }
.switch input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: inherit; }
.track { position: absolute; inset: 0; border-radius: 11px; background: #2c3750; border: 1px solid #44527a; transition: background .12s; pointer-events: none; }
.thumb { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; border: 1.5px solid #0e1320;
  background: radial-gradient(circle, #0e1320 0 2px, #f4f6fb 2.5px 3.5px, transparent 4px), linear-gradient(#ee5a5a 0 46%, #0e1320 46% 54%, #f4f6fb 54%);
  transition: transform .12s; }
.switch input:checked ~ .track { background: #1d6b5c; border-color: #4fd1b0; }
.switch input:checked ~ .thumb { transform: translateX(18px); }
.switch input:focus-visible ~ .track { outline: 2px solid #8fd3ff; outline-offset: 2px; }
.switch input:disabled ~ .track, .switch input:disabled ~ .thumb { opacity: .5; }
input[type=range] { width: 100%; margin: 4px 0 0; accent-color: #4fd1b0; }
input[type=number] { width: 84px; padding: 4px 6px; background: #0f1522; border: 1px solid #44527a; border-radius: 6px; text-align: right; font-variant-numeric: tabular-nums; }
.btn { padding: 6px 12px; background: #243049; border: 1px solid #44527a; border-radius: 7px; color: #e8ecf6; }
.btn:hover:not(:disabled) { background: #2d3b5c; border-color: #6a7cae; }
.btn:disabled { opacity: .5; }
.act { width: 100%; text-align: left; }
.sm { padding: 2px 8px; font-size: 12px; }
.foot { display: flex; gap: 8px; align-items: center; padding: 9px 14px; border-top: 1px solid #263048; background: #111724; }
.foot .note { flex: 1; margin: 0; }
.danger.armed { background: #5a2330; border-color: #ff8f8f; }
.main { position: relative; }
.veil { position: absolute; inset: 0; z-index: 2; display: grid; place-items: center; background: rgba(10,14,24,.72); cursor: not-allowed; }
.veil[hidden] { display: none; }
.veil span { padding: 6px 14px; border: 1px solid #f0b64a; border-radius: 8px; background: #141a26; color: #ffe3a6; font-weight: 600; }
.main.veiled .tabs, .main.veiled .body { opacity: .45; }
.field { flex: 1; min-width: 0; padding: 5px 8px; background: #0f1522; border: 1px solid #44527a; border-radius: 6px; }
.pname { font-weight: 600; overflow-wrap: anywhere; }
.pmeta { font-size: 12px; color: #9aa6bf; }
.pbtns { display: flex; gap: 6px; margin-top: 6px; }
.empty { padding: 10px 0; color: #9aa6bf; }
.note.warn { color: #f0c46a; }
.btn.armed { background: #5a2330; border-color: #ff8f8f; }
.panel.collapsed .strip, .panel.collapsed .main, .panel.collapsed .foot { display: none; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

function uiEl(doc, tag, props, ...kids) {
  const e = doc.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v);
  }
  for (const c of kids) if (c) e.append(c);
  return e;
}

function uiShowNote(noteEl, note, ms = UI_NOTE_MS) {
  clearTimeout(noteEl._t);
  noteEl.className = note ? `note ${note.tone}` : 'note';
  noteEl.textContent = note ? note.text : '';
  if (note) noteEl._t = setTimeout(() => { noteEl.textContent = ''; noteEl.className = 'note'; }, ms);
}

// returns {el, update(view)}; pending rows pass {pending:true}
function uiMakeRow(doc, api, f, afterChange) {
  const id = f.id;
  const row = uiEl(doc, 'div', { class: 'row' });
  const note = uiEl(doc, 'div', { class: 'note', role: 'status' });
  const why = uiEl(doc, 'div', { class: 'note' });
  const run = r => Promise.resolve(r).then(res => { uiShowNote(note, uiResultNote(res)); afterChange(); return res; });
  const view = () => api.get(id);
  let update, liveTimer = null;

  if (f.pending || f.kind === 'toggle') {
    const input = uiEl(doc, 'input', { type: 'checkbox', role: 'switch', 'aria-label': f.label });
    const sw = uiEl(doc, 'span', { class: 'switch' }, input, uiEl(doc, 'span', { class: 'track' }), uiEl(doc, 'span', { class: 'thumb' }));
    row.append(uiEl(doc, 'label', { class: 'line' }, uiEl(doc, 'span', { class: 'name', text: f.label }), sw));
    if (f.pending) { input.disabled = true; why.textContent = UI_NOT_PORTED_REASON; }
    else input.addEventListener('change', () => run(input.checked ? api.set(id, true) : api.reset(id)));
    update = v => { input.checked = !!v.value; input.disabled = !v.enabled; why.textContent = v.reason || ''; };
  } else if (f.kind === 'slider' && uiIsLocal(f)) {
    const input = uiEl(doc, 'input', { type: 'number', min: f.min, max: f.max, step: f.step, 'aria-label': f.label });
    row.append(uiEl(doc, 'label', { class: 'line' }, uiEl(doc, 'span', { class: 'name', text: f.label }), input));
    input.addEventListener('change', () => {
      const n = uiClampSlider(view(), input.value);
      if (n === null) { update(view()); return; }
      run(api.set(id, n));
    });
    update = v => { if (input.getRootNode().activeElement !== input) input.value = v.value; input.disabled = !v.enabled; why.textContent = v.reason || ''; };
  } else if (f.kind === 'slider') {
    const out = uiEl(doc, 'output', { class: 'val' });
    const input = uiEl(doc, 'input', { type: 'range', min: f.min, max: f.max, step: f.step, 'aria-label': f.label });
    const reset = uiEl(doc, 'button', { class: 'btn sm', type: 'button', 'aria-label': `Reset ${f.label} to default`, text: 'Reset' });
    let dragging = false;
    row.append(uiEl(doc, 'div', { class: 'line' }, uiEl(doc, 'span', { class: 'name', text: f.label }), out, reset), input);
    input.addEventListener('input', () => { dragging = true; out.textContent = uiFormatValue({ ...view(), value: Number(input.value) }); });
    input.addEventListener('change', () => { // apply on release
      dragging = false;
      const n = uiClampSlider(view(), input.value);
      if (n === null) { update(view()); return; }
      run(api.set(id, n));
    });
    reset.addEventListener('click', () => run(api.reset(id)));
    update = v => { if (!dragging) { input.value = v.value; out.textContent = uiFormatValue(v); } input.disabled = reset.disabled = !v.enabled; why.textContent = v.reason || ''; };
  } else if (f.kind === 'select') {
    const sel = uiEl(doc, 'select', { 'aria-label': f.label });
    for (const o of f.options) sel.append(uiEl(doc, 'option', { value: String(o), text: String(o) }));
    row.append(uiEl(doc, 'label', { class: 'line' }, uiEl(doc, 'span', { class: 'name', text: f.label }), sel));
    sel.addEventListener('change', () => run(api.set(id, f.options.find(o => String(o) === sel.value))));
    update = v => { sel.value = String(v.value); sel.disabled = !v.enabled; why.textContent = v.reason || ''; };
  } else {
    const btn = uiEl(doc, 'button', { class: 'btn act', type: 'button', text: f.label });
    row.append(btn);
    btn.addEventListener('click', () => {
      btn.disabled = true;
      run(api.set(id)).then(() => update(view()), () => update(view()));
    });
    update = v => { btn.disabled = !v.enabled; why.textContent = v.reason || ''; };
    if (f.live) { // re-run the readout every UI_LIVE_MS, note outlives one period so it does not blink
      const input = uiEl(doc, 'input', { type: 'checkbox', role: 'switch', 'aria-label': `Live ${f.label}` });
      const sw = uiEl(doc, 'span', { class: 'switch' }, input, uiEl(doc, 'span', { class: 'track' }), uiEl(doc, 'span', { class: 'thumb' }));
      row.append(uiEl(doc, 'label', { class: 'line' }, uiEl(doc, 'span', { class: 'name', text: 'Live' }), sw));
      const tick = () => Promise.resolve(api.set(id)).then(res => uiShowNote(note, uiResultNote(res), UI_LIVE_MS * 4));
      input.addEventListener('change', () => {
        clearInterval(liveTimer); liveTimer = null;
        if (input.checked) { tick(); liveTimer = setInterval(tick, UI_LIVE_MS); }
      });
      const plain = update;
      update = v => { plain(v); input.disabled = !v.enabled; if (!v.enabled && input.checked) { input.checked = false; clearInterval(liveTimer); liveTimer = null; } };
    }
  }
  row.append(why, note);
  update(f.pending ? { ...f, enabled: false, reason: UI_NOT_PORTED_REASON } : f);
  return { el: row, update: f.pending ? () => {} : update, stop: () => clearInterval(liveTimer) };
}

function uiBuild(api, host, doc) {
  const win = doc.defaultView || globalThis;
  const store = (() => { try { return win.localStorage; } catch { return null; } })() || { getItem: () => null, setItem: () => {} };
  const prefs = uiLoadPrefs(store);
  const rootEl = doc.createElement('div');
  rootEl.id = 'ps-mod-panel';
  const shadow = rootEl.attachShadow({ mode: 'open' });
  shadow.append(uiEl(doc, 'style', { text: UI_CSS }));

  const panel = uiEl(doc, 'section', { class: 'panel', role: 'region', 'aria-label': 'IVO-mod panel' });
  const collapseBtn = uiEl(doc, 'button', { class: 'ibtn', type: 'button', 'aria-label': 'Minimise', 'aria-expanded': 'true', text: '\u2014' });
  const closeBtn = uiEl(doc, 'button', { class: 'ibtn', type: 'button', 'aria-label': 'Close', title: 'Close (F2 shows it again)', text: 'X' });
  const head = uiEl(doc, 'div', { class: 'head' }, uiEl(doc, 'span', { class: 'title', text: 'IVO-mod' }), uiEl(doc, 'span', { class: 'hint', text: 'F2' }), collapseBtn, closeBtn);
  const strip = uiEl(doc, 'div', { class: 'strip', role: 'status', 'aria-label': 'Connection status' });
  const tabsEl = uiEl(doc, 'div', { class: 'tabs', role: 'tablist', 'aria-label': 'Categories' });
  const body = uiEl(doc, 'div', { class: 'body', role: 'tabpanel', tabindex: '0' });
  const footNote = uiEl(doc, 'div', { class: 'note', role: 'status' });
  const resetBtn = uiEl(doc, 'button', { class: 'btn', type: 'button', text: 'Reset all' });
  const discBtn = uiEl(doc, 'button', { class: 'btn danger', type: 'button', text: 'Disconnect' });
  const foot = uiEl(doc, 'div', { class: 'foot' }, resetBtn, discBtn, footNote);
  const veilLabel = uiEl(doc, 'span', { role: 'status' });
  const veil = uiEl(doc, 'div', { class: 'veil' }, veilLabel);
  veil.hidden = true;
  const main = uiEl(doc, 'div', { class: 'main' }, tabsEl, body, veil);
  panel.append(head, strip, main, foot);
  shadow.append(panel);

  // keep panel input away from the game
  for (const t of UI_ISOLATED) shadow.addEventListener(t, e => e.stopPropagation());

  let rows = [];
  let tab = prefs.tab;
  let groups = [];
  const tabButtons = new Map();

  const refresh = () => {
    strip.textContent = '';
    for (const c of uiStatusChips(api.status())) strip.append(uiEl(doc, 'span', { class: `chip ${c.tone}`, title: c.title }, uiEl(doc, 'i', {}), uiEl(doc, 'span', { text: c.text })));
    for (const r of rows) { const v = api.get(r.id); if (v) r.update(v); }
  };

  function renderTab() {
    body.textContent = '';
    for (const r of rows) r.stop();
    rows = [];
    const g = groups.find(x => x.name === tab) || groups[0];
    body.setAttribute('aria-label', g.name);
    if (g.name === 'Presets') renderPresets();
    else for (const s of g.sections) {
      if (g.sections.length > 1) body.append(uiEl(doc, 'div', { class: 'sect', text: s.title }));
      for (const f of s.rows) { const r = uiMakeRow(doc, api, f, refresh); r.id = f.id; rows.push(r); body.append(r.el); }
    }
    if (g.name !== 'Presets' && g.pending.length) {
      for (const label of g.pending) body.append(uiMakeRow(doc, api, { id: `pending.${label}`, label, kind: 'toggle', pending: true }, refresh).el);
    }
    for (const [n, b] of tabButtons) { b.setAttribute('aria-selected', String(n === g.name)); b.tabIndex = n === g.name ? 0 : -1; }
    refresh();
  }

  const defaults = Object.fromEntries(api.list().filter(f => f.kind !== 'action').map(f => [f.id, f.default]));
  const readPresets = () => { let t = null; try { t = store.getItem(UI_PREFIX + UI_PRESETS_KEY); } catch { /* blocked */ } return uiPresetParse(t); };
  const writePresets = st => { try { store.setItem(UI_PREFIX + UI_PRESETS_KEY, uiPresetSerialize(st)); return true; } catch { return false; } };
  let armedBtn = null, armedLabel = '', armedTimer = null, flash = null;
  const disarmBtn = () => { clearTimeout(armedTimer); if (armedBtn) { armedBtn.classList.remove('armed'); armedBtn.textContent = armedLabel; } armedBtn = null; };
  // two-click confirm, 2nd click within 4 s runs fn; needs() false runs it at once
  const confirmClick = (btn, label, armText, fn, needs = () => true) => {
    btn.addEventListener('click', () => {
      if (armedBtn === btn || !needs()) { disarmBtn(); fn(); return; }
      disarmBtn(); armedBtn = btn; armedLabel = label; btn.classList.add('armed'); btn.textContent = armText;
      armedTimer = setTimeout(disarmBtn, 4000);
    });
  };

  function renderPresets() {
    disarmBtn();
    const parsed = readPresets();
    const note = uiEl(doc, 'div', { class: 'note', role: 'status' });
    const input = uiEl(doc, 'input', { type: 'text', class: 'field', 'aria-label': 'Preset name', placeholder: 'Preset name', autocomplete: 'off' });
    if (flash) { uiShowNote(note, flash); flash = null; }
    const saveBtn = uiEl(doc, 'button', { class: 'btn', type: 'button', text: 'Save' });
    body.append(uiEl(doc, 'div', { class: 'sect', text: 'Save current values' }), uiEl(doc, 'div', { class: 'line' }, input, saveBtn), note);
    const save = (name, where) => {
      const next = uiPresetSave(parsed.store, name, uiPresetCollect(api.list()), Date.now());
      if (!writePresets(next)) { uiShowNote(where, { tone: 'error', text: 'Could not write to browser storage' }); return; }
      flash = { tone: 'ok', text: `Saved "${name}"` };
      renderTab();
    };
    confirmClick(saveBtn, 'Save', 'Overwrite?', () => {
      const n = uiPresetName(input.value);
      if (n.ok) save(n.name, note); else uiShowNote(note, { tone: 'error', text: n.error });
    }, () => { const n = uiPresetName(input.value); return n.ok && n.name in parsed.store.presets; });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') saveBtn.click(); });
    body.append(uiEl(doc, 'div', { class: 'sect', text: 'Saved presets' }));
    if (!parsed.ok) {
      const clear = uiEl(doc, 'button', { class: 'btn danger', type: 'button', text: 'Clear saved presets' });
      confirmClick(clear, 'Clear saved presets', 'Confirm clear', () => { writePresets(uiPresetParse(null).store); renderTab(); });
      body.append(uiEl(doc, 'div', { class: 'note error', role: 'alert', text: parsed.error }), clear);
      saveBtn.disabled = input.disabled = true;
      return;
    }
    const names = Object.keys(parsed.store.presets).sort((a, b) => a.localeCompare(b));
    if (!names.length) body.append(uiEl(doc, 'div', { class: 'empty', text: 'No presets yet. Type a name above and save the current values.' }));
    for (const name of names) {
      const p = parsed.store.presets[name];
      const load = uiEl(doc, 'button', { class: 'btn sm', type: 'button', 'aria-label': `Load preset ${name}`, text: 'Load' });
      const over = uiEl(doc, 'button', { class: 'btn sm', type: 'button', 'aria-label': `Overwrite preset ${name} with current values`, text: 'Overwrite' });
      const del = uiEl(doc, 'button', { class: 'btn sm', type: 'button', 'aria-label': `Delete preset ${name}`, text: 'Delete' });
      const rnote = uiEl(doc, 'div', { class: 'note', role: 'status' });
      load.addEventListener('click', () => {
        const plan = uiPresetPlan(p.values, api.list(), defaults);
        const run = o => o.op === 'reset' ? api.reset(o.id) : api.set(o.id, o.value);
        const one = o => Promise.resolve(run(o)).then(r => ({ id: o.id, ok: !!(r && r.ok), error: r && r.error }), e => ({ id: o.id, ok: false, error: String((e && e.message) || e) }));
        Promise.all(plan.ops.map(one)).then(res => { refresh(); uiShowNote(rnote, uiPresetSummary(res, plan.unknown), 12000); });
      });
      confirmClick(over, 'Overwrite', 'Confirm', () => save(name, rnote));
      confirmClick(del, 'Delete', 'Confirm delete', () => { writePresets(uiPresetDelete(parsed.store, name)); renderTab(); });
      body.append(uiEl(doc, 'div', { class: 'row' }, uiEl(doc, 'div', { class: 'pname', text: name }),
        uiEl(doc, 'div', { class: 'pmeta', text: `${Object.keys(p.values).length} values, saved ${new Date(p.savedAt).toLocaleString()}` }), uiEl(doc, 'div', { class: 'pbtns' }, load, over, del), rnote));
    }
  }

  function buildTabs() {
    groups = uiGroupTabs(api.list()).filter(g => UI_TABS.includes(g.name) || g.sections.length);
    if (!groups.some(g => g.name === tab)) tab = groups[0].name;
    tabsEl.textContent = '';
    tabButtons.clear();
    for (const g of groups) {
      const b = uiEl(doc, 'button', { class: 'tab', type: 'button', role: 'tab', text: g.name });
      b.addEventListener('click', () => { tab = g.name; uiSavePref(store, 'tab', tab); renderTab(); });
      b.addEventListener('keydown', e => {
        const i = groups.findIndex(x => x.name === tab), d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        tab = groups[(i + d + groups.length) % groups.length].name;
        uiSavePref(store, 'tab', tab); renderTab(); tabButtons.get(tab).focus();
      });
      tabButtons.set(g.name, b);
      tabsEl.append(b);
    }
  }

  const place = p => { const q = uiClampPos(p, win.innerWidth, win.innerHeight, UI_WIDTH); panel.style.left = `${q.x}px`; panel.style.top = `${q.y}px`; return q; };
  let pos = place(prefs.pos || { x: win.innerWidth - UI_WIDTH - 16, y: 16 });
  const setCollapsed = c => { panel.classList.toggle('collapsed', c); collapseBtn.setAttribute('aria-expanded', String(!c)); collapseBtn.setAttribute('aria-label', c ? 'Restore' : 'Minimise'); uiSavePref(store, 'collapsed', c ? '1' : '0'); };
  const setOpen = o => { panel.hidden = !o; uiSavePref(store, 'open', o ? '1' : '0'); };
  setCollapsed(prefs.collapsed);
  setOpen(prefs.open);
  collapseBtn.addEventListener('click', () => setCollapsed(!panel.classList.contains('collapsed')));
  closeBtn.addEventListener('click', () => setOpen(false));

  head.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('button')) return;
    const dx = e.clientX - pos.x, dy = e.clientY - pos.y;
    head.classList.add('drag');
    head.setPointerCapture(e.pointerId);
    const move = ev => { pos = place({ x: ev.clientX - dx, y: ev.clientY - dy }); };
    const up = () => { head.classList.remove('drag'); head.removeEventListener('pointermove', move); head.removeEventListener('pointerup', up); head.removeEventListener('pointercancel', up); uiSavePref(store, 'pos', pos); };
    head.addEventListener('pointermove', move); head.addEventListener('pointerup', up); head.addEventListener('pointercancel', up);
  });

  let armTimer = null;
  const disarm = () => { clearTimeout(armTimer); discBtn.classList.remove('armed'); discBtn.textContent = 'Disconnect'; };
  resetBtn.addEventListener('click', () => {
    const bad = api.resetAll().filter(([, r]) => !r.ok);
    uiShowNote(footNote, bad.length ? { tone: 'error', text: `${bad.length} could not reset: ${bad[0][1].error}` } : { tone: 'ok', text: 'All features reset' });
    refresh();
  });
  discBtn.addEventListener('click', () => {
    if (!discBtn.classList.contains('armed')) {
      discBtn.classList.add('armed'); discBtn.textContent = 'Confirm disconnect';
      armTimer = setTimeout(disarm, 4000);
      return;
    }
    disarm();
    api.uninstall();
    ui.destroy();
  });

  // on window (capture) so the hotkey works while hidden
  const onKey = e => { if (uiIsHotkey(e)) { e.preventDefault(); e.stopPropagation(); setOpen(panel.hidden); } };
  const onResize = () => { pos = place(pos); };
  win.addEventListener('keydown', onKey, true);
  win.addEventListener('resize', onResize);

  const unsub = api.subscribe(() => {
    if (!api.status().installed) { ui.destroy(); return; }
    refresh();
  });

  // poll game state, dim the body while paused / level-up / game over
  let veilText = null;
  const pollState = () => {
    let label = null;
    try { label = uiGameOverlay(api.status().game.state); } catch { /* status unavailable: no overlay */ }
    if (label === veilText) return;
    veilText = label;
    veil.hidden = !label;
    veilLabel.textContent = label || '';
    main.classList.toggle('veiled', !!label);
    for (const e of [tabsEl, body]) { if (label) e.setAttribute('inert', ''); else e.removeAttribute('inert'); }
  };
  const pollTimer = setInterval(pollState, 500);

  const ui = {
    api, el: rootEl,
    destroy() {
      unsub();
      for (const r of rows) r.stop();
      clearInterval(pollTimer);
      clearTimeout(armedTimer);
      clearTimeout(armTimer);
      win.removeEventListener('keydown', onKey, true);
      win.removeEventListener('resize', onResize);
      rootEl.remove();
      if (host[UI_KEY] === ui) delete host[UI_KEY];
    },
  };

  buildTabs();
  renderTab();
  pollState();
  doc.body.append(rootEl);
  return ui;
}

function uiMount(api, opts) {
  opts = opts || {};
  const host = opts.host || globalThis;
  const doc = host.document;
  if (!doc || !doc.body || typeof doc.createElement !== 'function' || !api.status().installed) return null;
  const prev = host[UI_KEY];
  if (prev && prev.api === api && prev.el.isConnected) return prev;
  if (prev) prev.destroy();
  try {
    const ui = uiBuild(api, host, doc);
    host[UI_KEY] = ui;
    return ui;
  } catch (e) {
    console.warn('[IVO-mod] panel failed to mount:', e); // a panel failure must not break the install
    return null;
  }
}

const api = install(objects, opts);
if (!opts || opts.ui !== false) uiMount(api, opts);
return api;
}
