import test from 'node:test';
import assert from 'node:assert/strict';
import { install } from '../index.js';
import { BUILD } from '../config.js';
import { createApi } from '../api.js';
import { createPatcher } from '../patch.js';
import { chooseCard, chooseSlot, chooseEvo, makeAutoItems, AUTOMATION_FEATURES } from '../features/automation.js';
import { fakeFull, goodDoc } from './fake.mjs';

const opt = type => ({ type, key: `${type}:x` });
const OPTS = [opt('stat'), opt('up'), opt('new'), opt('stat')];

// fake handle: all guard modules, a captured player, recording RunUI, manual timers
function rig(features, extra = {}) {
  const w = fakeFull();
  const log = { picks: [], evo: [], offering: true, shown: [], hidden: [] };
  const RunUI = {
    showLevelUp(...a) { log.shown.push(a); }, showItemChoice(...a) { log.shown.push(a); },
    showEvo(...a) { log.shown.push(a); }, showForm(...a) { log.shown.push(a); }, pickEvo(i) { log.evo.push(i); },
    pick(i) { log.picks.push(i); }, offering: () => log.offering,
  };
  const UI = { hide(id) { log.hidden.push(id); }, isOpen() { return true; }, $() {} };
  const h = { m: { Game: w.Game, Coop: w.Coop, Rift: w.Rift, Judgment: w.Judgment, RunUI, UI }, player: w.player, dead: false,
    scratch: { ...extra }, patcher: createPatcher(), gate: null, capture: {}, build: {}, missing: [], ambiguous: {} };
  let api;
  const cleanup = () => { api.resetAll(); return h.patcher.restoreAll(); }; // same as the cleanup in core/index.js
  api = createApi({ h, features, cleanup, expectedBuild: BUILD });
  const timers = [];
  const realST = globalThis.setTimeout;
  globalThis.setTimeout = (f, ms) => { timers.push({ f, ms }); return timers.length; };
  const fire = () => { for (const t of timers.splice(0)) t.f(); };
  const done = () => { globalThis.setTimeout = realST; };
  return { w, h, api, log, RunUI, timers, fire, done };
}

test('selection policy: priority per mode, fallbacks, bad input', () => {
  assert.equal(chooseCard(OPTS, 'first card'), 0);
  assert.equal(chooseCard(OPTS, 'new moves first'), 2);
  assert.equal(chooseCard(OPTS, 'upgrades first'), 1);
  assert.equal(chooseCard(OPTS, 'stats first'), 0);
  assert.equal(chooseCard([opt('up'), opt('stat')], 'new moves first'), 0);
  assert.equal(chooseCard([opt('weird'), opt('other')], 'upgrades first'), 0);
  assert.equal(chooseCard([], 'first card'), -1);
  assert.equal(chooseCard(null, 'first card'), -1);
  assert.equal(chooseCard(OPTS, 'off'), -1);
  assert.equal(chooseCard(OPTS, 'bogus'), -1);
});

test('item slot per mode', () => {
  assert.equal(chooseSlot(2, 'always take'), 2);
  assert.equal(chooseSlot(-1, 'always take'), 0);
  assert.equal(chooseSlot(undefined, 'always take'), 0);
  assert.equal(chooseSlot(1, 'only into a free slot'), 1);
  assert.equal(chooseSlot(-1, 'only into a free slot'), -1);
  assert.equal(chooseSlot(3, 'always keep'), -1);
  assert.equal(chooseSlot(0, 'off'), null);
});

