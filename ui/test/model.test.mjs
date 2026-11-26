import test from 'node:test';
import assert from 'node:assert/strict';
import { UI_TABS, uiGameOverlay, uiPresetName, uiPresetCollect, uiPresetSave, uiPresetDelete, uiPresetSerialize, uiPresetParse, uiPresetPlan, uiPresetSummary, uiGroupTabs, uiFormatValue, uiClampSlider, uiDecimals, uiStatusChips, uiResultNote, uiIsHotkey, uiClampPos, uiLoadPrefs, uiSavePref } from '../model.js';

const F = (id, category, kind, extra = {}) => ({ id, category, label: id, kind, value: kind === 'toggle' ? false : 1, enabled: true, reason: null, ...extra });

test('tabs keep their order', () => {
  const t = uiGroupTabs([]);
  assert.deepEqual(t.map(x => x.name), UI_TABS);
  assert.deepEqual(t[3].pending, []);
  assert.deepEqual(t[4].pending, []);
  assert.equal(t[0].pending.length, 0);
});

test('features group by category into settings, options and actions', () => {
  const t = uiGroupTabs([F('a', 'Spawns', 'action'), F('spawns.count', 'Spawns', 'slider', { scope: 'local' }), F('b', 'Spawns', 'toggle'), F('c', 'Stats', 'slider')]);
  const sp = t.find(x => x.name === 'Spawns');
  assert.deepEqual(sp.sections.map(s => s.title), ['Settings', 'Options', 'Actions']);
  assert.equal(sp.sections[1].rows[0].id, 'spawns.count');
  assert.equal(t.find(x => x.name === 'Stats').sections.length, 1);
});

test('an unknown category gets its own trailing tab', () => {
  const t = uiGroupTabs([F('x', 'Misc', 'toggle')]);
  assert.equal(t.at(-1).name, 'Misc');
  assert.equal(t.at(-1).sections[0].rows.length, 1);
});

test('formatValue and decimals', () => {
  assert.equal(uiFormatValue({ kind: 'toggle', value: true }), 'On');
  assert.equal(uiFormatValue({ kind: 'slider', value: 1.5, step: 0.5 }), '1.5');
  assert.equal(uiFormatValue({ kind: 'slider', value: 3, step: 1 }), '3');
  assert.equal(uiFormatValue({ kind: 'slider', value: NaN, step: 1 }), '');
  assert.equal(uiDecimals(0.25), 2);
  assert.equal(uiDecimals(1e-7), 7);
});

test('clampSlider matches core clamp and rejects non-numbers', () => {
  const f = { min: 1, max: 10, step: 0.5 };
  assert.equal(uiClampSlider(f, 99), 10);
  assert.equal(uiClampSlider(f, -4), 1);
  assert.equal(uiClampSlider(f, '2.3'), 2.5);
  assert.equal(uiClampSlider(f, ''), null);
  assert.equal(uiClampSlider(f, 'x'), null);
});

test('status chips', () => {
  const st = { build: { state: 'mismatch', seen: 'a', expected: 'b' }, player: { captured: true }, patches: 1, capture: { state: 'installed' }, modules: { missing: ['Rift'] } };
  const c = uiStatusChips(st);
  assert.deepEqual(c.map(x => [x.id, x.tone]), [['build', 'warn'], ['player', 'ok'], ['patches', 'idle'], ['modules', 'warn']]);
  assert.equal(c[2].text, '1 patch');
  assert.equal(c[0].title, 'Seen a, expected b');
  const u = uiStatusChips({ build: { state: 'unknown', expected: 'b' }, player: { captured: false }, patches: 0, modules: { missing: [] } });
  assert.equal(u[0].text, 'Build unknown');
  assert.equal(u[1].text, 'No player yet');
  assert.equal(u.length, 3);
  assert.deepEqual(uiStatusChips(null), []);
});

test('result notes', () => {
  assert.deepEqual(uiResultNote({ ok: false, error: 'no run in progress' }), { tone: 'error', text: 'no run in progress' });
  assert.deepEqual(uiResultNote({ ok: true, info: '5 spawned' }), { tone: 'ok', text: '5 spawned' });
  assert.equal(uiResultNote({ ok: true }), null);
});

test('hotkey ignores modifiers and key repeat', () => {
  assert.ok(uiIsHotkey({ key: 'F2' }));
  assert.ok(!uiIsHotkey({ key: 'F2', ctrlKey: true }));
  assert.ok(!uiIsHotkey({ key: 'F2', repeat: true }));
  assert.ok(!uiIsHotkey({ key: 'w' }));
});

test('clampPos keeps a grabbable part of the header on screen', () => {
  assert.deepEqual(uiClampPos({ x: 5000, y: 5000 }, 1000, 800, 344), { x: 952, y: 768 });
  assert.deepEqual(uiClampPos({ x: -5000, y: -5 }, 1000, 800, 344), { x: -296, y: 0 });
  assert.deepEqual(uiClampPos({ x: NaN, y: NaN }, 1000, 800, 344), { x: 16, y: 16 });
});

