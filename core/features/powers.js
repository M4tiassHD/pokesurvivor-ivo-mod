import { PLAYER, PLAYER_LEAD, MOVE_LEAD, MOVE_DEF, EVO_LEAD, ENEMY, ENEMY_LEAD, ENEMY_DEF, MOVES, PROJ_LEAD, PROJECTILES,
  PROJECTILES_ALL, PICKUPS, COMBAT, TICK_PLAYER_ARG, GAME, JUDGMENT, LIMITS } from '../config.js';
import { defineFeature } from '../api.js';
import { finite, noop, modded, wrapFeature, enemyList, enemySample, dueEvery, radialAngles, rotate } from './common.js';

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

export const POWERS = [
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