test('auto rewards: picks after the delay, rechecks everything, queued screens', () => {
  const r = rig(AUTOMATION_FEATURES);
  try {
    assert.equal(r.api.set('automation.autoRewards', 'new moves first').ok, true);
    r.w.Game.state = 'levelup';
    r.RunUI.showLevelUp(3, OPTS, () => {});
    assert.equal(r.log.shown.length, 1);                  // original still runs
    assert.equal(r.timers.length, 1);
    assert.equal(r.timers[0].ms, 700);                    // game drops picks for 0x258 ms after the screen opens
    r.fire();
    assert.deepEqual(r.log.picks, [2]);

    r.log.picks.length = 0;
    r.RunUI.showLevelUp(4, OPTS, () => {}); r.log.offering = false; r.fire(); r.log.offering = true;
    r.RunUI.showLevelUp(4, OPTS, () => {}); r.w.Game.state = 'playing'; r.fire(); r.w.Game.state = 'levelup';
    r.RunUI.showLevelUp(4, OPTS, () => {}); r.w.Coop.active = true; r.fire(); r.w.Coop.active = false;
    r.RunUI.showLevelUp(4, OPTS, () => {}); r.w.Rift.inArena = true; r.fire(); r.w.Rift.inArena = false;
    r.RunUI.showLevelUp(4, OPTS, () => {}, true); assert.equal(r.timers.length, 0);   // co-op wait flag
    r.RunUI.showLevelUp(4, OPTS, () => {}); r.w.Game.state = 'playing'; r.api.set('automation.autoRewards', 'off'); r.w.Game.state = 'levelup'; r.fire();
    assert.deepEqual(r.log.picks, []);

    // queue: the newest call replaces the first; only it acts, once
    r.w.Game.state = 'playing'; r.api.set('automation.autoRewards', 'first card'); r.w.Game.state = 'levelup';
    r.RunUI.showLevelUp(5, OPTS, () => {}); r.RunUI.showLevelUp(6, [opt('up'), opt('new')], () => {});
    r.fire();
    assert.deepEqual(r.log.picks, [0]);
    r.fire();
    assert.deepEqual(r.log.picks, [0]);
  } finally { r.done(); }
});

test('auto rewards: the practice flag is marked before the pick', () => {
  const r = rig(AUTOMATION_FEATURES);
  try {
    r.api.set('automation.autoRewards', 'first card');
    r.w.Game.state = 'levelup';
    const order = [];
    r.w.Game.debugTime = () => order.push('mark');
    r.RunUI.pick = () => order.push('pick');
    r.RunUI.showLevelUp(2, OPTS, () => {});
    r.fire();
    assert.deepEqual(order.slice(-2), ['mark', 'pick']);
  } finally { r.done(); }
});

test('auto items: hides the item screen then calls back with the slot per mode', () => {
  const r0 = rig(AUTOMATION_FEATURES);
  assert.equal(r0.api.get('automation.autoItems').enabled, true);
  r0.done();

  const r = rig([makeAutoItems([])]);
  try {
    const run = (mode, free) => {
      r.w.Game.state = 'playing'; r.api.set('automation.autoItems', mode);
      r.w.Game.state = 'choice';
      const got = [];
      r.RunUI.showItemChoice([], 'leftovers', s => got.push(s), free);
      r.fire();
      return got;
    };
    assert.deepEqual(run('always take', 1), [1]);
    assert.deepEqual(r.log.hidden, ['scr-item']);              // same order as the card click
    assert.deepEqual(run('always take', -1), [0]);
    assert.deepEqual(run('only into a free slot', 0), [0]);
    assert.deepEqual(run('only into a free slot', -1), [-1]);
    assert.deepEqual(run('always keep', 0), [-1]);
    r.w.Coop.active = true;
    assert.deepEqual(run('always take', 0), []);
    r.w.Coop.active = false;
    r.w.Game.state = 'playing'; r.api.set('automation.autoItems', 'always take');
    const got = []; r.w.Game.state = 'choice';
    r.RunUI.showItemChoice([], 'x', s => got.push(s), 0); r.w.Game.state = 'playing'; r.fire();
    assert.deepEqual(got, []);
    const n = r.h.patcher.count();
    r.api.reset('automation.autoItems');
    assert.equal(r.h.patcher.count(), n - 1);
  } finally { r.done(); }
});

function fakeBrowser() {
  const calls = { raf: [], cleared: [] };
  let hidden = false, tick = null;
  const proto = {};
  Object.defineProperty(proto, 'hidden', { get() { return hidden; }, configurable: true });
  Object.defineProperty(proto, 'visibilityState', { get() { return hidden ? 'hidden' : 'visible'; }, configurable: true });
  const doc = Object.create(proto);
  const rafOrig = function (cb) { calls.raf.push(cb); return calls.raf.length; };
  const win = { requestAnimationFrame: rafOrig };
  const clock = { now: 1234 };
  const env = { document: doc, window: win, Document: function Document() {}, performance: { now: () => clock.now },
    setInterval: (f, ms) => { calls.ms = ms; tick = f; return 7; }, clearInterval: id => calls.cleared.push(id) };
  env.Document.prototype = proto;
  return { env, doc, win, proto, rafOrig, calls, clock, setHidden: v => { hidden = v; }, tick: () => tick() };
}
const bgFeature = () => ({ ...AUTOMATION_FEATURES.find(f => f.id === 'automation.backgroundRun'), unknown: [] });

