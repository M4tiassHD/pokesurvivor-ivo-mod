import test from 'node:test';
import assert from 'node:assert/strict';
import { install } from '../index.js';
import { BUILD, LEADS } from '../config.js';
import { bundle } from '../../tools/build.mjs';
import { mobLimit, roomFor, radialAngles, rotate, dueEvery, ringSpots, clampInt } from '../features/common.js';
import { fakeFull, goodDoc } from './fake.mjs';

function boot(extra = {}, mutate) {
  const w = fakeFull();
  if (mutate) mutate(w);
  const api = install(w.objects, { host: {}, doc: goodDoc(BUILD), allowLeads: true, ...extra });
  w.Combat.tick(0.016, w.player, 1); // capture the player (tick arg 1)
  return { w, api };
}

test('stats: ratio from base, inverse for attack speed, hp fills, reset restores', () => {
  const { w, api } = boot();
  const p = w.player;
  assert.equal(api.set('stats.attackSpeed', 2).ok, true);
  assert.equal(p.cdMul, 0.5);
  api.set('stats.movement', 2); assert.equal(p.spdMul, 3);
  api.set('stats.pickup', 2); assert.equal(p.magnet, 156);
  api.set('stats.xp', 99); assert.equal(p.xpMul, 50);
  api.set('stats.hp', 2); assert.deepEqual([p.maxHp, p.hp], [180, 180]);
  api.set('stats.hp', 3); assert.equal(p.maxHp, 270);       // ratio from the captured base, not compounding
  p.hp = 10;
  api.reset('stats.hp');
  assert.deepEqual([p.maxHp, p.hp], [90, 10]);
  api.resetAll();
  assert.deepEqual([p.cdMul, p.spdMul, p.magnet, p.xpMul], [1, 1.5, 78, 1]);
  p.cdMul = NaN;
  assert.match(api.set('stats.attackSpeed', 2).error, /positive finite/);
  api.uninstall();
});

test('gating: lead, unknown, missing module; allowLeads lifts only leads; status lists leads', () => {
  const closed = boot({ allowLeads: false }).api;
  assert.equal(closed.get('powers.arsenal').enabled, true);      // leads confirmed in game
  assert.equal(closed.get('powers.god').enabled, true);          // no lead names needed
  assert.equal(closed.get('powers.radial').enabled, true);       // leads all confirmed or dropped
  assert.equal(closed.get('powers.defeatAll').enabled, true);
  const st = closed.status().leads;
  assert.equal(st.allowed, false);
  const names = st.inUse.map(l => l.name);
  assert.deepEqual(names, []);
  assert.ok(st.inUse.every(l => l.state === 'lead' && l.verified === null && l.name in LEADS));
  closed.uninstall();

  const { api, w } = boot();
  assert.equal(api.get('powers.arsenal').enabled, true);
  assert.equal(api.get('stats.coins').enabled, true);                 // guest detection found
  assert.equal(api.get('spawns.riftBoss').enabled, true);
  assert.equal(api.get('spawns.chest').enabled, true);
  assert.equal(api.get('spawns.bigChest').enabled, true);        // insert and unlock tested in game
  api.uninstall();

  const m = boot({}, x => { x.objects.splice(x.objects.indexOf(x.Pickups), 1); }).api;
  assert.equal(m.get('powers.vacuum').reason, 'not located on this build: Pickups');
  m.uninstall();
});

test('god: installed once captured, blocks player hurt only, restored on reset and uninstall', () => {
  const { w, api } = boot();
  const proto = Object.getPrototypeOf(w.player), orig = proto.hurt;
  assert.equal(api.set('powers.god', true).ok, true);
  assert.notEqual(proto.hurt, orig);
  w.player.hurt(10); assert.equal(w.player.hp, 90);
  const other = Object.create(proto); other.hp = 50; other.hurt(10); assert.equal(other.hp, 40);
  api.reset('powers.god');
  assert.equal(proto.hurt, orig);
  w.player.hurt(10); assert.equal(w.player.hp, 80);
  api.set('powers.god', true);
  api.uninstall();
  assert.equal(proto.hurt, orig);
  assert.equal(api.status().patches, 0);
});

