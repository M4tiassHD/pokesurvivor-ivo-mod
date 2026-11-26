import test from 'node:test';
import assert from 'node:assert/strict';
import { findModules, readBuild, parseBuild } from '../finders.js';
import { createPatcher } from '../patch.js';
import { MODULES, BUILD } from '../config.js';
import { install } from '../index.js';
import { bundle } from '../../tools/build.mjs';
import { fakeWorld, goodDoc } from './fake.mjs';

const host = () => ({});
const opts = (extra = {}) => ({ host: host(), doc: goodDoc(BUILD), ...extra });

test('finder: found, missing, ambiguous', () => {
  const w = fakeWorld();
  const dup = { ...w.Combat, tick() {} };
  const r = findModules([...w.objects, dup], MODULES);
  assert.equal(r.found.Game, w.Game);
  assert.deepEqual(r.ambiguous.Combat, 2);
  assert.ok(!('Combat' in r.found));
  assert.ok(r.missing.includes('Spawner'));
});

test('finder: throwing getters, proxies and null-proto do not break the scan', () => {
  const evil = { get tick() { throw new Error('x'); }, get active() { throw new Error('y'); } };
  const proxy = new Proxy({}, { has() { throw new Error('p'); }, getOwnPropertyDescriptor() { throw new Error('p'); } });
  const np = Object.create(null);
  const w = fakeWorld();
  const r = findModules([evil, proxy, np, ...w.objects], MODULES);
  assert.equal(r.found.Game, w.Game);
});

test('readBuild: v param, null is distinct from mismatch', () => {
  assert.equal(parseBuild('/js/app.min.js?v=abc'), 'abc');
  assert.equal(readBuild(goodDoc(BUILD)), BUILD);
  assert.equal(readBuild(goodDoc(null)), null);
  assert.equal(readBuild({ querySelector: () => null }), null);
  assert.equal(readBuild(undefined), null);
});

test('patch: restore in reverse order', () => {
  const o = { f() { return 'orig'; } };
  const orig = o.f, p = createPatcher();
  p.wrap(o, 'f', f => function () { return 'a' + f(); });
  p.wrap(o, 'f', f => function () { return 'b' + f(); });
  assert.equal(o.f(), 'baorig');
  assert.deepEqual(p.restoreAll(), { restored: 2, left: [], failed: [] });
  assert.equal(o.f, orig);
});

test('patch: someone else re-wrapped -> left alone and reported', () => {
  const o = { f() {} };
  const p = createPatcher();
  p.wrap(o, 'f', f => function () { return f(); });
  const theirs = function () {};
  o.f = theirs;
  const r = p.restoreAll();
  assert.equal(r.restored, 0);
  assert.equal(r.left.length, 1);
  assert.equal(o.f, theirs);
});

test('patch: refuses non-function / non-writable and leaves nothing behind', () => {
  const o = { a: 1 };
  Object.defineProperty(o, 'g', { value() {}, writable: false, configurable: true });
  const p = createPatcher();
  assert.throws(() => p.wrap(o, 'a', f => f));
  assert.throws(() => p.wrap(o, 'g', f => f));
  assert.throws(() => p.wrap({ f() {} }, 'f', () => 1));
  assert.equal(p.count(), 0);
});

test('api: missing module disables features with a reason', () => {
  const w = fakeWorld();
  const api = install(w.objects.filter(o => o !== w.Combat), opts());
  const f = api.get('stats.damage');
  assert.equal(f.enabled, false);
  assert.equal(f.reason, 'not located on this build: Combat');
  assert.equal(api.set('stats.damage', 3).ok, false);
  api.uninstall();
});

test('api: build mismatch / unknown disables; allowUnverified lifts', () => {
  const w = fakeWorld();
  const a = install(w.objects, { host: host(), doc: goodDoc('deadbeef') });
  assert.equal(a.get('stats.damage').reason, 'unverified build deadbeef');
  assert.equal(a.status().capture.state, 'skipped: unverified build deadbeef');
  const b = install(w.objects, { host: host(), doc: goodDoc(null) });
  assert.equal(b.get('stats.damage').reason, 'build unknown');
  const c = install(w.objects, { host: host(), doc: goodDoc('deadbeef'), allowUnverified: true });
  assert.equal(c.get('stats.damage').enabled, true);
  c.uninstall();
});