test('background run: gated, shadows on the instance, drives while hidden, exact restore', () => {
  const b = fakeBrowser();
  const r = rig(AUTOMATION_FEATURES, { env: b.env });
  assert.equal(r.api.get('automation.backgroundRun').enabled, true);   // rAF ownership checked in game
  r.done();

  const r2 = rig([bgFeature()], { env: b.env });
  try {
    assert.equal(r2.api.set('automation.backgroundRun', true).ok, true);
    assert.equal(b.doc.hidden, false);
    assert.equal(b.doc.visibilityState, 'visible');
    assert.equal(Object.getOwnPropertyDescriptor(b.proto, 'hidden').get.call(b.doc), false);
    assert.notEqual(b.win.requestAnimationFrame, b.rafOrig);
    assert.equal(b.calls.ms, 50);

    const frame = ts => frame.ts.push(ts); frame.ts = [];
    b.win.requestAnimationFrame(frame);
    assert.deepEqual(b.calls.raf, [frame]);                 // visible: forwarded
    b.tick(); assert.deepEqual(frame.ts, []);               // visible: driver idle

    b.setHidden(true);
    assert.equal(b.doc.hidden, false);                      // still shadowed
    const loop = ts => { loop.ts.push(ts); b.win.requestAnimationFrame(loop); }; loop.ts = [];
    b.win.requestAnimationFrame(loop);                      // hidden: stored, not forwarded
    assert.equal(b.calls.raf.length, 1);
    b.tick(); b.tick();
    assert.deepEqual(loop.ts, [1234]);                      // first tick: one frame, same clock: nothing to replay
    b.clock.now += 34 * 3; b.tick();
    assert.deepEqual(loop.ts, [1234, 1268, 1302, 1336]);    // throttled tick replays elapsed time in 34 ms frames
    assert.equal(b.calls.raf.length, 1);
    r2.w.Coop.active = true; b.clock.now += 34; b.tick(); assert.equal(loop.ts.length, 4); r2.w.Coop.active = false;
    loop.ts = []; b.clock.now += 34 * 5000; b.tick();
    assert.equal(loop.ts.length, 900);                      // backlog capped
    assert.equal(loop.ts.at(-1), b.clock.now);
    b.setHidden(false); b.tick(); b.setHidden(true);        // visible again: replay clock resets
    loop.ts = []; b.win.requestAnimationFrame(loop); b.clock.now += 34 * 100; b.tick();
    assert.deepEqual(loop.ts, [b.clock.now]);

    assert.equal(r2.api.set('automation.backgroundRun', false).ok, true);
    assert.equal(b.win.requestAnimationFrame, b.rafOrig);
    assert.equal(Object.getOwnPropertyDescriptor(b.doc, 'hidden'), undefined);
    assert.equal(Object.getOwnPropertyDescriptor(b.doc, 'visibilityState'), undefined);
    assert.equal(b.doc.hidden, true);
    assert.deepEqual(b.calls.cleared, [7]);
    assert.equal(r2.api.reset('automation.backgroundRun').ok, true);   // idempotent
  } finally { r2.done(); }
});

test('background run: failed install rolls back; uninstall restores', () => {
  const b = fakeBrowser();
  Object.defineProperty(b.win, 'requestAnimationFrame', { value: b.rafOrig, writable: false, configurable: true });
  const r = rig([bgFeature()], { env: b.env });
  try {
    assert.match(r.api.set('automation.backgroundRun', true).error, /cannot wrap/);
    assert.equal(Object.getOwnPropertyDescriptor(b.doc, 'hidden'), undefined);
    Object.defineProperty(b.win, 'requestAnimationFrame', { value: b.rafOrig, writable: true, configurable: true });
    assert.equal(r.api.set('automation.backgroundRun', true).ok, true);
    assert.ok(Object.getOwnPropertyDescriptor(b.doc, 'hidden'));
    r.api.uninstall();
    assert.equal(b.win.requestAnimationFrame, b.rafOrig);
    assert.equal(Object.getOwnPropertyDescriptor(b.doc, 'hidden'), undefined);
    assert.deepEqual(b.calls.cleared, [7]);
  } finally { r.done(); }
});

