import test from 'node:test';
import assert from 'node:assert/strict';
import { install } from '../index.js';
import { BUILD, MODULES, isChunkMap, isDexArray, ARENA_TYPES } from '../config.js';
import { findModules } from '../finders.js';
import { tileKey, direction8, distance, formatPx, formatProgress, nearestBigChest, formatBigChest, radarTargets, formatRadar, formatPortal,
  ringTiles, floorTile, makeProp, placeProps, liveChunks } from '../features/locator.js';
import { buildLegendDef, findLegend } from '../features/spawns.js';
import { guestSave } from '../features/stats.js';
import { fakeFull, fakeChunks, fakeDex, goodDoc, FakeEnemy } from './fake.mjs';

function boot(mutate) {
  const w = fakeFull();
  if (mutate) mutate(w);
  const api = install(w.objects, { host: {}, doc: goodDoc(BUILD) });
  w.Combat.tick(0.016, w.player, 1);
  return { w, api };
}
const total = w => [...w.chunks.values()].reduce((a, c) => a + c.props.length, 0);

test('finders: each new module matches its fake exactly once; wrong shapes do not match', () => {
  const w = fakeFull();
  const r = findModules(w.objects, MODULES);
  for (const n of ['Chunks', 'Dex', 'Balance', 'Account']) assert.equal(r.found[n], w[n], n);
  assert.deepEqual(r.ambiguous, {});
  assert.equal(isChunkMap(new Map()), false);
  assert.equal(isChunkMap(new Map([[1, { cx: 0, cy: 0, terr: [], props: [], propAt: new Map() }]])), false); // terr not Uint8Array
  assert.equal(isChunkMap({}), false);
  assert.equal(isDexArray(fakeDex().slice(1)), false);
  assert.equal(isDexArray(fakeDex().map(({ bst, ...x }) => x)), false);
  assert.equal(findModules([...w.objects, new Map(w.chunks)], MODULES).ambiguous.Chunks, 2); // duplicates are ambiguous, never picked
});

test('tile key formula matches the live checks', () => {
  assert.equal(tileKey(0, 0), 0x200000 * 0x100000 + 0x100000);
  assert.equal(tileKey(-3, -3), 0x200000 * (0x100000 - 3) + (0x100000 - 3));
  assert.notEqual(tileKey(1, 2), tileKey(2, 1));
});

