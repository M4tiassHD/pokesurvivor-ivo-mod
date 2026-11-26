import { UI_TABS, UI_NOT_PORTED_REASON, uiIsLocal, uiGroupTabs, uiFormatValue, uiClampSlider, uiStatusChips, uiResultNote, uiIsHotkey, uiClampPos, uiLoadPrefs, uiSavePref, UI_PREFIX, UI_PRESETS_KEY, uiGameOverlay, uiPresetName, uiPresetCollect, uiPresetSave, uiPresetDelete, uiPresetSerialize, uiPresetParse, uiPresetPlan, uiPresetSummary } from './model.js';

// dom layer over core's api: state from list/get/status, actions through set/reset
const UI_KEY = Symbol.for('ps.ui.mounted');
const UI_WIDTH = 344;
const UI_NOTE_MS = 5000;
const UI_LIVE_MS = 500;
const UI_ISOLATED = ['keydown', 'keyup', 'keypress', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'wheel', 'touchstart'];

const UI_CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.panel { position: fixed; z-index: 2147483000; width: ${UI_WIDTH}px; max-width: calc(100vw - 16px); display: flex; flex-direction: column;
  background: #141a26; color: #e8ecf6; border: 1px solid #2f3a55; border-radius: 10px; box-shadow: 0 12px 40px rgba(0,0,0,.55);
  font: 13px/1.4 "Segoe UI Variable Text","Segoe UI",system-ui,sans-serif; overflow: hidden; }
