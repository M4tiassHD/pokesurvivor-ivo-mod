// fakes that satisfy the config predicates
class Player { hurt(d) { this.hp -= d; } heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); } }
export class FakeEnemy {
  constructor(def, x, y, sc, boss = false) {
    Object.assign(this, { def, dex: def.dex, x, y, sc, hp: def.hp, dead: false, shiny: false, boss, behavior: def.behavior, updated: 0 });
  }
  update() { this.updated++; }
  die() { this.dead = true; }
  makeShiny() { this.shiny = true; }
}

export function fakeWorld(over = {}) {
  const player = Object.assign(new Player(), { xpNext: 15, maxHp: 90, moves: [], hp: 90, x: 1, y: 2, dead: false, atkMul: 2,
    cdMul: 1, spdMul: 1.5, magnet: 78, xpMul: 1, statsTaken: {} });
  const calls = { debugTime: [], tick: 0, startRun: 0 };
  const Game = {
    state: 'playing', st: { time: 12.5 },
    startRun() { calls.startRun++; }, togglePause() {},
    debugTime(t) { calls.debugTime.push(t); },
  };
  const Combat = { tick(dt, pl, now) { calls.tick++; if (calls.probe) calls.probe(pl); return [dt, pl, now]; },
    resolve() {}, ghostCast() {}, ghostOrbit() {}, updateFields() {} };
  const Coop = { active: false, puppets: [], mates: [] };
  const Rift = { inArena: false, debugSkipTo() {}, enterRequest() {} };
  const Judgment = { judgedText: '' }; // real Judgment also has 'active', which would make the Coop predicate ambiguous
  const objects = [{ junk: 1 }, 5, null, 'str', Game, Combat, Coop, Rift, Judgment];
  Object.assign(Game, over.Game);
  return { objects, player, calls, Game, Combat, Coop, Rift, Judgment };
}

export const goodDoc = v => ({
  querySelector: () => ({ getAttribute: () => (v === null ? '/js/app.min.js' : `/js/app.min.js?v=${v}`) }),
});

// every module Stats/Powers/Spawns need, plus an enemy to read the class from
export function fakeFull() {
  const w = fakeWorld(), calls = w.calls;
  Object.assign(calls, { pull: 0, burst: [], force: [], enter: 0, levelUp: 0, evolve: 0, spawn: [], clear: 0 });
  const seed = new FakeEnemy({ dex: 19, hp: 10, behavior: 'chase' }, 5, 5, { hp: 1.5, spd: 1.1, dmg: 1.2 });
  const EnemyMgr = { list: [seed], count: 1, bossAlive: false, shinies() { return []; },
    add(e) { this.list.push(e); this.count = this.list.length; }, all() { return this.list; } };
  const Spawner = { CAP: 4, burst(n) { calls.burst.push(n); for (let i = 0; i < n; i++) EnemyMgr.add(new FakeEnemy({ dex: 1, hp: 1, behavior: 'chase' }, 0, 0, {})); },
    update(dt) { calls.updateDt = dt; } };
  const Pickups = { pullAll() { calls.pull++; } };
  const mv = { lvl: 1, def: { maxLvl: 3 }, size: 7 };
  w.player.moves.push(mv);
  const Moves = { levelUp(m) { if (m.lvl >= m.def.maxLvl) return false; m.lvl++; calls.levelUp++; return true; },
    evoInfo(m) { return { ready: true }; }, evolve() { calls.evolve++; return true; } };
  const Projectiles = { list: [], all() { return this.list; }, spawn(o) { this.list.push(o); return o; }, clearOrbs() { calls.clear++; } };
  const Sprites = { hasShiny: dex => dex !== 7, async preload() {} };
  const Enemies = { bagAt() { return []; }, defForDex: (dex, t) => ({ dex, hp: 10 + t, behavior: 'chase' }) };
  const Gacha = { costOf() {}, pool() {}, debugForceShiny(n) { calls.force.push(n); } };
  const chunks = fakeChunks();
  const World = { TS: 32, CW: 512, isFree: () => true, breakProp() {}, chunk: (cx, cy, peek) => chunks.get(0x200000 * (cx + 0x100000) + (cy + 0x100000)) || null };
  const save = { coins: 0, upgrades: {}, pstat: {} };
  const Account = { guest: true, syncState: 'local', save, loggedIn: true };
  const Dex = fakeDex();
  const Balance = { legendHp: (idx, t, n, a, b) => 100 + idx + t + n, legendDmg: t => 10 + t, guardS: { legend: idx => 55 + idx } };
  Object.assign(w.Rift, { enterRequest() { calls.enter++; w.Rift.inArena = true; } });
  w.Combat.tick = function (dt, pl, now) { calls.tick++; if (calls.probe) calls.probe(pl); };
  const extra = { EnemyMgr, Spawner, Pickups, Moves, Projectiles, Sprites, Enemies, Gacha, World, seed, mv, chunks, Chunks: chunks, save, Account, Dex, Balance };
  w.objects.push(save, chunks, Dex, Balance, Account, EnemyMgr, Spawner, Pickups, Moves, Projectiles, Sprites, Enemies, Gacha, World);
  return Object.assign(w, extra);
}

// 4 floor chunks around the origin (cx, cy in -1..0)
export function fakeChunks() {
  const m = new Map();
  for (const cx of [-1, 0]) for (const cy of [-1, 0]) {
    m.set(0x200000 * (cx + 0x100000) + (cy + 0x100000), { cx, cy, terr: new Uint8Array(256), props: [], propAt: new Map(), propAll: new Map(), specials: [], liquids: [], use: 0 });
  }
  return m;
}
export function fakeDex() {
  const a = Array.from({ length: 1082 }, (_, i) => ({ dex: i + 1, name: `mon${i + 1}`, types: ['normal'], hp: 50, spd: 78, bst: 300 }));
  a[376] = { ...a[376], name: 'Regirock', types: ['rock'], spd: 50, leg: true }; // dex 377
  a[149] = { ...a[149], name: 'Mewtwo', types: ['psychic'], spd: 130, leg: true }; // dex 150
  return a;
}
