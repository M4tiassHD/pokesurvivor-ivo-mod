// smoke test against a tiny fake dom, not a layout check
import test from 'node:test';
import assert from 'node:assert/strict';
import { bundle } from '../../tools/build.mjs';
import { fakeFull, goodDoc } from '../../core/test/fake.mjs';
import { BUILD } from '../../core/config.js';

class El {
  constructor(tag) { this.tag = tag; this.kids = []; this.attrs = {}; this.ls = {}; this.style = {}; this.parent = null; this.text = ''; this.hidden = false;
    const set = new Set(); this.classList = { add: c => set.add(c), remove: c => set.delete(c), contains: c => set.has(c), toggle: (c, on) => { on ? set.add(c) : set.delete(c); } }; }
  append(...k) { for (const c of k) { if (typeof c === 'string') { this.text += c; continue; } c.parent = this; this.kids.push(c); } }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(t, f) { (this.ls[t] ||= []).push(f); }
  removeEventListener() {}
  attachShadow() { this.shadow = new El('#shadow'); this.shadow.host = this; return this.shadow; }
  remove() { if (this.parent) this.parent.kids = this.parent.kids.filter(k => k !== this); this.parent = null; }
  get isConnected() { let e = this; while (e.parent) e = e.parent; return e.tag === 'body'; }
  getRootNode() { return this; }
  set textContent(v) { this.kids = []; this.text = v; }
  get textContent() { return this.text + this.kids.map(k => k.textContent).join(''); }
  closest() { return null; }
  all(out = []) { out.push(this); for (const k of this.kids) k.all(out); if (this.shadow) this.shadow.all(out); return out; }
  fire(t, e = {}) { for (const f of this.ls[t] || []) f({ target: this, ...e }); }
}
function fakeHost() {
  const body = new El('body'), win = new El('window');
  win.innerWidth = 1280; win.innerHeight = 720; win.localStorage = { getItem: () => null, setItem() {} };
  const doc = { body, createElement: t => new El(t), defaultView: win, querySelector: goodDoc(BUILD).querySelector };
  return { host: { document: doc }, body, win };
}
const load = () => new Function(`${bundle()}\nreturn psInstall;`)();
const setup = () => { const h = fakeHost(); h.psInstall = load(); h.w = fakeFull(); h.opts = { host: h.host, doc: goodDoc(BUILD), allowLeads: true }; return h; };

test('ui:false mounts nothing and the api still works headless', () => {
  const { host, body, psInstall, w } = setup();
  const api = psInstall(w.objects, { host, doc: goodDoc(BUILD), allowLeads: true, ui: false });
  w.Combat.tick(0.016, w.player, 1);
  assert.equal(body.kids.length, 0);
  assert.equal(api.set('stats.xp', 2).ok, true);
  api.uninstall();
});

test('mount is idempotent, renders rows, and removes itself on disconnect', () => {
  const { host, body, win, psInstall, w, opts } = setup();
  const api = psInstall(w.objects, opts);
  w.Combat.tick(0.016, w.player, 1);
  assert.equal(body.kids.length, 1);
  assert.equal(psInstall(w.objects, opts), api);
  assert.equal(body.kids.length, 1);
  const root = body.kids[0].shadow;
  const all = root.all();
  assert.ok(all.some(e => e.tag === 'button' && e.text === 'Powers'));
  assert.ok(all.some(e => e.tag === 'button' && e.text === 'Disconnect'));
  assert.ok(all.filter(e => e.tag === 'input').length > 3);
  assert.ok(root.ls.keydown && root.ls.keyup);
  const slider = all.find(e => e.tag === 'input' && e.attrs.type === 'range');
  slider.value = '3'; slider.fire('input'); slider.fire('change');
  assert.equal(api.get('stats.damage').value, 3);
  assert.ok(win.ls.keydown);
  const disc = all.find(e => e.tag === 'button' && e.text.startsWith('Disconnect'));
  disc.fire('click'); disc.fire('click');
  assert.equal(body.kids.length, 0);
  assert.equal(api.status().installed, false);
});