test('install: Automation features listed; uninstall restores RunUI wraps', () => {
  const w = fakeFull();
  const origLU = function showLevelUp() {};
  const RunUI = { showLevelUp: origLU, showItemChoice() {}, pick() {}, offering: () => true };
  w.objects.push(RunUI);
  const api = install(w.objects, { host: {}, doc: goodDoc(BUILD) });
  w.Combat.tick(0.016, w.player, 1);
  const ids = api.list().filter(f => f.category === 'Automation').map(f => f.id);
  assert.deepEqual(ids, ['automation.autoRewards', 'automation.autoItems', 'automation.autoEvo', 'automation.backgroundRun']);
  assert.equal(api.get('automation.autoRewards').enabled, true);
  assert.equal(api.set('automation.autoRewards', 'first card').ok, true);
  assert.notEqual(RunUI.showLevelUp, origLU);
  const res = api.uninstall();
  assert.equal(RunUI.showLevelUp, origLU);
  assert.deepEqual(res.failed, []);
});

test('auto rewards never picks a forget card; evo ranks with upgrades', () => {
  const o = (type, key) => ({ type, key });
  const forgetFirst = [o('forget', 'forget'), o('new', 'new:x'), o('stat', 'stat:hp')];
  assert.equal(chooseCard(forgetFirst, 'first card'), 1);
  assert.equal(chooseCard([o('forget', 'forget')], 'first card'), -1);
  assert.equal(chooseCard([o('forget', 'forget')], 'stats first'), -1);
  const withEvo = [o('up', 'up:a'), o('evo', 'evo:ember'), o('stat', 'stat:coin')];
  assert.equal(chooseCard(withEvo, 'upgrades first'), 1);
  assert.equal(chooseCard(withEvo, 'stats first'), 2);
  assert.equal(chooseCard([o('weird', 'weird:1'), o('forget', 'forget')], 'new moves first'), 0);
});

test('auto evolution: evolve = index 0, keep = last (decline), form screen too, rechecks state', () => {
  assert.equal(chooseEvo(1, 'evolve'), 0);
  assert.equal(chooseEvo(2, 'keep its look'), 2);
  assert.equal(chooseEvo(0, 'evolve'), -1);
  assert.equal(chooseEvo(0, 'keep its look'), 0);
  assert.equal(chooseEvo(-1, 'evolve'), -1);
  assert.equal(chooseEvo(1, 'off'), -1);
  const r = rig(AUTOMATION_FEATURES);
  try {
    const cb = () => {};
    assert.equal(r.api.set('automation.autoEvo', 'evolve').ok, true);
    r.w.Game.state = 'choice';
    r.RunUI.showEvo(r.w.player, { k: 1, all: [814], half: false, opts: [814] }, cb);
    assert.equal(r.timers.length, 1); assert.equal(r.timers[0].ms, 700);
    r.fire(); assert.deepEqual(r.log.evo, [0]);
    r.w.Game.state = 'playing'; assert.equal(r.api.set('automation.autoEvo', 'keep its look').ok, true); r.w.Game.state = 'choice';
    r.RunUI.showForm(r.w.player, { forms: [{ form: 'a' }, { form: 'b' }] }, cb);
    r.fire(); assert.deepEqual(r.log.evo, [0, 2]);
    r.RunUI.showEvo(r.w.player, { opts: [814] }, cb);
    r.w.Game.state = 'playing'; r.fire(); assert.deepEqual(r.log.evo, [0, 2]);       // screen gone: no pick
    r.w.Game.state = 'choice'; r.RunUI.showEvo(r.w.player, { opts: 'bad' }, cb);
    assert.equal(r.timers.length, 0);
    const n = r.h.patcher.count();
    r.api.reset('automation.autoEvo');
    assert.equal(r.h.patcher.count(), n - 2);
  } finally { r.done(); }
});