test('stasis: enemy update skipped, restored; no enemy gates the install', () => {
  const { w, api } = boot();
  const proto = Object.getPrototypeOf(w.seed), orig = proto.update;
  assert.equal(api.set('powers.stasis', true).ok, true);
  w.seed.update(0.1); assert.equal(w.seed.updated, 0);
  api.reset('powers.stasis');
  assert.equal(proto.update, orig);
  w.seed.update(0.1); assert.equal(w.seed.updated, 1);
  w.EnemyMgr.list.length = 0;
  assert.match(api.set('powers.stasis', true).error, /no enemy to read/);
  assert.equal(proto.update, orig);
  api.uninstall();
});

test('tick hub: arsenal and area apply during the tick only; vacuum every 0.5 s while playing', () => {
  let tickOrig;
  const { w, api } = boot({}, x => { tickOrig = x.Combat.tick; });
  const seen = [];
  w.calls.probe = pl => seen.push({ ag: typeof pl.activeGroup === 'function' ? pl.activeGroup().length : null, sz: w.mv.size });
  api.set('powers.arsenal', true); api.set('powers.area', 2); api.set('powers.vacuum', true);
  assert.equal(api.status().patches, 3);                          // capture x2 + one shared tick wrap
  w.Combat.tick(0.016, w.player, 2);
  assert.deepEqual(seen.at(-1), { ag: 1, sz: 14 });
  assert.deepEqual([w.mv.size, 'activeGroup' in w.player], [7, false]);
  assert.equal(w.calls.pull, 1);
  w.Combat.tick(0.016, w.player, 3); assert.equal(w.calls.pull, 1);
  w.Game.st.time = 13.1; w.Combat.tick(0.016, w.player, 4); assert.equal(w.calls.pull, 2);
  w.Game.st.time = 14; w.Game.state = 'levelup'; w.Combat.tick(0.016, w.player, 5); assert.equal(w.calls.pull, 2);
  w.Game.state = 'playing';
  w.Combat.tick(0.016, {}, 6);                                    // not the captured player: untouched
  assert.deepEqual(seen.at(-1), { ag: null, sz: 7 });
  api.reset('powers.arsenal'); api.reset('powers.area');
  assert.equal(api.status().patches, 3);                          // vacuum still on
  api.reset('powers.vacuum');
  assert.equal(api.status().patches, 2);
  api.set('powers.area', 3);
  api.uninstall();
  assert.equal(w.Combat.tick, tickOrig);
});

test('projectiles: radial copies, homing/pierce on a copy, owner filter, 650 cap, restore', () => {
  const { w, api } = boot();
  const orig = w.Projectiles.spawn;
  api.set('powers.radial', 3); api.set('powers.homing', 5); api.set('powers.pierce', 99);
  assert.equal(api.get('powers.pierce').value, 30);
  const shot = { owner: w.player, vx: 3, vy: 4, hits: new Set() };
  w.Projectiles.spawn(shot);
  assert.equal(w.Projectiles.list.length, 4);
  assert.equal(shot.homing, undefined);                           // the caller's object is not mutated
  const [a, ...copies] = w.Projectiles.list;
  assert.deepEqual([a.homing, a.pierce], [5, 30]);
  for (const c of copies) assert.ok(Math.abs(Math.hypot(c.vx, c.vy) - 5) < 1e-9 && c.hits !== a.hits);
  const foreign = { owner: {}, vx: 1, vy: 1 };
  w.Projectiles.spawn(foreign);
  assert.equal(w.Projectiles.list.at(-1), foreign);
  assert.equal(w.Projectiles.list.length, 5);
  w.Projectiles.list.length = 0; w.Projectiles.list.push(...Array(649).fill({}));
  w.Projectiles.spawn({ owner: w.player, vx: 1, vy: 0 });
  assert.equal(w.Projectiles.list.length, 650);                   // cap reached after the original
  api.resetAll();
  assert.equal(w.Projectiles.spawn, orig);
  api.uninstall();
});

