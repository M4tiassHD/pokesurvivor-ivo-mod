import { MODULES, LEADS, CONFIRMED, GAME } from './config.js';
import { diagnoseHandle } from './diagnose.js';
import { canAct, canMenuAct, markPractice } from './run.js';

const KINDS = ['toggle', 'slider', 'action', 'select'];
// run = canAct + markPractice, menu = solo only, local = UI setting, never touches the game
const SCOPES = ['run', 'menu', 'local'];
const ownKey = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

export function defineFeature(d) {
  const bad = m => { throw new Error(`feature ${d && d.id}: ${m}`); };
  if (!d || typeof d.id !== 'string' || !d.id) bad('id required');
  if (!KINDS.includes(d.kind)) bad('bad kind');
  if (!Array.isArray(d.needs) || d.needs.some(n => !(n in MODULES))) bad('needs must list known modules');
  if (typeof d.apply !== 'function' || typeof d.reset !== 'function') bad('apply and reset required');
  if (d.kind === 'slider' && ![d.min, d.max, d.step, d.default].every(Number.isFinite)) bad('slider needs finite min/max/step/default');
  if (d.kind === 'select' && !(Array.isArray(d.options) && d.options.length)) bad('select needs options');
  if (d.leads !== undefined && !(Array.isArray(d.leads) && d.leads.every(n => ownKey(LEADS, n) || CONFIRMED.has(n)))) bad('leads must name registered or confirmed leads');
  if (d.unknown !== undefined && !(Array.isArray(d.unknown) && d.unknown.every(n => typeof n === 'string' && n))) bad('unknown must be strings');
  if (d.scope !== undefined && !SCOPES.includes(d.scope)) bad('bad scope');
  return Object.freeze({ category: 'Misc', label: d.id, leads: [], unknown: [], scope: 'run', ...d });
}

export function clampValue(f, v) {
  if (f.kind === 'toggle') return !!v;
  if (f.kind === 'action') return undefined;
  if (f.kind === 'select') {
    if (!f.options.includes(v)) throw new Error('value not in options');
    return v;
  }
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error('value not a finite number');
  let r = Math.min(f.max, Math.max(f.min, n));
  if (f.step > 0) r = Math.min(f.max, f.min + Math.round((r - f.min) / f.step) * f.step);
  return Number(r.toFixed(6));
}

export function createApi({ h, features, cleanup, expectedBuild, captureLeads = [] }) {
  const byId = new Map(features.map(f => [f.id, f]));
  const dflt = f => (f.kind === 'toggle' ? !!f.default : f.default);
  const values = new Map(features.map(f => [f.id, dflt(f)]));
  const subs = new Set();
  const emit = () => { for (const fn of [...subs]) try { fn(); } catch { /* ignore listener errors */ } };
  h.values = values;
  // new run = new player object, so per-player writes get re-applied. retried from run.js ticks until canAct passes
  h.reapply = () => {
    h.pendingReapply = false;
    if (!h.player || h.dead) return;
    const todo = features.filter(f => f.perPlayer && values.get(f.id) !== dflt(f) && !disabledReason(f));
    if (!todo.length) return;
    if (!canAct(h).ok) { h.pendingReapply = true; return; }
    try { markPractice(h); } catch { h.pendingReapply = true; return; }
    for (const f of todo) try { f.apply(h, values.get(f.id)); } catch { /* one bad field must not stop the rest */ }
  };
  h.onPlayer = () => { h.reapply(); emit(); };

  function disabledReason(f) {
    if (h.gate) return h.gate;
    const bad = f.needs.filter(n => !h.m[n]);
    if (bad.length) return `not located on this build: ${bad.join(', ')}`;
    if (f.unknown.length) return `not located on this build: ${f.unknown.join(', ')}`;
    const open = f.leads.filter(n => n in LEADS);
    if (!h.allowLeads && open.length) return `unverified on this build: ${open.join(', ')}`;
    return null;
  }
  const fail = error => ({ ok: false, error: String((error && error.message) || error) });
  const view = f => {
    const reason = disabledReason(f);
    return { id: f.id, category: f.category, label: f.label, kind: f.kind, min: f.min, max: f.max,
      step: f.step, options: f.options, value: values.get(f.id), default: dflt(f), scope: f.scope, live: !!f.live, enabled: !reason, reason };
  };

  // lead names in use, for one confirmation pass in game
  function leadsInUse() {
    const use = new Map();
    const add = (name, id) => { if (!use.has(name)) use.set(name, []); use.get(name).push(id); };
    for (const f of features) for (const n of f.leads) if (n in LEADS) add(n, f.id);
    for (const n of captureLeads) add(n, 'capture');
    return [...use].map(([name, ids]) => ({ name, ...LEADS[name], features: ids }));
  }

  const api = {
    list: () => features.map(view),
    get: id => (byId.has(id) ? view(byId.get(id)) : null),
    set(id, value) {
      const f = byId.get(id);
      if (!f) return fail('unknown feature');
      const why = disabledReason(f);
      if (why) return fail(why);
      let v;
      try { v = clampValue(f, value); } catch (e) { return fail(e); }
      const g = f.scope === 'local' ? { ok: true } : f.scope === 'menu' ? canMenuAct(h) : canAct(h);
      if (!g.ok) return fail(g.reason);
      let out;
      try { if (f.scope === 'run') markPractice(h); out = f.apply(h, v); } catch (e) { return fail(e); }
      const done = r => { values.set(id, v); emit(); return r === undefined ? { ok: true, value: v } : { ok: true, value: v, info: r }; };
      // async actions re-check the run themselves after each await
      if (out && typeof out.then === 'function') return out.then(done, fail);
      return done(out);
    },
    reset(id) {
      const f = byId.get(id);
      if (!f) return fail('unknown feature');
      try { f.reset(h); } catch (e) { return fail(e); }
      values.set(id, dflt(f));
      emit();
      return { ok: true };
    },
    resetAll: () => features.map(f => [f.id, api.reset(f.id)]),
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    status: () => ({
      leads: { allowed: h.allowLeads === true, inUse: leadsInUse() },
      build: { expected: expectedBuild, seen: h.build.seen, state: h.build.state, gate: h.gate },
      modules: { found: Object.keys(h.m), missing: [...h.missing], ambiguous: { ...h.ambiguous }, truncated: h.truncated },
      player: { captured: !!h.player, tickArg: h.tickArg },
      capture: { ...h.capture },
      patches: h.patcher.count(),
      installed: !h.dead,
      // states seen: playing, levelup, choice, paused, over. null = Game missing or not a string
      game: { state: (() => { try { const v = h.m.Game && h.m.Game[GAME.keys.state]; return typeof v === 'string' ? v : null; } catch { return null; } })() },
    }),
    // read-only, in-checks only, never throws
    diagnose: () => diagnoseHandle(h),
    uninstall() { const r = cleanup(); subs.clear(); return r; },
  };
  return api;
}