test('uninstall from outside also removes the panel', () => {
  const { body, psInstall, w, opts } = setup();
  const api = psInstall(w.objects, opts);
  assert.equal(body.kids.length, 1);
  api.uninstall();
  assert.equal(body.kids.length, 0);
});

test('header glyphs are plain ASCII with accessible labels, title says IVO-mod', () => {
  const { body, psInstall, w, opts } = setup();
  const api = psInstall(w.objects, opts);
  const all = body.kids[0].shadow.all();
  const btn = label => all.find(e => e.tag === 'button' && e.attrs['aria-label'] === label);
  assert.equal(btn('Minimise').text, '\u2014');
  assert.equal(btn('Close').text, 'X');
  assert.ok(all.some(e => e.text === 'IVO-mod'));
  api.uninstall();
});

test('game state polling dims and blocks the body; menu and playing leave it usable', t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const { body, psInstall, w, opts } = setup();
  const api = psInstall(w.objects, opts);
  const all = body.kids[0].shadow.all();
  const veil = all.find(e => e.className === 'veil');
  const tabs = all.find(e => e.className === 'tabs'), bodyEl = all.find(e => e.className === 'body');
  assert.equal(veil.hidden, true);
  const gameState = s => { w.Game.state = s; t.mock.timers.tick(500); };
  gameState('paused');
  assert.equal(veil.hidden, false);
  assert.equal(veil.kids[0].text, 'Game paused');
  assert.ok('inert' in tabs.attrs && 'inert' in bodyEl.attrs);
  gameState('levelup');
  assert.equal(veil.kids[0].text, 'Game paused · level-up');
  gameState('over');
  assert.equal(veil.kids[0].text, 'Run over');
  gameState('playing');
  assert.equal(veil.hidden, true);
  gameState('menu');
  assert.equal(veil.hidden, true);
  api.uninstall();
});

test('Presets tab saves, lists, loads and deletes through the api; corrupt data shows an error', () => {
  const { host, body, win, psInstall, w, opts } = setup();
  const mem = new Map([['ps.ui.tab', 'Presets']]);
  win.localStorage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) };
  const api = psInstall(w.objects, opts);
  w.Combat.tick(0.016, w.player, 1);
  const root = () => body.kids[0].shadow;
  const btn = text => root().all().find(e => e.tag === 'button' && e.text === text);
  assert.ok(root().all().some(e => e.text.startsWith('No presets yet')));
  api.set('stats.damage', 3);
  const input = root().all().find(e => e.attrs['aria-label'] === 'Preset name');
  input.value = '  boss  '; btn('Save').fire('click');
  assert.deepEqual(Object.keys(JSON.parse(mem.get('ps.ui.presets')).presets), ['boss']);
  assert.equal(JSON.parse(mem.get('ps.ui.presets')).presets.boss.values['stats.damage'], 3);
  assert.ok(root().all().some(e => e.text === 'boss'));
  // existing name needs a 2nd click
  root().all().find(e => e.attrs['aria-label'] === 'Preset name').value = 'boss';
  btn('Save').fire('click');
  assert.equal(btn('Save'), undefined);
  api.reset('stats.damage');
  btn('Load').fire('click');
  return Promise.resolve().then(() => Promise.resolve()).then(() => {
    assert.equal(api.get('stats.damage').value, 3);
    btn('Delete').fire('click'); btn('Confirm delete').fire('click');
    assert.equal(JSON.parse(mem.get('ps.ui.presets')).presets.boss, undefined);
    mem.set('ps.ui.presets', '{oops');
    body.kids[0].shadow.all().find(e => e.attrs.role === 'tab' && e.text === 'Stats').fire('click');
    body.kids[0].shadow.all().find(e => e.attrs.role === 'tab' && e.text === 'Presets').fire('click');
    assert.ok(root().all().some(e => e.attrs.role === 'alert' && /corrupt/.test(e.text)));
    api.uninstall();
  });
});
