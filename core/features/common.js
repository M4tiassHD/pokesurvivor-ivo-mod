import { COOP, LIMITS, ENEMY, ENEMYMGR_LEAD } from '../config.js';
import { defineFeature } from '../api.js';
import { markPractice } from '../run.js';

export const finite = Number.isFinite;
export function noop() { /* nothing to undo */ }

// game clears the practice flag on every startRun, so re-mark once per captured player
export function modded(h) {
  const p = h.player, c = h.m.Coop;
  if (h.dead || !p || !c || c[COOP.keys.active]) return false;
  if (h.scratch.marked !== p) {
    try { markPractice(h); } catch { return false; }
    h.scratch.marked = p;
  }
  return true;
}

export function installWraps(h, specs) {
  const ids = [];
  try { for (const [obj, key, make] of specs) ids.push(h.patcher.wrap(obj, key, make)); }
  catch (e) { dropWraps(h, ids); throw e; }
  return ids;
}
export function dropWraps(h, ids) {
  for (const id of ids.slice().reverse()) h.patcher.unwrap(id);
  ids.length = 0;
}

// features in a group share one wrap, installed while any opt is non-default
export function setShared(h, group, defaults, name, value, makeSpecs) {
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
export function wrapFeature(d) {
  const { group, defaults, name, specs, ...rest } = d;
  const set = (h, v) => setShared(h, group, defaults, name, v, s => specs(h, s));
  return defineFeature({ ...rest, default: defaults[name], apply: set, reset: h => set(h, defaults[name]) });
}

export function clampInt(v, lo, hi) {
  const n = Number(v);
  if (!finite(n)) throw new Error('value not a finite number');
  return Math.max(lo, Math.min(hi, Math.floor(n)));
}
// Spawner.CAP + 10, hard max 256
export function mobLimit(cap) { return finite(cap) && cap >= 1 ? Math.min(LIMITS.mobHard, cap + LIMITS.mobMargin) : NaN; }
export function roomFor(count, limit, want) {
  return finite(count) && finite(limit) && finite(want) ? Math.max(0, Math.min(Math.floor(want), limit - count)) : 0;
}
export function radialAngles(n) { const a = []; for (let i = 1; i <= n; i++) a.push(Math.PI * 2 * i / (n + 1)); return a; }
export function rotate(vx, vy, a) { const c = Math.cos(a), s = Math.sin(a); return [vx * c - vy * s, vx * s + vy * c]; }
// clock going backwards = new run
export function dueEvery(t, last, every) { return finite(t) && (!finite(last) || t < last || t - last >= every); }
// first spot at +x, so a single spawn lands at (px + d, py)
export function ringSpots(px, py, n, d) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = Math.PI * 2 * i / n; out.push({ x: px + Math.cos(a) * d, y: py + Math.sin(a) * d }); }
  return out;
}

export const val = (h, id) => h.values.get(id);

export function enemyList(h) {
  const all = h.m.EnemyMgr[ENEMYMGR_LEAD.keys.all]();
  if (!Array.isArray(all)) throw new Error('enemy list unavailable');
  return all;
}
// Enemy class = any live enemy's ctor, same enemy gives the sc multipliers
export function enemySample(h) {
  const E = ENEMY.keys;
  const e = enemyList(h).find(x => x && typeof x === 'object' && !x[E.dead] && typeof x[E.ctor] === 'function' && x[E.ctor].prototype);
  if (!e) throw new Error('no enemy to read the constructor from');
  return { Enemy: e[E.ctor], sample: e };
}
