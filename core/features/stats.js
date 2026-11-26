import { PLAYER, LIMITS, ACCOUNT, GAME } from '../config.js';
import { defineFeature } from '../api.js';
import { finite, noop, clampInt, val } from './common.js';

const COINS_AMOUNT = 'stats.coinsAmount';
const LEVELS_AMOUNT = 'stats.levelsAmount';
// guest saves only. loggedIn is true in guest too, so check Account.guest === true
export function guestSave(account, save) {
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

export const STATS = [
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
