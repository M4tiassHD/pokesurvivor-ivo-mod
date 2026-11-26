import { BUILD, MODULES, PLAYER, GAME, COMBAT, COOP, RIFT, JUDGMENT, ENEMYMGR, SPAWNER, ENEMIES, SPRITES, WORLD, PICKUPS, MOVES,
  PROJECTILES, GACHA, RUNUI, RIFT_LIVE, ACCOUNT, WORLD_LIVE } from './config.js';

// config key groups -> the MODULES entry whose object carries them, string key names only
export const DIAG_GROUPS = Object.freeze([
  ['GAME', 'Game', GAME], ['COMBAT', 'Combat', COMBAT], ['COOP', 'Coop', COOP], ['RIFT', 'Rift', RIFT], ['RIFT_LIVE', 'Rift', RIFT_LIVE],
  ['JUDGMENT', 'Judgment', JUDGMENT], ['ENEMYMGR', 'EnemyMgr', ENEMYMGR], ['SPAWNER', 'Spawner', SPAWNER], ['ENEMIES', 'Enemies', ENEMIES],
  ['SPRITES', 'Sprites', SPRITES], ['WORLD', 'World', WORLD], ['WORLD_LIVE', 'World', WORLD_LIVE], ['PICKUPS', 'Pickups', PICKUPS],
  ['MOVES', 'Moves', MOVES], ['PROJECTILES', 'Projectiles', PROJECTILES], ['GACHA', 'Gacha', GACHA], ['RUNUI', 'RunUI', RUNUI],
  ['ACCOUNT', 'Account', ACCOUNT],
]);

// `in` only so accessors never run, a throwing has-trap counts as absent
export function splitKeys(obj, names) {
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
export function keyNames(g) {
  const inline = !(g && g.keys), m = (g && (g.keys || g)) || {};
  const skip = k => VALUE_KEYS.has(k) || (inline && META.has(k));
  return [...new Set(Object.entries(m).filter(([k, v]) => typeof v === 'string' && !skip(k)).map(([, v]) => v))];
}

export function moduleStatus(h, modules) {
  const out = {};
  for (const name of Object.keys(modules)) {
    const amb = h.ambiguous && h.ambiguous[name];
    const ok = !!(h.m && h.m[name]);
    out[name] = { status: ok ? 'ok' : amb ? 'ambiguous' : 'missing', matches: ok ? 1 : amb || 0, verified: modules[name].verified };
  }
  return out;
}

export function diagnose(h, cfg) {
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

export const diagnoseHandle = h => diagnose(h, { build: BUILD, modules: MODULES, groups: DIAG_GROUPS, player: PLAYER });