test('spawn rate scales dt; shiny chance rolls on add; both restored', () => {
  const { w, api } = boot();
  const upd = w.Spawner.update, add = w.EnemyMgr.add;
  api.set('spawns.rate', 4);
  w.Spawner.update(0.5); assert.equal(w.calls.updateDt, 2);
  w.Spawner.update(-1); assert.equal(w.calls.updateDt, -1);
  api.set('spawns.shinyChance', 100);
  const mk = (dex, extra = {}) => Object.assign(new w.seed.constructor({ dex, hp: 1, behavior: 'chase' }, 0, 0, {}), extra);
  const a = mk(25), nosprite = mk(7), boss = mk(25, { boss: true }), thief = mk(25, { behavior: 'thief' });
  for (const e of [a, nosprite, boss, thief]) w.EnemyMgr.add(e);
  assert.deepEqual([a, nosprite, boss, thief].map(e => e.shiny), [true, false, false, false]);
  api.resetAll();
  assert.equal(w.Spawner.update, upd);
  assert.equal(w.EnemyMgr.add, add);
  api.uninstall();
});

test('actions: heal, loot, max moves, evolve, clear normal, defeat all, death', async () => {
  const { w, api } = boot();
  w.player.hp = 5;
  assert.equal(api.set('powers.heal').ok, true); assert.equal(w.player.hp, 90);
  api.set('powers.loot'); assert.equal(w.calls.pull, 1);
  assert.equal(api.set('powers.maxMoves').info, '2 move levels added'); assert.equal(w.mv.lvl, 3);
  assert.equal(api.set('powers.evolve').info, '1 moves evolved');
  const mk = extra => Object.assign(new w.seed.constructor({ dex: 1, hp: 3, behavior: 'chase' }, 0, 0, {}), extra);
  const shiny = mk({ shiny: true }), thief = mk({ behavior: 'thief' }), legend = mk({ legend: true }), norm = mk();
  w.EnemyMgr.list.push(shiny, thief, legend, norm);
  api.set('powers.clearNormal');
  assert.deepEqual([w.seed, shiny, thief, legend, norm].map(e => e.dead), [true, false, false, false, true]);
  api.set('powers.defeatAll');
  assert.deepEqual([shiny, thief, legend].map(e => e.dead), [true, true, true]);
  w.player.anim = { play: (...a) => { w.calls.anim = a; } };
  assert.equal(api.set('powers.death').ok, true);
  assert.deepEqual([w.player.hp, w.player.dead, 'reviveT' in w.player, w.calls.clear], [0, true, false, 1]);
  assert.deepEqual(w.calls.anim, ['Faint', { hold: true }]);
  assert.match(api.set('powers.heal').error, /dead/);
  api.uninstall();
});

test('every modded run action marks the practice flag; guards refuse co-op and arena', () => {
  const { w, api } = boot();
  api.set('powers.loot');
  assert.deepEqual(w.calls.debugTime, [12.5]);
  w.Coop.active = true;
  assert.match(api.set('powers.loot').error, /co-op/);
  w.Coop.active = false; w.Rift.inArena = true;
  assert.match(api.set('spawns.swarm').error, /rift/);
  assert.equal(w.calls.burst.length, 0);
  api.uninstall();
});

test('spawn chosen species: recipe, mob cap clamp, shiny, local settings need no run', async () => {
  const { w, api } = boot();
  assert.equal(api.set('spawns.dex', 25).ok, true);
  assert.equal(api.set('spawns.count', 1).ok, true);
  const r = await api.set('spawns.species');
  assert.equal(r.ok, true);
  const e = w.EnemyMgr.list.at(-1);
  assert.deepEqual([e.dex, e.x, e.y, e.sc, e.def.hp], [25, 71, 2, { hp: 1.5, spd: 1.1, dmg: 1.2 }, 22.5]);
  assert.notEqual(e.sc, w.seed.sc);
  assert.equal(e.shiny, false);
  api.set('spawns.count', 50);                                    // CAP 4 -> limit 14, 2 present -> 12
  assert.equal((await api.set('spawns.species')).ok, true);
  assert.equal(w.EnemyMgr.count, 14);
  assert.match((await api.set('spawns.species')).error, /mob limit/);
  assert.equal(w.EnemyMgr.count, 14);
  w.EnemyMgr.list.length = 1; w.EnemyMgr.count = 1;
  api.set('spawns.count', 2);
  assert.equal((await api.set('spawns.shinyPack')).ok, true);
  assert.deepEqual(w.EnemyMgr.list.slice(1).map(x => x.shiny), [true, true]);
  api.set('spawns.dex', 7);
  assert.match((await api.set('spawns.shinyPack')).error, /no shiny sprite/);
  api.set('spawns.dex', 25);
  w.Game.state = 'paused';
  const g = await api.set('spawns.species');
  assert.match(g.error, /no run/);
  api.uninstall();
});

