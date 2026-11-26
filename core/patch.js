export function createPatcher() {
  const list = [];
  let seq = 0;
  const installed = e => {
    try { return Object.getOwnPropertyDescriptor(e.obj, e.key)?.value === e.wrapper; } catch { return false; }
  };
  function undo(e) {
    if (!installed(e)) return 'left';
    try { Object.defineProperty(e.obj, e.key, e.descriptor); return 'restored'; } catch { return 'failed'; }
  }
  function wrap(obj, key, makeWrapper) {
    const d = Object.getOwnPropertyDescriptor(obj, key);
    if (!d || !('value' in d) || !d.writable || !d.configurable || typeof d.value !== 'function') {
      throw new Error(`cannot wrap ${String(key)}: not an own writable configurable function`);
    }
    const wrapper = makeWrapper(d.value);
    if (typeof wrapper !== 'function') throw new Error(`wrapper for ${String(key)} is not a function`);
    const e = { id: ++seq, obj, key, descriptor: d, wrapper };
    try {
      Object.defineProperty(obj, key, { ...d, value: wrapper });
      list.push(e);
    } catch (err) {
      undo(e);
      throw err;
    }
    return e.id;
  }
  function unwrap(id) {
    const i = list.findIndex(e => e.id === id);
    if (i < 0) return { id, status: 'unknown' };
    const [e] = list.splice(i, 1);
    return { id, key: e.key, status: undo(e) };
  }
  // reverse order, a patch someone else re-wrapped is left alone and reported
  function restoreAll() {
    const out = { restored: 0, left: [], failed: [] };
    for (const e of list.splice(0).reverse()) {
      const s = undo(e);
      if (s === 'restored') out.restored++;
      else (s === 'left' ? out.left : out.failed).push({ id: e.id, key: e.key });
    }
    return out;
  }
  return { wrap, unwrap, restoreAll, count: () => list.length };
}
