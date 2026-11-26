import { PLAYER, GAME, COOP, RIFT, JUDGMENT, RUNUI, LEVELUP, ITEMCHOICE, EVOCHOICE, BROWSER, AUTOMATION } from '../config.js';
import { defineFeature } from '../api.js';
import { markPractice } from '../run.js';
import { modded, wrapFeature } from './common.js';

const RUI = RUNUI.keys;

export const REWARD_MODES = ['off', 'first card', 'new moves first', 'upgrades first', 'stats first'];
export const ITEM_MODES = ['off', 'always take', 'only into a free slot', 'always keep'];
export const EVO_MODES = ['off', 'evolve', 'keep its look'];

const REWARD_ORDER = {
  'new moves first': [LEVELUP.types.new, LEVELUP.types.evo, LEVELUP.types.up, LEVELUP.types.stat],
  'upgrades first': [LEVELUP.types.evo, LEVELUP.types.up, LEVELUP.types.new, LEVELUP.types.stat],
  'stats first': [LEVELUP.types.stat, LEVELUP.types.evo, LEVELUP.types.up, LEVELUP.types.new],
};
const isForget = o => !o || o[LEVELUP.optionKey] === LEVELUP.forgetKey;
// -1 = nothing to pick; unknown types fall back to the first non-forget card
export function chooseCard(options, mode) {
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
export function chooseSlot(free, mode) {
  const f = Number.isInteger(free) && free >= 0 ? free : -1;
  if (mode === 'always take') return f >= 0 ? f : 0;
  if (mode === 'only into a free slot') return f >= 0 ? f : ITEMCHOICE.keep;
  if (mode === 'always keep') return ITEMCHOICE.keep;
  return null;
}

// pickEvo index: 0 = first evo/form, n = the trailing "Keep its look", -1 = do nothing
export function chooseEvo(n, mode) {
  if (!Number.isInteger(n) || n < 0) return -1;
  if (mode === 'evolve') return n > 0 ? 0 : -1;
  if (mode === 'keep its look') return n;
  return -1;
}

// canAct is hardcoded to "playing", this takes the state so the level-up screens can use it too
export function actReason(h, state) {
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

export function makeAutoItems(unknown) {
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

export function bgInstall(h) {
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

export function bgRemove(h) {
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

export const AUTOMATION_FEATURES = [AUTO_REWARDS, AUTO_ITEMS, AUTO_EVO, BACKGROUND_RUN];
