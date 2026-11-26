import { PLAYER, PLAYER_PRED, GAME, COOP, RIFT, JUDGMENT, COMBAT, TICK_PLAYER_ARG } from './config.js';

export function validPlayer(o) {
  try { return o !== null && typeof o === 'object' && PLAYER_PRED(o) === true; } catch { return false; }
}

const fin = Number.isFinite;

export function canAct(h) {
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
export function canMenuAct(h) {
  const c = h.m.Coop;
  if (!c) return { ok: false, reason: 'not located on this build: Coop' };
  if (c[COOP.keys.active]) return { ok: false, reason: 'co-op run' };
  return { ok: true, reason: null };
}

// every modded action calls this first, flag is never cleared
export function markPractice(h) {
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
export function installCapture(h, patcher) {
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
