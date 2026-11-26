import { PLAYER, GAME, ENEMY, ENEMY_DEF, ENEMYMGR, SPAWNER, SPAWNER_UPDATE_DT_ARG, ENEMIES, SPRITES, WORLD, TREASURE, LIMITS,
  GACHA, RIFT, RIFT_LIVE, ARENA_TYPES, LEGEND, BIGCHEST_INSERT, PROP } from '../config.js';
import { defineFeature } from '../api.js';
import { canAct } from '../run.js';
import { finite, noop, modded, wrapFeature, clampInt, mobLimit, roomFor, ringSpots, val, enemySample } from './common.js';
import { liveChunks, placeProps } from './locator.js';

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
export function buildLegendDef(entry, t, bal, idx = LEGEND.idx, n = LEGEND.players) {
  const K = LEGEND.keys, B = LEGEND.balance, S = LEGEND.spd, spd = entry && entry[K.spd], types = entry && entry[K.types];
  if (!entry || !finite(spd) || !Array.isArray(types) || !finite(t) || t < 0 || !bal || typeof bal[B.legendHp] !== 'function' || typeof bal[B.legendDmg] !== 'function') throw new Error('legend inputs unavailable');
  const hp = Math.round(bal[B.legendHp](idx, t, n, LEGEND.dps, LEGEND.calibrated)), dmg = bal[B.legendDmg](t);
  if (!finite(hp) || hp < 1 || !finite(dmg) || dmg < 0) throw new Error('Balance returned unusable numbers');
  return { dex: entry[K.dex], name: entry[K.name], hp, spd: Math.round(Math.min(S.max, Math.max(S.base, S.base + S.slope * (spd - S.ref)))),
    dmg: Math.round(dmg), xp: Math.round(LEGEND.xpBase + LEGEND.xpPerSec * t),
    behavior: types.some(x => LEGEND.rangedTypes.includes(x)) ? 'ranged' : 'charger',
    shotDmg: Math.round(LEGEND.shotDmgMul * dmg), shotCd: LEGEND.shotCd, range: LEGEND.range };
}
export function findLegend(dex, number) {
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

export const SPAWNS = [
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