.panel[hidden] { display: none; }
button, input { font: inherit; color: inherit; }
button { cursor: pointer; }
button:disabled, input:disabled { cursor: not-allowed; }
:focus-visible { outline: 2px solid #8fd3ff; outline-offset: 2px; }
.head { display: flex; align-items: center; gap: 8px; padding: 9px 10px 9px 14px; background: #1b2336; cursor: grab; user-select: none; touch-action: none; }
.head.drag { cursor: grabbing; }
.title { flex: 1; font-weight: 650; font-size: 14px; letter-spacing: .02em; }
.hint { color: #9aa6bf; font-size: 12px; }
.ibtn { width: 26px; height: 26px; border: 1px solid transparent; border-radius: 6px; background: transparent; display: grid; place-items: center; color: #c5cee2; }
.ibtn:hover { background: #26304a; border-color: #37446a; }
.strip { display: flex; flex-wrap: wrap; gap: 4px 12px; padding: 8px 14px; border-bottom: 1px solid #263048; background: #111724; }
.chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #c5cee2; }
.chip i { width: 8px; height: 8px; border-radius: 50%; background: #7d8aa6; flex: none; }
.chip.ok i { background: #4fd1b0; box-shadow: 0 0 6px #4fd1b088; }
.chip.warn i { background: #f0b64a; }
.tabs { display: flex; padding: 0 4px; border-bottom: 1px solid #263048; overflow-x: auto; scrollbar-width: none; }
.tab { flex: 1 0 auto; white-space: nowrap; padding: 9px 5px 8px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #9aa6bf; font-size: 12px; }
.tab:hover { color: #e8ecf6; }
.tab[aria-selected="true"] { color: #fff; border-bottom-color: #4fd1b0; font-weight: 600; }
.body { overflow-y: auto; max-height: min(58vh, 480px); padding: 6px 14px 10px; scrollbar-width: thin; scrollbar-color: #37446a transparent; }
.sect { margin: 12px 0 2px; font-size: 12px; color: #9aa6bf; display: flex; align-items: center; gap: 8px; }
.sect::after { content: ""; flex: 1; height: 1px; background: #263048; }
.row { padding: 7px 0; border-bottom: 1px solid #1d2638; }
.row:last-child { border-bottom: 0; }
.line { display: flex; align-items: center; gap: 10px; min-height: 26px; }
.name { flex: 1; min-width: 0; }
.val { font-variant-numeric: tabular-nums; color: #4fd1b0; min-width: 3.5ch; text-align: right; }
.note { font-size: 12px; margin-top: 3px; color: #9aa6bf; overflow-wrap: anywhere; }
.note:empty { display: none; }
.note.error { color: #ff9a9a; }
.note.ok { color: #7fe0c6; }
.switch { position: relative; flex: none; width: 40px; height: 22px; }
.switch input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: inherit; }
.track { position: absolute; inset: 0; border-radius: 11px; background: #2c3750; border: 1px solid #44527a; transition: background .12s; pointer-events: none; }
.thumb { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; border: 1.5px solid #0e1320;
  background: radial-gradient(circle, #0e1320 0 2px, #f4f6fb 2.5px 3.5px, transparent 4px), linear-gradient(#ee5a5a 0 46%, #0e1320 46% 54%, #f4f6fb 54%);
  transition: transform .12s; }
.switch input:checked ~ .track { background: #1d6b5c; border-color: #4fd1b0; }
.switch input:checked ~ .thumb { transform: translateX(18px); }
.switch input:focus-visible ~ .track { outline: 2px solid #8fd3ff; outline-offset: 2px; }
.switch input:disabled ~ .track, .switch input:disabled ~ .thumb { opacity: .5; }
input[type=range] { width: 100%; margin: 4px 0 0; accent-color: #4fd1b0; }
input[type=number] { width: 84px; padding: 4px 6px; background: #0f1522; border: 1px solid #44527a; border-radius: 6px; text-align: right; font-variant-numeric: tabular-nums; }
.btn { padding: 6px 12px; background: #243049; border: 1px solid #44527a; border-radius: 7px; color: #e8ecf6; }
.btn:hover:not(:disabled) { background: #2d3b5c; border-color: #6a7cae; }
.btn:disabled { opacity: .5; }
.act { width: 100%; text-align: left; }
.sm { padding: 2px 8px; font-size: 12px; }
.foot { display: flex; gap: 8px; align-items: center; padding: 9px 14px; border-top: 1px solid #263048; background: #111724; }
.foot .note { flex: 1; margin: 0; }
.danger.armed { background: #5a2330; border-color: #ff8f8f; }
.main { position: relative; }
.veil { position: absolute; inset: 0; z-index: 2; display: grid; place-items: center; background: rgba(10,14,24,.72); cursor: not-allowed; }
.veil[hidden] { display: none; }
.veil span { padding: 6px 14px; border: 1px solid #f0b64a; border-radius: 8px; background: #141a26; color: #ffe3a6; font-weight: 600; }
.main.veiled .tabs, .main.veiled .body { opacity: .45; }
.field { flex: 1; min-width: 0; padding: 5px 8px; background: #0f1522; border: 1px solid #44527a; border-radius: 6px; }
.pname { font-weight: 600; overflow-wrap: anywhere; }
.pmeta { font-size: 12px; color: #9aa6bf; }
.pbtns { display: flex; gap: 6px; margin-top: 6px; }
.empty { padding: 10px 0; color: #9aa6bf; }
.note.warn { color: #f0c46a; }
.btn.armed { background: #5a2330; border-color: #ff8f8f; }
.panel.collapsed .strip, .panel.collapsed .main, .panel.collapsed .foot { display: none; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

function uiEl(doc, tag, props, ...kids) {
  const e = doc.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v);
  }
  for (const c of kids) if (c) e.append(c);
  return e;
}

function uiShowNote(noteEl, note, ms = UI_NOTE_MS) {
  clearTimeout(noteEl._t);
  noteEl.className = note ? `note ${note.tone}` : 'note';
  noteEl.textContent = note ? note.text : '';
  if (note) noteEl._t = setTimeout(() => { noteEl.textContent = ''; noteEl.className = 'note'; }, ms);
}

// returns {el, update(view)}; pending rows pass {pending:true}
function uiMakeRow(doc, api, f, afterChange) {
  const id = f.id;
  const row = uiEl(doc, 'div', { class: 'row' });
  const note = uiEl(doc, 'div', { class: 'note', role: 'status' });
  const why = uiEl(doc, 'div', { class: 'note' });
  const run = r => Promise.resolve(r).then(res => { uiShowNote(note, uiResultNote(res)); afterChange(); return res; });
  const view = () => api.get(id);
  let update, liveTimer = null;

  if (f.pending || f.kind === 'toggle') {
    const input = uiEl(doc, 'input', { type: 'checkbox', role: 'switch', 'aria-label': f.label });
    const sw = uiEl(doc, 'span', { class: 'switch' }, input, uiEl(doc, 'span', { class: 'track' }), uiEl(doc, 'span', { class: 'thumb' }));
    row.append(uiEl(doc, 'label', { class: 'line' }, uiEl(doc, 'span', { class: 'name', text: f.label }), sw));
    if (f.pending) { input.disabled = true; why.textContent = UI_NOT_PORTED_REASON; }
    else input.addEventListener('change', () => run(input.checked ? api.set(id, true) : api.reset(id)));
    update = v => { input.checked = !!v.value; input.disabled = !v.enabled; why.textContent = v.reason || ''; };
  } else if (f.kind === 'slider' && uiIsLocal(f)) {
    const input = uiEl(doc, 'input', { type: 'number', min: f.min, max: f.max, step: f.step, 'aria-label': f.label });
    row.append(uiEl(doc, 'label', { class: 'line' }, uiEl(doc, 'span', { class: 'name', text: f.label }), input));
    input.addEventListener('change', () => {
      const n = uiClampSlider(view(), input.value);
      if (n === null) { update(view()); return; }
      run(api.set(id, n));
    });
    update = v => { if (input.getRootNode().activeElement !== input) input.value = v.value; input.disabled = !v.enabled; why.textContent = v.reason || ''; };
  } else if (f.kind === 'slider') {
    const out = uiEl(doc, 'output', { class: 'val' });
    const input = uiEl(doc, 'input', { type: 'range', min: f.min, max: f.max, step: f.step, 'aria-label': f.label });
    const reset = uiEl(doc, 'button', { class: 'btn sm', type: 'button', 'aria-label': `Reset ${f.label} to default`, text: 'Reset' });
    let dragging = false;
    row.append(uiEl(doc, 'div', { class: 'line' }, uiEl(doc, 'span', { class: 'name', text: f.label }), out, reset), input);
    input.addEventListener('input', () => { dragging = true; out.textContent = uiFormatValue({ ...view(), value: Number(input.value) }); });
    input.addEventListener('change', () => { // apply on release
      dragging = false;
      const n = uiClampSlider(view(), input.value);
      if (n === null) { update(view()); return; }
      run(api.set(id, n));
    });
    reset.addEventListener('click', () => run(api.reset(id)));
    update = v => { if (!dragging) { input.value = v.value; out.textContent = uiFormatValue(v); } input.disabled = reset.disabled = !v.enabled; why.textContent = v.reason || ''; };
  } else if (f.kind === 'select') {
    const sel = uiEl(doc, 'select', { 'aria-label': f.label });
    for (const o of f.options) sel.append(uiEl(doc, 'option', { value: String(o), text: String(o) }));
    row.append(uiEl(doc, 'label', { class: 'line' }, uiEl(doc, 'span', { class: 'name', text: f.label }), sel));
    sel.addEventListener('change', () => run(api.set(id, f.options.find(o => String(o) === sel.value))));
    update = v => { sel.value = String(v.value); sel.disabled = !v.enabled; why.textContent = v.reason || ''; };
  } else {
    const btn = uiEl(doc, 'button', { class: 'btn act', type: 'button', text: f.label });
    row.append(btn);
    btn.addEventListener('click', () => {
      btn.disabled = true;
      run(api.set(id)).then(() => update(view()), () => update(view()));
    });
    update = v => { btn.disabled = !v.enabled; why.textContent = v.reason || ''; };
    if (f.live) { // re-run the readout every UI_LIVE_MS, note outlives one period so it does not blink
      const input = uiEl(doc, 'input', { type: 'checkbox', role: 'switch', 'aria-label': `Live ${f.label}` });
      const sw = uiEl(doc, 'span', { class: 'switch' }, input, uiEl(doc, 'span', { class: 'track' }), uiEl(doc, 'span', { class: 'thumb' }));
      row.append(uiEl(doc, 'label', { class: 'line' }, uiEl(doc, 'span', { class: 'name', text: 'Live' }), sw));
      const tick = () => Promise.resolve(api.set(id)).then(res => uiShowNote(note, uiResultNote(res), UI_LIVE_MS * 4));
      input.addEventListener('change', () => {
        clearInterval(liveTimer); liveTimer = null;
        if (input.checked) { tick(); liveTimer = setInterval(tick, UI_LIVE_MS); }
      });
      const plain = update;
      update = v => { plain(v); input.disabled = !v.enabled; if (!v.enabled && input.checked) { input.checked = false; clearInterval(liveTimer); liveTimer = null; } };
    }
  }
  row.append(why, note);
  update(f.pending ? { ...f, enabled: false, reason: UI_NOT_PORTED_REASON } : f);
  return { el: row, update: f.pending ? () => {} : update, stop: () => clearInterval(liveTimer) };
}

function uiBuild(api, host, doc) {
  const win = doc.defaultView || globalThis;
  const store = (() => { try { return win.localStorage; } catch { return null; } })() || { getItem: () => null, setItem: () => {} };
  const prefs = uiLoadPrefs(store);
  const rootEl = doc.createElement('div');
  rootEl.id = 'ps-mod-panel';
  const shadow = rootEl.attachShadow({ mode: 'open' });
  shadow.append(uiEl(doc, 'style', { text: UI_CSS }));

  const panel = uiEl(doc, 'section', { class: 'panel', role: 'region', 'aria-label': 'IVO-mod panel' });
  const collapseBtn = uiEl(doc, 'button', { class: 'ibtn', type: 'button', 'aria-label': 'Minimise', 'aria-expanded': 'true', text: '\u2014' });
  const closeBtn = uiEl(doc, 'button', { class: 'ibtn', type: 'button', 'aria-label': 'Close', title: 'Close (F2 shows it again)', text: 'X' });
  const head = uiEl(doc, 'div', { class: 'head' }, uiEl(doc, 'span', { class: 'title', text: 'IVO-mod' }), uiEl(doc, 'span', { class: 'hint', text: 'F2' }), collapseBtn, closeBtn);
  const strip = uiEl(doc, 'div', { class: 'strip', role: 'status', 'aria-label': 'Connection status' });
  const tabsEl = uiEl(doc, 'div', { class: 'tabs', role: 'tablist', 'aria-label': 'Categories' });
  const body = uiEl(doc, 'div', { class: 'body', role: 'tabpanel', tabindex: '0' });
  const footNote = uiEl(doc, 'div', { class: 'note', role: 'status' });
  const resetBtn = uiEl(doc, 'button', { class: 'btn', type: 'button', text: 'Reset all' });
  const discBtn = uiEl(doc, 'button', { class: 'btn danger', type: 'button', text: 'Disconnect' });
  const foot = uiEl(doc, 'div', { class: 'foot' }, resetBtn, discBtn, footNote);
  const veilLabel = uiEl(doc, 'span', { role: 'status' });
  const veil = uiEl(doc, 'div', { class: 'veil' }, veilLabel);
  veil.hidden = true;
  const main = uiEl(doc, 'div', { class: 'main' }, tabsEl, body, veil);
  panel.append(head, strip, main, foot);
  shadow.append(panel);

  // keep panel input away from the game
  for (const t of UI_ISOLATED) shadow.addEventListener(t, e => e.stopPropagation());

  let rows = [];
  let tab = prefs.tab;
  let groups = [];
  const tabButtons = new Map();

  const refresh = () => {
    strip.textContent = '';
    for (const c of uiStatusChips(api.status())) strip.append(uiEl(doc, 'span', { class: `chip ${c.tone}`, title: c.title }, uiEl(doc, 'i', {}), uiEl(doc, 'span', { text: c.text })));
    for (const r of rows) { const v = api.get(r.id); if (v) r.update(v); }
  };

  function renderTab() {
    body.textContent = '';
    for (const r of rows) r.stop();
    rows = [];
    const g = groups.find(x => x.name === tab) || groups[0];
    body.setAttribute('aria-label', g.name);
    if (g.name === 'Presets') renderPresets();
    else for (const s of g.sections) {
      if (g.sections.length > 1) body.append(uiEl(doc, 'div', { class: 'sect', text: s.title }));
      for (const f of s.rows) { const r = uiMakeRow(doc, api, f, refresh); r.id = f.id; rows.push(r); body.append(r.el); }
    }
    if (g.name !== 'Presets' && g.pending.length) {
      for (const label of g.pending) body.append(uiMakeRow(doc, api, { id: `pending.${label}`, label, kind: 'toggle', pending: true }, refresh).el);
    }
    for (const [n, b] of tabButtons) { b.setAttribute('aria-selected', String(n === g.name)); b.tabIndex = n === g.name ? 0 : -1; }
    refresh();
  }

  const defaults = Object.fromEntries(api.list().filter(f => f.kind !== 'action').map(f => [f.id, f.default]));
  const readPresets = () => { let t = null; try { t = store.getItem(UI_PREFIX + UI_PRESETS_KEY); } catch { /* blocked */ } return uiPresetParse(t); };
  const writePresets = st => { try { store.setItem(UI_PREFIX + UI_PRESETS_KEY, uiPresetSerialize(st)); return true; } catch { return false; } };
  let armedBtn = null, armedLabel = '', armedTimer = null, flash = null;
  const disarmBtn = () => { clearTimeout(armedTimer); if (armedBtn) { armedBtn.classList.remove('armed'); armedBtn.textContent = armedLabel; } armedBtn = null; };
  // two-click confirm, 2nd click within 4 s runs fn; needs() false runs it at once
  const confirmClick = (btn, label, armText, fn, needs = () => true) => {
    btn.addEventListener('click', () => {
      if (armedBtn === btn || !needs()) { disarmBtn(); fn(); return; }
      disarmBtn(); armedBtn = btn; armedLabel = label; btn.classList.add('armed'); btn.textContent = armText;
      armedTimer = setTimeout(disarmBtn, 4000);
    });
  };

  function renderPresets() {
    disarmBtn();
    const parsed = readPresets();
    const note = uiEl(doc, 'div', { class: 'note', role: 'status' });
    const input = uiEl(doc, 'input', { type: 'text', class: 'field', 'aria-label': 'Preset name', placeholder: 'Preset name', autocomplete: 'off' });
    if (flash) { uiShowNote(note, flash); flash = null; }
    const saveBtn = uiEl(doc, 'button', { class: 'btn', type: 'button', text: 'Save' });
    body.append(uiEl(doc, 'div', { class: 'sect', text: 'Save current values' }), uiEl(doc, 'div', { class: 'line' }, input, saveBtn), note);
    const save = (name, where) => {
      const next = uiPresetSave(parsed.store, name, uiPresetCollect(api.list()), Date.now());
      if (!writePresets(next)) { uiShowNote(where, { tone: 'error', text: 'Could not write to browser storage' }); return; }
      flash = { tone: 'ok', text: `Saved "${name}"` };
      renderTab();
    };
    confirmClick(saveBtn, 'Save', 'Overwrite?', () => {
      const n = uiPresetName(input.value);
      if (n.ok) save(n.name, note); else uiShowNote(note, { tone: 'error', text: n.error });
    }, () => { const n = uiPresetName(input.value); return n.ok && n.name in parsed.store.presets; });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') saveBtn.click(); });
    body.append(uiEl(doc, 'div', { class: 'sect', text: 'Saved presets' }));
    if (!parsed.ok) {
      const clear = uiEl(doc, 'button', { class: 'btn danger', type: 'button', text: 'Clear saved presets' });
      confirmClick(clear, 'Clear saved presets', 'Confirm clear', () => { writePresets(uiPresetParse(null).store); renderTab(); });
      body.append(uiEl(doc, 'div', { class: 'note error', role: 'alert', text: parsed.error }), clear);
      saveBtn.disabled = input.disabled = true;
      return;
    }
    const names = Object.keys(parsed.store.presets).sort((a, b) => a.localeCompare(b));
    if (!names.length) body.append(uiEl(doc, 'div', { class: 'empty', text: 'No presets yet. Type a name above and save the current values.' }));
    for (const name of names) {
      const p = parsed.store.presets[name];
      const load = uiEl(doc, 'button', { class: 'btn sm', type: 'button', 'aria-label': `Load preset ${name}`, text: 'Load' });
      const over = uiEl(doc, 'button', { class: 'btn sm', type: 'button', 'aria-label': `Overwrite preset ${name} with current values`, text: 'Overwrite' });
      const del = uiEl(doc, 'button', { class: 'btn sm', type: 'button', 'aria-label': `Delete preset ${name}`, text: 'Delete' });
      const rnote = uiEl(doc, 'div', { class: 'note', role: 'status' });
      load.addEventListener('click', () => {
        const plan = uiPresetPlan(p.values, api.list(), defaults);
        const run = o => o.op === 'reset' ? api.reset(o.id) : api.set(o.id, o.value);
        const one = o => Promise.resolve(run(o)).then(r => ({ id: o.id, ok: !!(r && r.ok), error: r && r.error }), e => ({ id: o.id, ok: false, error: String((e && e.message) || e) }));
        Promise.all(plan.ops.map(one)).then(res => { refresh(); uiShowNote(rnote, uiPresetSummary(res, plan.unknown), 12000); });
      });
      confirmClick(over, 'Overwrite', 'Confirm', () => save(name, rnote));
      confirmClick(del, 'Delete', 'Confirm delete', () => { writePresets(uiPresetDelete(parsed.store, name)); renderTab(); });
      body.append(uiEl(doc, 'div', { class: 'row' }, uiEl(doc, 'div', { class: 'pname', text: name }),
        uiEl(doc, 'div', { class: 'pmeta', text: `${Object.keys(p.values).length} values, saved ${new Date(p.savedAt).toLocaleString()}` }), uiEl(doc, 'div', { class: 'pbtns' }, load, over, del), rnote));
    }
  }

  function buildTabs() {
    groups = uiGroupTabs(api.list()).filter(g => UI_TABS.includes(g.name) || g.sections.length);
    if (!groups.some(g => g.name === tab)) tab = groups[0].name;
    tabsEl.textContent = '';
    tabButtons.clear();
    for (const g of groups) {
      const b = uiEl(doc, 'button', { class: 'tab', type: 'button', role: 'tab', text: g.name });
      b.addEventListener('click', () => { tab = g.name; uiSavePref(store, 'tab', tab); renderTab(); });
      b.addEventListener('keydown', e => {
        const i = groups.findIndex(x => x.name === tab), d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        tab = groups[(i + d + groups.length) % groups.length].name;
        uiSavePref(store, 'tab', tab); renderTab(); tabButtons.get(tab).focus();
      });
      tabButtons.set(g.name, b);
      tabsEl.append(b);
    }
  }

  const place = p => { const q = uiClampPos(p, win.innerWidth, win.innerHeight, UI_WIDTH); panel.style.left = `${q.x}px`; panel.style.top = `${q.y}px`; return q; };
  let pos = place(prefs.pos || { x: win.innerWidth - UI_WIDTH - 16, y: 16 });
  const setCollapsed = c => { panel.classList.toggle('collapsed', c); collapseBtn.setAttribute('aria-expanded', String(!c)); collapseBtn.setAttribute('aria-label', c ? 'Restore' : 'Minimise'); uiSavePref(store, 'collapsed', c ? '1' : '0'); };
  const setOpen = o => { panel.hidden = !o; uiSavePref(store, 'open', o ? '1' : '0'); };
  setCollapsed(prefs.collapsed);
  setOpen(prefs.open);
  collapseBtn.addEventListener('click', () => setCollapsed(!panel.classList.contains('collapsed')));
  closeBtn.addEventListener('click', () => setOpen(false));

  head.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('button')) return;
    const dx = e.clientX - pos.x, dy = e.clientY - pos.y;
    head.classList.add('drag');
    head.setPointerCapture(e.pointerId);
    const move = ev => { pos = place({ x: ev.clientX - dx, y: ev.clientY - dy }); };
    const up = () => { head.classList.remove('drag'); head.removeEventListener('pointermove', move); head.removeEventListener('pointerup', up); head.removeEventListener('pointercancel', up); uiSavePref(store, 'pos', pos); };
    head.addEventListener('pointermove', move); head.addEventListener('pointerup', up); head.addEventListener('pointercancel', up);
  });

  let armTimer = null;
  const disarm = () => { clearTimeout(armTimer); discBtn.classList.remove('armed'); discBtn.textContent = 'Disconnect'; };
  resetBtn.addEventListener('click', () => {
    const bad = api.resetAll().filter(([, r]) => !r.ok);
    uiShowNote(footNote, bad.length ? { tone: 'error', text: `${bad.length} could not reset: ${bad[0][1].error}` } : { tone: 'ok', text: 'All features reset' });
    refresh();
  });
  discBtn.addEventListener('click', () => {
    if (!discBtn.classList.contains('armed')) {
      discBtn.classList.add('armed'); discBtn.textContent = 'Confirm disconnect';
      armTimer = setTimeout(disarm, 4000);
      return;
    }
    disarm();
    api.uninstall();
    ui.destroy();
  });

  // on window (capture) so the hotkey works while hidden
  const onKey = e => { if (uiIsHotkey(e)) { e.preventDefault(); e.stopPropagation(); setOpen(panel.hidden); } };
  const onResize = () => { pos = place(pos); };
  win.addEventListener('keydown', onKey, true);
  win.addEventListener('resize', onResize);

  const unsub = api.subscribe(() => {
    if (!api.status().installed) { ui.destroy(); return; }
    refresh();
  });

  // poll game state, dim the body while paused / level-up / game over
  let veilText = null;
  const pollState = () => {
    let label = null;
    try { label = uiGameOverlay(api.status().game.state); } catch { /* status unavailable: no overlay */ }
    if (label === veilText) return;
    veilText = label;
    veil.hidden = !label;
    veilLabel.textContent = label || '';
    main.classList.toggle('veiled', !!label);
    for (const e of [tabsEl, body]) { if (label) e.setAttribute('inert', ''); else e.removeAttribute('inert'); }
  };
  const pollTimer = setInterval(pollState, 500);

  const ui = {
    api, el: rootEl,
    destroy() {
      unsub();
      for (const r of rows) r.stop();
      clearInterval(pollTimer);
      clearTimeout(armedTimer);
      clearTimeout(armTimer);
      win.removeEventListener('keydown', onKey, true);
      win.removeEventListener('resize', onResize);
      rootEl.remove();
      if (host[UI_KEY] === ui) delete host[UI_KEY];
    },
  };

  buildTabs();
  renderTab();
  pollState();
  doc.body.append(rootEl);
  return ui;
}

function uiMount(api, opts) {
  opts = opts || {};
  const host = opts.host || globalThis;
  const doc = host.document;
  if (!doc || !doc.body || typeof doc.createElement !== 'function' || !api.status().installed) return null;
  const prev = host[UI_KEY];
  if (prev && prev.api === api && prev.el.isConnected) return prev;
  if (prev) prev.destroy();
  try {
    const ui = uiBuild(api, host, doc);
    host[UI_KEY] = ui;
    return ui;
  } catch (e) {
    console.warn('[IVO-mod] panel failed to mount:', e); // a panel failure must not break the install
    return null;
  }
}
