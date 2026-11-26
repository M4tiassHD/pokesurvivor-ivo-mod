import { WORLD_CHUNK, WORLD_LIVE, PROP, PLACEMENT, ENEMY, ENEMY_LEAD, RIFT_LIVE, PLAYER, LIMITS } from '../config.js';
import { defineFeature } from '../api.js';
import { canAct } from '../run.js';
import { finite, noop, enemyList } from './common.js';

const LC = WORLD_CHUNK.keys, LP = PROP.keys, LE = ENEMY.keys;

// +x east, +y south (canvas, y down)
// TODO: not checked against a real chest yet
export function distance(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
const DIRS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
export function direction8(dx, dy) {
  if (!finite(dx) || !finite(dy) || (dx === 0 && dy === 0)) return '?';
  return DIRS[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
}
export const formatPx = d => `${Math.round(d)}px`;
export function formatProgress(open) {
  return finite(open) ? `${Math.min(PROP.chestTime, Math.max(0, open)).toFixed(1)}/${PROP.chestTime}` : `?/${PROP.chestTime}`;
}

// chunk map keys are numbers: 0x200000*(a+0x100000)+(b+0x100000)
export const tileKey = (a, b) => 0x200000 * (a + 0x100000) + (b + 0x100000);

export function nearestBigChest(chunks, px, py) {
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
export function formatBigChest(f) {
  return f ? `big chest ${formatPx(f.dist)} ${direction8(f.dx, f.dy)}, unlock ${formatProgress(f.prop[LP.open])}` : 'none in loaded chunks';
}

export function radarLabel(e) {
  const tags = [e[ENEMY_LEAD.keys.legend] && 'legend', e[LE.boss] && 'boss', e[LE.shiny] && 'shiny'].filter(Boolean).join('+');
  const who = typeof e[LE.name] === 'string' && e[LE.name] ? e[LE.name] : `#${e[LE.dex]}`;
  return `${tags} ${who}`;
}
export function radarTargets(enemies, px, py, max) {
  const out = [];
  for (const e of enemies) {
    if (!e || typeof e !== 'object' || e[LE.dead] || !(e[LE.shiny] || e[LE.boss] || e[ENEMY_LEAD.keys.legend])) continue;
    if (!finite(e[LE.x]) || !finite(e[LE.y])) continue;
    out.push({ label: radarLabel(e), dist: distance(px, py, e[LE.x], e[LE.y]), dx: e[LE.x] - px, dy: e[LE.y] - py });
  }
  return out.sort((a, b) => a.dist - b.dist).slice(0, max);
}
export function formatPortal(portal, px, py) {
  if (!portal) return 'no rift portal';
  const K = RIFT_LIVE.portal, x = portal[K.x], y = portal[K.y], ttl = portal[K.ttl];
  if (![x, y, ttl].every(finite)) return 'rift portal data invalid';
  return `rift portal ${formatPx(distance(px, py, x, y))} ${direction8(x - px, y - py)}, ttl ${Math.max(0, Math.round(ttl))}s`;
}
export function formatRadar(targets, portalText) {
  const t = targets.length ? targets.map(x => `${x.label} ${formatPx(x.dist)} ${direction8(x.dx, x.dy)}`) : ['no shiny, boss or legend targets'];
  return [...t, portalText].join(' | ');
}

export function ringTiles(ptx, pty, rMin, rMax) {
  const out = [];
  for (let dy = -rMax; dy <= rMax; dy++) for (let dx = -rMax; dx <= rMax; dx++) {
    const d = Math.max(Math.abs(dx), Math.abs(dy));
    if (d >= rMin && d <= rMax) out.push([ptx + dx, pty + dy]);
  }
  return out;
}
export function shuffled(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
// terr index is (ty - cy*16)*16 + (tx - cx*16), same as the game's break code
export function floorTile(chunks, tx, ty) {
  const n = WORLD_CHUNK.tilesPerChunk, cx = Math.floor(tx / n), cy = Math.floor(ty / n);
  const ch = chunks.get(tileKey(cx, cy));
  if (!ch || ch[LC.cx] !== cx || ch[LC.cy] !== cy || !(ch[LC.terr] instanceof Uint8Array) || ch[LC.terr].length !== WORLD_CHUNK.terrLen) return null;
  const key = tileKey(tx, ty);
  if (ch[LC.terr][(ty - cy * n) * n + (tx - cx * n)] !== WORLD_CHUNK.floor || ch[LC.propAll].has(key)) return null;
  return { chunk: ch, key };
}
// copy of the game's prop factory, wiggle 0 like the insert I tested
export function makeProp(type, tx, ty, id) {
  const d = PROP.table[type], T = WORLD_CHUNK.tile;
  if (!d) throw new Error(`unknown prop type ${type}`);
  return { id, type, tx, ty, kind: d.kind, x: tx * T + T / 2, y: ty * T + T - PROP.footInset, r: d.r, hp: d.hp, maxHp: d.hp, solid: d.solid,
    flat: false, destructible: d.hp !== Infinity, flash: 0, wiggle: 0, used: false, charge: 1, open: 0 };
}
// mirrors the game's chunk insert (aC)
export function insertProp(chunk, prop) {
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
export function placeProps({ chunks, type, want, px, py, isFree, rng = Math.random }) {
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
export function liveChunks(h) {
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

export const LOCATOR = [
  locatorAction({ id: 'locator.bigChest', label: 'Locate nearest big chest', needs: [...LOCATOR_NEEDS, 'World', 'Chunks'],
    apply(h) { const p = locate(h), ch = liveChunks(h); return formatBigChest(nearestBigChest(ch, p[PLAYER.keys.x], p[PLAYER.keys.y])); } }),
  locatorAction({ id: 'locator.radar', label: 'Rare target radar', needs: [...LOCATOR_NEEDS, 'EnemyMgr'],
    leads: ['EnemyMgr.all'],
    apply(h) {
      const p = locate(h), x = p[PLAYER.keys.x], y = p[PLAYER.keys.y];
      return formatRadar(radarTargets(enemyList(h), x, y, LIMITS.radarMax), formatPortal(h.m.Rift[RIFT_LIVE.keys.portal], x, y));
    } }),
];
