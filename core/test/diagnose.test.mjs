import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnose, diagnoseHandle, splitKeys, DIAG_GROUPS } from '../diagnose.js';
import { keyNames } from '../diagnose.js';

class P { hurt() {} }
const cfg = { build: 'b1', modules: { A: { verified: 'b1' }, B: { verified: 'b1' }, C: { verified: 'b1' } },
  groups: [['GA', 'A', { keys: { x: 'x', f: 'f', skip: ['arr'] }, verified: 'b0' }], ['GB', 'B', { keys: { y: 'y' }, verified: 'b0' }]],
  player: { keys: { hp: 'hp', hurt: 'hurt', nope: 'nope' }, verified: 'b0' } };

test('splitKeys: in-only, prototype chain, no accessor read', () => {
  let read = 0;
  const o = Object.create({ f() {} }, { x: { get() { read++; return 1; }, enumerable: true } });
  assert.deepEqual(splitKeys(o, ['x', 'f', 'z']), { present: ['x', 'f'], absent: ['z'] });
  assert.equal(read, 0);
  assert.deepEqual(splitKeys(null, ['a']), { present: [], absent: ['a'] });
  assert.deepEqual(splitKeys(new Proxy({}, { has() { throw new Error('x'); } }), ['a']).absent, ['a']);
});

test('diagnose: ok, absent keys, missing and ambiguous modules, player', () => {
  const h = { m: { A: { x: 1 } }, missing: ['C'], ambiguous: { B: 3 }, build: { seen: 'b2' }, player: Object.assign(new P(), { hp: 1 }) };
  const r = diagnose(h, cfg);
  assert.deepEqual(JSON.parse(JSON.stringify(r)), r);
  assert.deepEqual(r.modules.A, { status: 'ok', matches: 1, verified: 'b1' });
  assert.deepEqual(r.modules.B, { status: 'ambiguous', matches: 3, verified: 'b1' });
  assert.equal(r.modules.C.status, 'missing');
  assert.deepEqual(r.groups[0].absent, ['f']);
  assert.equal(r.groups[1].located, false);
  assert.deepEqual(r.player.absent, ['nope']);
  assert.equal(r.build.state, 'mismatch');
  assert.equal(r.summary, '1 ok, 2 missing keys, 2 modules missing/ambiguous');
});

test('diagnose never throws, no player', () => {
  assert.equal(diagnose(null, cfg).summary, 'diagnose failed');
  const r = diagnose({ m: {}, missing: [], ambiguous: {}, build: { seen: null }, player: null }, cfg);
  assert.equal(r.player.captured, false);
  assert.equal(r.build.state, 'unknown');
});

test('real config: groups reference known modules, handle works', () => {
  const r = diagnoseHandle({ m: {}, missing: [], ambiguous: {}, build: { seen: null }, player: null });
  for (const [, mod] of DIAG_GROUPS) assert.ok(mod in r.modules, mod);
  assert.match(r.summary, /modules missing\/ambiguous$/);
});

test('keyNames skips provenance fields and state values', () => {
  assert.deepEqual(keyNames({ chunk: 'chunk', TS: 'TS', verified: 'c686e625ec', source: 'note' }), ['chunk', 'TS']);
  assert.deepEqual(keyNames({ keys: { state: 'state', playing: 'playing', st: 'st' }, verified: 'b' }), ['state', 'st']); // Game.state is a real key
});
