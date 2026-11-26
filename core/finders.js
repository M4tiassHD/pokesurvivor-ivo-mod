const MAX_OBJECTS = 2000000; // ~51,600 objects at the menu, bound anyway

function isObj(o) { return o !== null && (typeof o === 'object' || typeof o === 'function'); }
function safe(pred, o) { try { return pred(o) === true; } catch { return false; } }

export function findModules(objects, table) {
  const names = Object.keys(table);
  const hits = Object.fromEntries(names.map(n => [n, { n: 0, first: null }]));
  const total = Number(objects && objects.length) || 0;
  const len = Math.min(total, MAX_OBJECTS);
  for (let i = 0; i < len; i++) {
    let o;
    try { o = objects[i]; } catch { continue; }
    if (!isObj(o)) continue;
    for (const name of names) {
      if (safe(table[name].pred, o)) {
        const h = hits[name];
        if (h.n++ === 0) h.first = o;
      }
    }
  }
  const found = {}, missing = [], ambiguous = {};
  for (const name of names) {
    const h = hits[name];
    if (h.n === 1) found[name] = h.first;
    else if (h.n === 0) missing.push(name);
    else ambiguous[name] = h.n;
  }
  return { found, missing, ambiguous, truncated: total > MAX_OBJECTS };
}

export function parseBuild(src) {
  try { return new URL(String(src), 'https://base.invalid/').searchParams.get('v') || null; } catch { return null; }
}

// null = no tag or no v param, not the same as a mismatching string
export function readBuild(doc) {
  try {
    const el = doc && doc.querySelector('script[src*="app.min.js"]');
    if (!el) return null;
    return parseBuild(el.getAttribute ? el.getAttribute('src') : el.src);
  } catch { return null; }
}
