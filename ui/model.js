// panel logic, no dom. same bundle scope as core so top-level names get a ui prefix

export const UI_TABS = ['Stats', 'Powers', 'Spawns', 'Automation', 'Locator', 'Presets'];
export const UI_NOT_PORTED_REASON = 'not ported yet';
// planned features with no core feature yet, shown as disabled rows
export const UI_NOT_PORTED = {};
// scope 'local' = panel-side input that feeds actions, shown under Options
export const uiIsLocal = f => f.scope === 'local';

// one entry per tab, plus 'Other' only if a category is not in the layout
export function uiGroupTabs(features) {
  const names = [...UI_TABS];
  for (const f of features) if (!names.includes(f.category)) names.push(f.category);
  return names.map(name => {
    const mine = features.filter(f => f.category === name);
    const sections = [
      ['Settings', mine.filter(f => f.kind !== 'action' && !uiIsLocal(f))],
      ['Options', mine.filter(uiIsLocal)],
      ['Actions', mine.filter(f => f.kind === 'action')],
    ].filter(s => s[1].length).map(([title, rows]) => ({ title, rows }));
    return { name, sections, pending: UI_NOT_PORTED[name] || [] };
  });
}

export function uiDecimals(step) {
  const s = String(step);
  const e = s.match(/e-(\d+)$/);
  if (e) return Number(e[1]);
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
}

export function uiFormatValue(f) {
  if (f.kind === 'toggle') return f.value ? 'On' : 'Off';
  if (f.kind === 'slider') return Number.isFinite(f.value) ? f.value.toFixed(uiDecimals(f.step)) : '';
  if (f.kind === 'select') return String(f.value);
  return '';
}

// same as core clampValue; null = not a number
export function uiClampSlider(f, v) {
  const n = Number(v);
  if (v === '' || v === null || !Number.isFinite(n)) return null;
  let r = Math.min(f.max, Math.max(f.min, n));
  if (f.step > 0) r = Math.min(f.max, f.min + Math.round((r - f.min) / f.step) * f.step);
  return Number(r.toFixed(6));
}

// status -> header chips, tone: ok | warn | idle
export function uiStatusChips(st) {
  if (!st) return [];
  const b = st.build || {};
  const chips = [];
  if (b.state === 'match') chips.push({ id: 'build', text: 'Build matches', tone: 'ok', title: `Build ${b.seen}` });
  else if (b.state === 'mismatch') chips.push({ id: 'build', text: 'Build mismatch', tone: 'warn', title: `Seen ${b.seen}, expected ${b.expected}` });
  else chips.push({ id: 'build', text: 'Build unknown', tone: 'warn', title: `Expected ${b.expected}` });
  const cap = (st.capture && st.capture.state) || '';
  const got = !!(st.player && st.player.captured);
  chips.push({ id: 'player', text: got ? 'Player found' : 'No player yet', tone: got ? 'ok' : 'idle', title: cap ? `Capture: ${cap}` : '' });
  const n = Number.isFinite(st.patches) ? st.patches : 0;
  chips.push({ id: 'patches', text: n === 1 ? '1 patch' : `${n} patches`, tone: 'idle', title: 'Game functions currently wrapped' });
  const miss = (st.modules && st.modules.missing) || [];
  if (miss.length) chips.push({ id: 'modules', text: `${miss.length} modules missing`, tone: 'warn', title: miss.join(', ') });
  return chips;
}

// set/reset result -> {tone, text}, null if nothing to say
export function uiResultNote(r) {
  if (!r) return { tone: 'error', text: 'No result' };
  if (!r.ok) return { tone: 'error', text: r.error || 'Failed' };
  return r.info ? { tone: 'ok', text: String(r.info) } : null;
}

export function uiIsHotkey(e, key = 'F2') {
  return !!e && e.key === key && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && !e.repeat;
}

// keep `grab` px of the header on screen so it can be dragged back
export function uiClampPos(p, vw, vh, w, grab = 48) {
  const x = Math.min(Math.max(Number.isFinite(p.x) ? p.x : 16, grab - w), Math.max(grab - w, vw - grab));
  const y = Math.min(Math.max(Number.isFinite(p.y) ? p.y : 16, 0), Math.max(0, vh - 32));
  return { x, y };
}