test('async spawn re-checks the run after the await', async () => {
  const { w, api } = boot();
  w.Sprites.preload = async () => { w.player.dead = true; };
  const r = await api.set('spawns.species');
  assert.match(r.error, /dead/);
  assert.equal(w.EnemyMgr.count, 1);
  api.uninstall();
});

test('wild swarm uses burst within the room, treasure carriers follow the recipe', async () => {
  const { w, api } = boot();
  api.set('spawns.count', 5);
  assert.equal(api.set('spawns.swarm').info, '5 spawned');
  assert.deepEqual(w.calls.burst, [5]);
  api.set('spawns.count', 50);
  assert.equal(api.set('spawns.swarm').info, '8 spawned');        // 14 - 6
  assert.match(api.set('spawns.swarm').error, /mob limit/);
  w.EnemyMgr.list.length = 1; w.EnemyMgr.count = 1;
  api.set('spawns.count', 2);
  assert.equal((await api.set('spawns.treasureGholdengo')).ok, true);
  const t = w.EnemyMgr.list.at(-1);
  assert.deepEqual([t.dex, t.behavior, t.def.loot, t.life, t.def.hp, t.sc], [1000, 'thief', 'ticket10', 15, Math.round(60 * (1 + 12.5 / 95) * 1.5), { hp: 1, spd: 1, dmg: 1 }]);
  assert.equal(w.EnemyMgr.count, 3);
  assert.equal((await api.set('spawns.treasureMeowth')).ok, true);
  assert.equal(w.EnemyMgr.list.at(-1).def.loot, 'coins');
  w.World.isFree = () => false;
  assert.match((await api.set('spawns.treasureGholdengo')).error, /no free spawn/);
  api.uninstall();
  const closed = boot({ allowLeads: false }).api;
  assert.equal(closed.get('spawns.treasureMeowth').enabled, true); // confirmed in game
  closed.uninstall();
});

test('open rift and gacha force shiny (menu scope: no run needed, solo only)', () => {
  const { w, api } = boot();
  assert.equal(api.set('spawns.openRift').info, 'rift entered');
  assert.equal(w.calls.enter, 1);
  assert.match(api.set('spawns.openRift').error, /rift/);          // now in the arena
  w.Rift.inArena = false; w.Game.state = 'paused'; w.player.dead = true;
  api.set('spawns.gachaCount', 7);
  assert.equal(api.set('spawns.gachaForceShiny').ok, true);
  assert.deepEqual(w.calls.force, [7]);
  assert.deepEqual(w.calls.debugTime, [12.5, 12.5].slice(0, w.calls.debugTime.length)); // no practice mark for the menu action
  w.Coop.active = true;
  assert.match(api.set('spawns.gachaForceShiny').error, /co-op/);
  w.Coop.active = false;
  api.reset('spawns.gachaForceShiny');
  assert.deepEqual(w.calls.force, [7, 0]);
  api.uninstall();
  assert.deepEqual(w.calls.force, [7, 0]);
});

