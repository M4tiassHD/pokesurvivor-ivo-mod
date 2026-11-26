import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pickCandidates, runLoader, TIMEOUT_MS } from '../loader.js';
import { bundle, userscript } from '../../tools/build.mjs';

const big = n => new Array(n).fill(0);
const KEY = Symbol.for('ps.core.installed');

test('header: only pokesurvivor, grant none', () => {
  const h = userscript(bundle()).split('==/UserScript==')[0];
  assert.deepEqual(h.match(/@match\s+(.*)/g), ['@match        https://pokesurvivor.com/*']);
  assert.match(h, /@grant\s+none\n/);
  assert.equal((h.match(/@grant/g) || []).length, 1);
  assert.match(h, /@version\s+\d+\.\d+\.\d+/);
});

test('generated file parses', () => {
  assert.doesNotThrow(() => new Function(readFileSync(new URL('../ivo-mod.user.js', import.meta.url), 'utf8')));
});

test('pickCandidates: order, size filter, tried, dedupe', () => {
  const a = big(1001), b = big(2000), small = big(1000), c = big(1500);
  const win = { temp3: b, ps: a, temp1: small, temp2: 'x', temp50: c, temp51: big(5000), temp4: a };
  assert.deepEqual(pickCandidates(win, new Set()), [a, b, c]);
  assert.deepEqual(pickCandidates(win, new Set([a])), [b, c]);
});

function harness(win, psInstall, t = { v: 0 }) {
  const logs = []; let fn = null, cleared = false;
  const l = runLoader({ win, psInstall, log: (...a) => logs.push(a.join(' ')), setInterval: f => { fn = f; return 1; }, clearInterval: () => { cleared = true; }, now: () => t.v });
  return { logs, l, polling: () => fn !== null && !cleared };
}
const mkApi = missing => ({ status: () => ({ modules: { missing } }), uninstall() { this.un = true; } });

test('success stops polling, no retry', () => {
  const win = { temp1: big(2000) }; let calls = 0;
  const h = harness(win, () => (calls++, mkApi([])));
  assert.match(h.logs[0], /Store as global variable|Waiting/);
  h.l.tick(); h.l.tick();
  assert.equal(calls, 1); assert.equal(h.polling(), false);
  assert.ok(h.logs.some(x => x.includes('Installed')));
});

test('missing modules: uninstall, skip stale, accept new tempN', () => {
  const win = { temp1: big(2000) }; const apis = [];
  const h = harness(win, () => { const a = mkApi(apis.length ? [] : ['Game']); apis.push(a); return a; });
  h.l.tick();
  assert.ok(apis[0].un); assert.ok(h.logs.some(x => x.includes('Game'))); assert.ok(h.polling());
  h.l.tick(); assert.equal(apis.length, 1); // stale array not retried
  win.temp2 = big(3000); h.l.tick();
  assert.equal(apis.length, 2); assert.equal(h.polling(), false);
});

test('already installed: logs, never polls', () => {
  const h = harness({ [KEY]: {} }, () => assert.fail('no install'));
  assert.ok(h.logs[0].includes('already installed')); assert.equal(h.polling(), false);
});

test('timeout after 10 minutes', () => {
  const t = { v: 0 }; const h = harness({}, () => assert.fail('no install'), t);
  h.l.tick(); assert.ok(h.polling());
  t.v = TIMEOUT_MS; h.l.tick();
  assert.equal(h.polling(), false); assert.ok(h.logs.at(-1).includes('Gave up'));
});
