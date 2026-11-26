// appended after the core bundle in the userscript, no game names here
export const MIN_ENTRIES = 1000;
export const MAX_TEMP = 50;
export const POLL_MS = 1000;
export const TIMEOUT_MS = 10 * 60 * 1000;
export const GUIDE = [
  '[IVO-mod] Waiting for the object list. Steps (once per page load):',
  '[IVO-mod] 1. Open DevTools, Console tab.',
  '[IVO-mod] 2. Run: queryObjects(Object.prototype)',
  '[IVO-mod] 3. Right-click the logged array and pick "Store as global variable" (creates temp1, temp2, ...).',
];

// window.ps first (manual override), then temp1..temp50; arrays over MIN_ENTRIES not in tried
export function pickCandidates(win, tried) {
  const out = [];
  const names = ['ps'];
  for (let i = 1; i <= MAX_TEMP; i++) names.push(`temp${i}`);
  for (const n of names) {
    let v;
    try { v = win[n]; } catch { continue; }
    if (Array.isArray(v) && v.length > MIN_ENTRIES && !tried.has(v) && !out.includes(v)) out.push(v);
  }
  return out;
}

// env: { win, psInstall, log, setInterval, clearInterval, now } -> { tick, stop }
export function runLoader(env) {
  const { win, psInstall, log } = env;
  const key = Symbol.for('ps.core.installed');
  const tried = new WeakSet();
  const started = env.now();
  let timer = null;
  let done = false;
  const stop = () => { done = true; if (timer !== null) env.clearInterval(timer); timer = null; };

  function tick() {
    if (done) return;
    if (env.now() - started >= TIMEOUT_MS) { log('[IVO-mod] Gave up after 10 minutes without a usable array. Reload the page to try again.'); stop(); return; }
    for (const c of pickCandidates(win, tried)) {
      tried.add(c);
      let api;
      try { api = psInstall(c, {}); } catch (e) { log(`[IVO-mod] install failed: ${e && e.message || e}`); continue; }
      const st = api.status();
      const missing = (st && st.modules && st.modules.missing) || [];
      if (missing.length) {
        log(`[IVO-mod] Modules not found: ${missing.join(', ')}. The array may be too old: redo the DevTools steps (queryObjects(Object.prototype), Store as global variable).`);
        api.uninstall();
        continue;
      }
      log('[IVO-mod] Installed.', st);
      stop();
      return;
    }
  }

  if (win[key]) { log('[IVO-mod] Core already installed; nothing to do.'); done = true; return { tick, stop }; }
  for (const l of GUIDE) log(l);
  timer = env.setInterval(tick, POLL_MS);
  return { tick, stop };
}