test('uninstall restores every wrapped method', () => {
  const w = fakeFull();
  const snap = () => [w.Combat.tick, w.Game.startRun, w.Spawner.update, w.EnemyMgr.add, w.Projectiles.spawn,
    Object.getPrototypeOf(w.player).hurt, Object.getPrototypeOf(w.seed).update];
  const before = snap();
  const api = install(w.objects, { host: {}, doc: goodDoc(BUILD), allowLeads: true });
  w.Combat.tick(0.016, w.player, 1);
  for (const [id, v] of [['powers.god', true], ['powers.stasis', true], ['powers.arsenal', true], ['powers.radial', 2],
    ['spawns.rate', 2], ['spawns.shinyChance', 10]]) assert.equal(api.set(id, v).ok, true, id);
  assert.ok(api.status().patches >= 8);
  api.uninstall();
  assert.deepEqual(snap(), before);
  assert.equal(api.status().patches, 0);
});

test('helpers: mob cap, room, radial math, timing, ring, clamp', () => {
  assert.equal(mobLimit(64), 74);
  assert.equal(mobLimit(500), 256);
  assert.ok(Number.isNaN(mobLimit(0)) && Number.isNaN(mobLimit(NaN)) && Number.isNaN(mobLimit(undefined)));
  assert.equal(roomFor(10, 14, 50), 4);
  assert.equal(roomFor(14, 14, 5), 0);
  assert.equal(roomFor(20, 14, 5), 0);
  assert.equal(roomFor(1, NaN, 5), 0);
  assert.deepEqual(radialAngles(0), []);
  assert.equal(radialAngles(3).length, 3);
  assert.ok(Math.abs(radialAngles(1)[0] - Math.PI) < 1e-12);
  const [x, y] = rotate(1, 0, Math.PI / 2);
  assert.ok(Math.abs(x) < 1e-12 && Math.abs(y - 1) < 1e-12);
  assert.ok(dueEvery(1, NaN, 0.5) && dueEvery(1, 5, 0.5) && !dueEvery(1, 0.8, 0.5) && dueEvery(1.5, 1, 0.5) && !dueEvery(NaN, 0, 0.5));
  assert.deepEqual(ringSpots(10, 20, 1, 70), [{ x: 80, y: 20 }]);
  assert.equal(ringSpots(0, 0, 4, 1).length, 4);
  assert.equal(clampInt(99.9, 1, 50), 50);
  assert.throws(() => clampInt('x', 1, 5));
});

test('bundle with the new features runs against the fakes', () => {
  const psInstall = new Function(`${bundle()}\nreturn psInstall;`)();
  const w = fakeFull();
  const api = psInstall(w.objects, { host: {}, doc: goodDoc(BUILD), allowLeads: true });
  w.Combat.tick(0.016, w.player, 1);
  assert.equal(api.set('stats.xp', 3).ok, true);
  assert.equal(w.player.xpMul, 3);
  assert.ok(api.list().length >= 30);
  api.uninstall();
});

test('stat multipliers carry over to the new player of a new run', () => {
  const { w, api } = boot();
  const fresh = () => Object.assign(new w.player.constructor(), { xpNext: 15, maxHp: 90, moves: [], hp: 90, x: 1, y: 2, dead: false,
    atkMul: 2, cdMul: 1, spdMul: 1.5, magnet: 78, xpMul: 1, statsTaken: {} });
  assert.equal(api.set('stats.attackSpeed', 10).ok, true);
  assert.equal(api.set('stats.damage', 3).ok, true);
  w.Game.startRun();
  const p2 = fresh();
  w.Combat.tick(0.016, p2, 2);
  assert.deepEqual([p2.cdMul, p2.atkMul, p2.spdMul], [0.1, 6, 1.5]); // only the changed sliders, on the new base
  // captured while not playing, held until a later tick passes the run guard
  w.Game.startRun(); w.Game.state = 'levelup';
  const p3 = fresh();
  w.Combat.tick(0.016, p3, 3);
  assert.equal(p3.cdMul, 1);
  w.Game.state = 'playing';
  w.Combat.tick(0.016, p3, 4);
  assert.deepEqual([p3.cdMul, p3.atkMul], [0.1, 6]);
  api.uninstall();
  assert.deepEqual([p3.cdMul, p3.atkMul], [1, 2]);             // reset restores the latest player's base
});