test('locator math: distance, 8-way direction (y down), formatting', () => {
  assert.equal(distance(0, 0, 3, 4), 5);
  const d = (dx, dy) => direction8(dx, dy);
  assert.deepEqual([d(1, 0), d(1, 1), d(0, 1), d(-1, 1), d(-1, 0), d(-1, -1), d(0, -1), d(1, -1)], ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE']);
  assert.equal(d(10, 3), 'E'); assert.equal(d(0, 0), '?'); assert.equal(d(NaN, 1), '?');
  assert.equal(formatPx(312.6), '313px');
  assert.equal(formatProgress(1.5), '1.5/3.5'); assert.equal(formatProgress(9), '3.5/3.5'); assert.equal(formatProgress(NaN), '?/3.5');
});

test('big chest: nearest unopened across chunks; none otherwise', () => {
  const chunks = fakeChunks();
  assert.equal(formatBigChest(nearestBigChest(chunks, 0, 0)), 'none in loaded chunks');
  const a = chunks.get(tileKey(-1, 0)), b = chunks.get(tileKey(0, 0));
  a.props.push({ type: 'bigchest', x: -300, y: 0, used: false, open: 0 }, { type: 'bigchest', x: 10, y: 10, used: true, open: 0 },
    { type: 'bigchest', x: NaN, y: 0 }, { type: 'chest', x: 5, y: 5 });
  b.props.push({ type: 'bigchest', x: 0, y: 400, open: 1.75 });
  const f = nearestBigChest(chunks, 0, 0);
  assert.equal(f.dist, 300);
  assert.equal(formatBigChest(f), 'big chest 300px W, unlock 0.0/3.5');
  a.props[0].used = true;
  assert.equal(formatBigChest(nearestBigChest(chunks, 0, 0)), 'big chest 400px S, unlock 1.8/3.5');
});

test('radar: shiny, boss or legend only, nearest 5, portal line', () => {
  const mk = (x, y, o) => Object.assign(new FakeEnemy({ dex: 1, hp: 1 }, x, y, {}), o);
  const list = [mk(100, 0, { shiny: true, name: 'Pika' }), mk(10, 0, {}), mk(0, -50, { boss: true, legend: true, name: 'Regirock' }),
    mk(5, 5, { shiny: true, dead: true }), ...[1, 2, 3, 4, 5].map(i => mk(1000 + i, 0, { boss: true })), mk(NaN, 0, { shiny: true })];
  const t = radarTargets(list, 0, 0, 5);
  assert.equal(t.length, 5);
  assert.deepEqual(t.slice(0, 2).map(x => x.label), ['legend+boss Regirock', 'shiny Pika']);
  assert.equal(formatRadar(t.slice(0, 2), 'no rift portal'), 'legend+boss Regirock 50px N | shiny Pika 100px E | no rift portal');
  assert.equal(formatRadar([], 'no rift portal'), 'no shiny, boss or legend targets | no rift portal');
  assert.equal(formatPortal(null, 0, 0), 'no rift portal');
  assert.equal(formatPortal({ x: 300, y: -300, ttl: 51.6, t: 8 }, 0, 0), 'rift portal 424px NE, ttl 52s');
  assert.equal(formatPortal({ x: 'a', y: 0, ttl: 1 }, 0, 0), 'rift portal data invalid');
});

test('tile selection: ring, loaded floor only, no propAll entry, isFree', () => {
  const ring = ringTiles(0, 0, 3, 4);
  assert.ok(ring.every(([x, y]) => Math.max(Math.abs(x), Math.abs(y)) >= 3 && Math.max(Math.abs(x), Math.abs(y)) <= 4));
  assert.equal(ring.length, 81 - 25);
  const chunks = fakeChunks();
  assert.ok(floorTile(chunks, -3, -3));
  chunks.get(tileKey(-1, -1)).terr[(-3 + 16) * 16 + (-3 + 16)] = 1;                  // wall
  assert.equal(floorTile(chunks, -3, -3), null);
  assert.equal(floorTile(chunks, 40, 40), null);                                       // chunk not loaded
  const t = floorTile(chunks, 1, 1);
  t.chunk.propAll.set(tileKey(1, 1), {});
  assert.equal(floorTile(chunks, 1, 1), null);
  assert.equal(placeProps({ chunks, type: 'chest', want: 3, px: 0, py: 0, isFree: () => false }).length, 0);
});

test('chest insert touches props, propAll and propAt; big chest also specials; ids unique and negative', () => {
  const chunks = fakeChunks();
  const placed = placeProps({ chunks, type: 'chest', want: 4, px: 0, py: 0, isFree: () => true, rng: () => 0.3 });
  assert.equal(placed.length, 4);
  assert.equal(new Set(placed.map(p => p.id)).size, 4);
  assert.ok(placed.every(p => p.id < 0 && Math.max(Math.abs(p.tx), Math.abs(p.ty)) >= 3));
  for (const p of placed) {
    const ch = chunks.get(tileKey(Math.floor(p.tx / 16), Math.floor(p.ty / 16)));
    assert.ok(ch.props.includes(p)); assert.equal(ch.propAll.get(tileKey(p.tx, p.ty)), p); assert.equal(ch.propAt.get(tileKey(p.tx, p.ty)), p);
    assert.equal(ch.specials.length, 0);
  }
  const more = placeProps({ chunks, type: 'chest', want: 1, px: 0, py: 0, isFree: () => true });
  assert.ok(more[0].id < Math.min(...placed.map(p => p.id)));                         // next ids continue below existing ones
  const c2 = fakeChunks();
  const [bc] = placeProps({ chunks: c2, type: 'bigchest', want: 1, px: 0, py: 0, isFree: () => true });
  const home = c2.get(tileKey(Math.floor(bc.tx / 16), Math.floor(bc.ty / 16)));
  assert.deepEqual([home.props.length, home.propAll.size, home.propAt.size, home.specials.length], [1, 1, 1, 1]);
  assert.equal(bc.hp, Infinity); assert.equal(bc.destructible, false); assert.equal(bc.open, 0);
  // tile (-3,-3) -> x -80, y -68, as tested in game
  assert.deepEqual(makeProp('chest', -3, -3, -1), { id: -1, type: 'chest', tx: -3, ty: -3, kind: 0, x: -80, y: -68, r: 12, hp: 22, maxHp: 22,
    solid: true, flat: false, destructible: true, flash: 0, wiggle: 0, used: false, charge: 1, open: 0 });
});

test('spawns.chest: needs a live run and a live chunk map; count capped; bigChest stays gated', () => {
  const { w, api } = boot();
  api.set('spawns.count', 50);
  const r = api.set('spawns.chest');
  assert.equal(r.ok, true); assert.equal(r.info, '10 chest placed');                  // capped at LIMITS.chestMax
  assert.equal(total(w), 10);
  api.uninstall();
  assert.equal(total(w), 10);                                                          // uninstall leaves placed chests
  const b = boot(x => { x.World.chunk = () => null; });                                // stale map: the game does not know the chunk
  assert.match(b.api.set('spawns.chest').error, /stale/);
  b.api.uninstall();
  const c = boot(); c.w.Game.state = 'ui';
  assert.match(c.api.set('spawns.chest').error, /no run/);
  c.api.uninstall();
  const d = boot(); d.w.World.TS = 31;
  assert.match(d.api.set('spawns.chest').error, /tile size/);
  d.api.uninstall();
  assert.throws(() => liveChunks({ m: {} }), /unavailable/);
});

test('locator actions: info readout, no practice mark, refuse without a run', () => {
  const { w, api } = boot();
  w.chunks.get(tileKey(0, 0)).props.push({ type: 'bigchest', x: 301, y: 2, open: 0 });
  const r = api.set('locator.bigChest');
  assert.equal(r.ok, true); assert.equal(r.info, 'big chest 300px E, unlock 0.0/3.5');
  assert.equal(api.set('locator.radar').info, 'no shiny, boss or legend targets | no rift portal');
  w.seed.shiny = true; w.Rift.rift = { x: 1, y: 82, ttl: 30, t: 1 };
  assert.equal(api.set('locator.radar').info, 'shiny #19 5px SE | rift portal 80px S, ttl 30s');
  assert.deepEqual(w.calls.debugTime, []);
  w.Game.state = 'ui';
  assert.equal(api.set('locator.radar').ok, false);
  assert.equal(api.get('locator.bigChest').category, 'Locator');
  api.uninstall();
});

test('rift type select: 18 types; debugNextType then enterRequest; refuses an unknown value', () => {
  assert.equal(ARENA_TYPES.length, 18);
  const { w, api } = boot();
  const typed = [];
  w.Rift.debugNextType = t => typed.push(t);
  assert.deepEqual(api.get('spawns.riftType').options, [...ARENA_TYPES]);
  assert.equal(api.set('spawns.riftType', 'fire').ok, true);
  assert.match(api.set('spawns.riftType', 'plasma').error, /not in options/);
  const r = api.set('spawns.openRiftType');
  assert.equal(r.info, 'fire rift entered'); assert.deepEqual(typed, ['fire']); assert.equal(w.calls.enter, 1);
  w.Rift.inArena = true;
  assert.match(api.set('spawns.openRiftType').error, /rift/);                          // same guard as open rift
  api.uninstall();
  const b = boot(); const typed2 = []; b.w.Rift.debugNextType = t => typed2.push(t); b.w.Rift.enterRequest = () => {};
  assert.equal(b.api.set('spawns.openRiftType').info, 'no rift entered (blocked)');
  assert.deepEqual(typed2, ['normal', null]);                                          // type not left queued
  b.api.uninstall();
});

test('legend def: the game formula (clamped spd, ranged types, rounding)', () => {
  const bal = { legendHp: (i, t, n, a, b) => { assert.deepEqual([i, n, a, b], [0, 1, 0, 0]); return 345.6 + t; }, legendDmg: t => 20.4 + t };
  const rock = findLegend(fakeDex(), 377);
  assert.deepEqual(buildLegendDef(rock, 53, bal), { dex: 377, name: 'Regirock', hp: 399, spd: 48, dmg: 73, xp: 564, behavior: 'charger', shotDmg: 37, shotCd: 0.9, range: 300 });
  const mew = buildLegendDef(findLegend(fakeDex(), 150), 0, bal);
  assert.equal(mew.behavior, 'ranged'); assert.equal(mew.spd, Math.round(48 + 0.6 * 52));
  assert.equal(buildLegendDef({ ...rock, spd: 300 }, 0, bal).spd, 105);
  assert.equal(findLegend(fakeDex(), 25), null);                                        // not leg:true
  assert.equal(findLegend(null, 377), null);
  assert.throws(() => buildLegendDef(rock, NaN, bal), /unavailable/);
  assert.throws(() => buildLegendDef(rock, 1, { legendHp: () => NaN, legendDmg: () => 1 }), /unusable/);
});

test('spawns.riftBoss: builds the def, legend and guardS, mob cap, shiny', async () => {
  const { w, api } = boot();
  const before = w.EnemyMgr.count;
  const r = await api.set('spawns.riftBoss');
  assert.equal(r.ok, true, r.error);
  const e = w.EnemyMgr.list.at(-1);
  assert.deepEqual([w.EnemyMgr.count, e.boss, e.legend, e.guardS, e.flying, e.shiny], [before + 1, true, true, 55, false, false]);
  assert.deepEqual(e.sc, { hp: 1, spd: 1, dmg: 1 });
  assert.equal(e.def.name, 'Regirock'); assert.equal(e.def.hp, 114);
  api.set('spawns.riftBossDex', 25);
  assert.match((await api.set('spawns.riftBoss')).error, /not a legendary/);
  api.set('spawns.riftBossDex', 150); api.set('spawns.riftBossShiny', true);
  assert.equal((await api.set('spawns.riftBoss')).ok, true); assert.equal(w.EnemyMgr.list.at(-1).shiny, true);
  w.Sprites.hasShiny = () => false;
  assert.match((await api.set('spawns.riftBoss')).error, /no shiny sprite/);
  api.set('spawns.riftBossShiny', false);
  w.EnemyMgr.count = 99;
  assert.match((await api.set('spawns.riftBoss')).error, /mob limit/);
  api.uninstall();
});

test('coins: guest only, local amount, capped, never on a signed-in or mismatched save', () => {
  const { w, api } = boot();
  assert.equal(api.get('stats.coinsAmount').kind, 'slider');
  api.set('stats.coinsAmount', 99999999);
  assert.equal(api.get('stats.coinsAmount').value, 1000000);
  assert.equal(api.set('stats.coins').ok, true); assert.equal(w.save.coins, 1000000);
  w.Account.guest = false;
  const no = api.set('stats.coins');
  assert.equal(no.ok, false); assert.match(no.error, /only in guest mode/); assert.equal(w.save.coins, 1000000);
  w.Account.guest = 'true';                                                             // truthy is not enough
  assert.match(api.set('stats.coins').error, /only in guest mode/);
  w.Account.guest = true; w.Account.save = { coins: 1 };
  assert.match(api.set('stats.coins').error, /does not match/);
  assert.throws(() => guestSave(null, w.save), /guest/);
  w.Coop.active = true; w.Account.save = w.save;
  assert.match(api.set('stats.coins').error, /co-op/);
  assert.equal(w.save.coins, 1000000);
  api.uninstall();
});

test('missing new modules gate the new features visibly', () => {
  const m = boot(x => { for (const k of ['Chunks', 'Dex', 'Account']) x.objects.splice(x.objects.indexOf(x[k]), 1); }).api;
  assert.match(m.get('locator.bigChest').reason, /^not located on this build: .*Chunks/);
  assert.match(m.get('spawns.riftBoss').reason, /Dex/);
  assert.match(m.get('stats.coins').reason, /Account/);
  m.uninstall();
});

test('level up: local amount, one debugLevelUp per level, capped; locators are live', () => {
  let ups = 0;
  const { w, api } = boot(w => { w.Game.debugLevelUp = () => { ups++; }; });
  assert.equal(api.set('stats.levelUp').ok, true); assert.equal(ups, 1);
  api.set('stats.levelsAmount', 999);
  assert.equal(api.get('stats.levelsAmount').value, 50);
  const r = api.set('stats.levelUp');
  assert.equal(r.ok, true); assert.equal(ups, 51);
  w.Game.state = 'levelup';
  assert.equal(api.set('stats.levelUp').ok, false); assert.equal(ups, 51);   // only while playing
  assert.equal(api.get('locator.radar').live, true);
  assert.equal(api.get('stats.levelUp').live, false);
  api.uninstall();
});