test('prefs round-trip under the ps.ui. prefix and survive broken storage', () => {
  const m = new Map();
  const s = { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) };
  uiSavePref(s, 'pos', { x: 3, y: 4 }); uiSavePref(s, 'open', '0'); uiSavePref(s, 'collapsed', '1'); uiSavePref(s, 'tab', 'Powers');
  assert.ok([...m.keys()].every(k => k.startsWith('ps.ui.')));
  assert.deepEqual(uiLoadPrefs(s), { pos: { x: 3, y: 4 }, open: false, collapsed: true, tab: 'Powers' });
  const bad = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(uiLoadPrefs(bad), { pos: null, open: true, collapsed: false, tab: 'Stats' });
  uiSavePref(bad, 'open', '1');
});

test('Presets is the sixth tab, after Locator', () => {
  assert.deepEqual(UI_TABS, ['Stats', 'Powers', 'Spawns', 'Automation', 'Locator', 'Presets']);
});

test('game overlay maps state to a label; menu and unknown have none', () => {
  assert.equal(uiGameOverlay('paused'), 'Game paused');
  assert.equal(uiGameOverlay('levelup'), 'Game paused · level-up');
  assert.equal(uiGameOverlay('choice'), 'Game paused · level-up');
  assert.equal(uiGameOverlay('over'), 'Run over');
  for (const s of ['playing', 'menu', '', null, undefined, 5]) assert.equal(uiGameOverlay(s), null);
});

test('preset names: trimmed, 1-40 characters', () => {
  assert.deepEqual(uiPresetName('  boss run '), { ok: true, name: 'boss run' });
  assert.equal(uiPresetName('   ').ok, false);
  assert.equal(uiPresetName(undefined).ok, false);
  assert.equal(uiPresetName('x'.repeat(40)).ok, true);
  assert.equal(uiPresetName('x'.repeat(41)).ok, false);
});

test('preset collect skips actions; save and delete return new stores; serialize round-trips', () => {
  const fs = [F('t', 'Stats', 'toggle', { value: true }), F('s', 'Stats', 'slider', { value: 2.5 }), F('a', 'Stats', 'action'), F('o', 'Spawns', 'select', { value: 'x' })];
  const v = uiPresetCollect(fs);
  assert.deepEqual(v, { t: true, s: 2.5, o: 'x' });
  const s1 = uiPresetSave({ version: 1, presets: {} }, 'a', v, 100);
  const s2 = uiPresetSave(s1, 'a', { t: false }, 200);
  assert.deepEqual(s1.presets.a, { savedAt: 100, values: v });
  assert.deepEqual(s2.presets.a, { savedAt: 200, values: { t: false } });
  assert.deepEqual(uiPresetDelete(s2, 'a').presets, {});
  assert.deepEqual(uiPresetParse(uiPresetSerialize(s1)), { ok: true, store: s1 });
});

test('preset parse: empty is fine, corrupt data is an error and never throws', () => {
  assert.deepEqual(uiPresetParse(null), { ok: true, store: { version: 1, presets: {} } });
  for (const bad of ['{', '[]', '{"version":2,"presets":{}}', '{"version":1,"presets":[]}', '{"version":1,"presets":{"a":{"savedAt":"x","values":{}}}}',
    '{"version":1,"presets":{"a":{"savedAt":1,"values":{"t":null}}}}', '{"version":1,"presets":{" a":{"savedAt":1,"values":{}}}}', '{"version":1,"presets":{"a":{"savedAt":1}}}']) {
    const r = uiPresetParse(bad);
    assert.equal(r.ok, false, bad);
    assert.match(r.error, /corrupt/);
  }
});

test('preset plan: reset at default, set otherwise, unknown ids and actions reported', () => {
  const fs = [F('t', 'Stats', 'toggle'), F('s', 'Stats', 'slider'), F('a', 'Stats', 'action')];
  const plan = uiPresetPlan({ t: false, s: 3, a: 1, gone: 1 }, fs, { t: false, s: 1 });
  assert.deepEqual(plan.ops, [{ id: 't', op: 'reset', value: false }, { id: 's', op: 'set', value: 3 }]);
  assert.deepEqual(plan.unknown, ['a', 'gone']);
});

test('preset summary counts applied and skipped with the reason', () => {
  const s = uiPresetSummary([{ ok: true }, { ok: true }, { ok: false, error: 'no run in progress' }], ['x']);
  assert.equal(s.tone, 'warn');
  assert.match(s.text, /^Applied 2, skipped 1 \(no run in progress\); 1 unknown ignored\. Load it during a run/);
  assert.deepEqual(uiPresetSummary([{ ok: true }]), { tone: 'ok', text: 'Applied 1' });
});