test('install: refuses non-array, and double install returns the same api', () => {
  assert.throws(() => install({}, opts()));
  const w = fakeWorld(), o = opts();
  const a = install(w.objects, o);
  assert.equal(install(w.objects, o), a);
  assert.deepEqual(Object.keys(o.host), []);
  a.uninstall();
  assert.notEqual(install(w.objects, o), a);
});

test('damage: capture, guards, write, reset, uninstall restores', () => {
  const w = fakeWorld(), o = opts();
  const origTick = w.Combat.tick, origStart = w.Game.startRun;
  const api = install(w.objects, o);
  assert.equal(api.status().patches, 2);
  assert.match(api.set('stats.damage', 3).error, /not captured/);
  w.Combat.tick(0.016, w.player, 1);               // player is arg 1
  assert.equal(w.calls.tick, 1);
  assert.equal(api.status().player.captured, true);
  const r = api.set('stats.damage', 3.04);
  assert.deepEqual(r, { ok: true, value: 3 });
  assert.equal(w.player.atkMul, 6);                 // base 2 * 3
  assert.deepEqual(w.calls.debugTime, [12.5]);
  api.set('stats.damage', 99);
  assert.equal(w.player.atkMul, 20);                // clamped to 10
  w.Coop.active = true;
  assert.match(api.set('stats.damage', 2).error, /co-op/);
  w.Coop.active = false; w.Rift.inArena = true;
  assert.match(api.set('stats.damage', 2).error, /rift/);
  w.Rift.inArena = false; w.Game.state = 'paused';
  assert.match(api.set('stats.damage', 2).error, /no run/);
  w.Game.state = 'playing'; w.player.hp = NaN;
  assert.match(api.set('stats.damage', 2).error, /not finite/);
  w.player.hp = 90;
  w.Game.startRun();                                // new run drops the player
  assert.equal(api.status().player.captured, false);
  w.Combat.tick(0.016, w.player, 1);
  w.player.dead = true;
  w.Combat.tick(0.016, w.player, 2);
  assert.equal(api.status().player.captured, false);
  w.player.dead = false;
  w.Combat.tick(0.016, w.player, 3);
  api.uninstall();
  assert.equal(w.player.atkMul, 2);                 // reset to the value captured before first write
  assert.equal(w.Combat.tick, origTick);
  assert.equal(w.Game.startRun, origStart);
  assert.equal(api.status().installed, false);
});

test('install: failed capture rolls back and still returns an api', () => {
  const w = fakeWorld();
  Object.defineProperty(w.Game, 'startRun', { value: w.Game.startRun, writable: false, configurable: true });
  const origTick = w.Combat.tick;
  const api = install(w.objects, opts());
  assert.equal(w.Combat.tick, origTick);
  assert.equal(api.status().capture.state, 'failed');
  assert.match(api.set('stats.damage', 2).error, /capture failed/);
});

test('build: bundle parses and runs end to end', () => {
  const code = bundle();
  assert.match(code, /^function psInstall\(objects, opts\)/);
  const psInstall = new Function(`${code}\nreturn psInstall;`)();
  const w = fakeWorld();
  const api = psInstall(w.objects, opts());
  assert.equal(api.status().build.state, 'match');
  api.uninstall();
});

test('status exposes the game state string (or null)', () => {
  const w = fakeWorld(), api = install(w.objects, opts());
  assert.equal(api.status().game.state, 'playing');
  w.Game.state = 'levelup'; assert.equal(api.status().game.state, 'levelup');
  w.Game.state = 7; assert.equal(api.status().game.state, null);
  api.uninstall();
});

test('Coop and Combat predicates stay unique next to look-alikes', () => {
  const w = fakeWorld();
  w.Judgment.active = false;
  w.objects.push({ active: true }, { tick() {} }, { tick() {}, begin() {}, air() {} }); // last one is the charge-move module
  const api = install(w.objects, opts());
  assert.deepEqual(api.status().modules.ambiguous, {});
  api.uninstall();
});
