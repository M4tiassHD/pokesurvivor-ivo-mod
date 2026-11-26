import { BUILD, MODULES, TICK_PLAYER_ARG } from './config.js';
import { findModules, readBuild } from './finders.js';
import { createPatcher } from './patch.js';
import { installCapture } from './run.js';
import { createApi } from './api.js';
import { FEATURES } from './features.js';

const INSTALLED = Symbol.for('ps.core.installed');

export function install(objects, opts) {
  opts = opts || {};
  const host = opts.host || globalThis;
  if (host[INSTALLED]) return host[INSTALLED];
  if (!Array.isArray(objects)) throw new Error('install: objects must be an array (queryObjects result)');

  const seen = readBuild(opts.doc !== undefined ? opts.doc : host.document);
  const state = seen === null ? 'unknown' : seen === BUILD ? 'match' : 'mismatch';
  const gate = state === 'match' || opts.allowUnverified === true ? null
    : state === 'unknown' ? 'build unknown' : `unverified build ${seen}`;

  const r = findModules(objects, MODULES);
  const patcher = createPatcher();
  const h = {
    m: r.found, missing: r.missing, ambiguous: r.ambiguous, truncated: r.truncated,
    player: null, dead: false, gate, allowLeads: opts.allowLeads === true, build: { seen, state }, scratch: {}, patcher,
    capture: { state: 'not installed', error: null }, tickArg: TICK_PLAYER_ARG, onPlayer: null,
  };

  let api;
  // used by uninstall and failed setup alike
  function cleanup() {
    if (h.dead) return { restored: 0, left: [], failed: [] };
    h.dead = true;
    if (api) api.resetAll();
    const res = patcher.restoreAll();
    h.player = null;
    try { if (host[INSTALLED] === api) delete host[INSTALLED]; } catch { /* ignore */ }
    return res;
  }

  try {
    api = createApi({ h, features: FEATURES, cleanup, expectedBuild: BUILD, captureLeads: [] });
    if (gate) h.capture.state = `skipped: ${gate}`;
    else if (!h.m.Combat || !h.m.Game) h.capture.state = 'skipped: Game or Combat not located';
    else installCapture(h, patcher); // failure lands in h.capture, rollback is inside
    Object.defineProperty(host, INSTALLED, { value: api, configurable: true, enumerable: false, writable: false });
  } catch (e) {
    cleanup();
    throw e;
  }
  return api;
}