export const UI_PREFIX = 'ps.ui.';
export function uiLoadPrefs(storage) {
  const get = k => { try { return storage.getItem(UI_PREFIX + k); } catch { return null; } };
  let pos = null;
  try { pos = JSON.parse(get('pos')); } catch { /* ignore */ }
  return {
    pos: pos && Number.isFinite(pos.x) && Number.isFinite(pos.y) ? { x: pos.x, y: pos.y } : null,
    open: get('open') !== '0',
    collapsed: get('collapsed') === '1',
    tab: UI_TABS.includes(get('tab')) ? get('tab') : UI_TABS[0],
  };
}
export function uiSavePref(storage, key, value) {
  try { storage.setItem(UI_PREFIX + key, typeof value === 'string' ? value : JSON.stringify(value)); } catch { /* storage blocked */ }
}

// game state -> overlay label, null for playing / menu / unknown
export function uiGameOverlay(state) {
  if (state === 'paused') return 'Game paused';
  if (state === 'levelup' || state === 'choice') return 'Game paused · level-up';
  if (state === 'over') return 'Run over';
  return null;
}

// store shape: {version:1, presets:{name:{savedAt, values:{id:value}}}}
export const UI_PRESETS_KEY = 'presets';
export const UI_PRESET_MAX = 40;

export function uiPresetName(raw) {
  const name = typeof raw === 'string' ? raw.trim() : '';
  if (!name) return { ok: false, error: 'Enter a name' };
  if (name.length > UI_PRESET_MAX) return { ok: false, error: `Name is longer than ${UI_PRESET_MAX} characters` };
  return { ok: true, name };
}

// {id: value} for every non-action feature
export function uiPresetCollect(features) {
  const values = {};
  for (const f of features) if (f.kind !== 'action') values[f.id] = f.value;
  return values;
}

export const uiPresetEmpty = () => ({ version: 1, presets: {} });

export function uiPresetSave(store, name, values, now) {
  return { version: 1, presets: { ...store.presets, [name]: { savedAt: now, values: { ...values } } } };
}
export function uiPresetDelete(store, name) {
  const presets = { ...store.presets };
  delete presets[name];
  return { version: 1, presets };
}
export const uiPresetSerialize = store => JSON.stringify(store);

const uiPlain = o => o !== null && typeof o === 'object' && !Array.isArray(o);
// raw localStorage text or null, never throws: {ok:true, store} | {ok:false, error}
export function uiPresetParse(text) {
  if (text === null || text === undefined || text === '') return { ok: true, store: uiPresetEmpty() };
  let d;
  try { d = JSON.parse(text); } catch { return { ok: false, error: 'Saved presets are corrupt (not valid JSON)' }; }
  if (!uiPlain(d) || d.version !== 1 || !uiPlain(d.presets)) return { ok: false, error: 'Saved presets are corrupt (unexpected format)' };
  const presets = {};
  for (const [name, p] of Object.entries(d.presets)) {
    if (!uiPresetName(name).ok || name !== name.trim() || !uiPlain(p) || !Number.isFinite(p.savedAt) || !uiPlain(p.values)) return { ok: false, error: `Saved presets are corrupt (preset "${name.slice(0, 40)}")` };
    const values = {};
    for (const [id, v] of Object.entries(p.values)) {
      if (typeof v !== 'boolean' && typeof v !== 'string' && !(typeof v === 'number' && Number.isFinite(v))) return { ok: false, error: `Saved presets are corrupt (value "${id}")` };
      values[id] = v;
    }
    presets[name] = { savedAt: p.savedAt, values };
  }
  return { ok: true, store: { version: 1, presets } };
}

// returns {ops:[{id, op:'reset'|'set', value}], unknown:[id]}; actions and ids core dropped count as unknown
export function uiPresetPlan(values, features, defaults) {
  const byId = new Map(features.map(f => [f.id, f]));
  const ops = [], unknown = [];
  for (const [id, value] of Object.entries(values)) {
    const f = byId.get(id);
    if (!f || f.kind === 'action') { unknown.push(id); continue; }
    ops.push({ id, op: id in defaults && defaults[id] === value ? 'reset' : 'set', value });
  }
  return { ops, unknown };
}

export function uiPresetSummary(results, unknown = []) {
  const bad = results.filter(r => !r.ok);
  const reasons = [...new Set(bad.map(r => r.error || 'failed'))];
  let text = `Applied ${results.length - bad.length}`;
  if (bad.length) text += `, skipped ${bad.length} (${reasons.join('; ')})`;
  if (unknown.length) text += `${bad.length ? '; ' : ', '}${unknown.length} unknown ignored`;
  if (reasons.includes('no run in progress')) text += '. Load it during a run to apply the rest';
  return { tone: bad.length || unknown.length ? 'warn' : 'ok', text };
}
