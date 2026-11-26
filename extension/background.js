import { PAGE_URL, buildInstallDeclaration, UNINSTALL_EXPRESSION, unwrap, needsRetry, AUTO_RETRIES, AUTO_DELAY_MS } from './expr.js';

const GROUP = 'ps-connector';
const V = '1.3';
let busy = false;        // a worker restart drops the CDP session too, nothing to recover
const ours = new Set();  // tabs we detach ourselves

async function setLast(last) {
  last.at = new Date().toISOString();
  await chrome.storage.session.set({ last });
  const b = last.state === 'on' ? ['ON', '#2e7d32'] : last.state === 'error' ? ['ERR', '#c62828'] : ['', '#666'];
  await chrome.action.setBadgeText({ text: b[0] });
  await chrome.action.setBadgeBackgroundColor({ color: b[1] });
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab || tab.id === undefined) throw new Error('no active tab');
  if (!tab.url || !PAGE_URL.test(tab.url)) throw new Error(`active tab is not https://pokesurvivor.com/ (${tab.url || 'url hidden'})`);
  return tab;
}

// attach, run fn(send), always release the group and detach
async function withDebugger(tabId, fn) {
  const target = { tabId };
  const send = async (method, params) => chrome.debugger.sendCommand(target, method, params);
  await chrome.debugger.attach(target, V);
  try {
    return await fn(send);
  } finally {
    ours.add(tabId);
    try { await send('Runtime.releaseObjectGroup', { objectGroup: GROUP }); } catch { /* tab may be gone */ }
    try { await chrome.debugger.detach(target); } catch { /* already detached */ }
    ours.delete(tabId);
  }
}

async function connect() { return connectTab(await activeTab()); }

async function connectTab(tab) {
  const bundle = await (await fetch(chrome.runtime.getURL('core.js'))).text();
  const declaration = buildInstallDeclaration(bundle);
  const status = await withDebugger(tab.id, async (send) => {
    const proto = unwrap(await send('Runtime.evaluate', { expression: 'Object.prototype', objectGroup: GROUP }), 'evaluate Object.prototype');
    if (!proto.objectId) throw new Error('Object.prototype returned no objectId');
    const arr = await send('Runtime.queryObjects', { prototypeObjectId: proto.objectId, objectGroup: GROUP });
    if (!arr || !arr.objects || !arr.objects.objectId) throw new Error('queryObjects returned no array');
    const r = unwrap(await send('Runtime.callFunctionOn', {
      objectId: arr.objects.objectId, functionDeclaration: declaration, returnByValue: true, objectGroup: GROUP,
    }), 'install');
    // too early (game still loading): undo so a later install does not get a half api
    if (needsRetry(r.value)) unwrap(await send('Runtime.evaluate', { expression: UNINSTALL_EXPRESSION, returnByValue: true, objectGroup: GROUP }), 'undo early install');
    return r.value;
  });
  if (needsRetry(status)) return { state: 'error', tabId: tab.id, retry: true, error: `modules not found yet: ${status.modules.missing.join(', ')}`, status };
  return { state: 'on', tabId: tab.id, status };
}

// auto-connect when a game tab finishes loading
async function autoConnect(tabId, attempt) {
  let tab;
  try { tab = await chrome.tabs.get(tabId); } catch { return; } // tab closed
  if (!tab.url || !PAGE_URL.test(tab.url)) return;
  const last = busy ? { retry: true } : await run(() => connectTab(tab));
  if (last.retry && attempt < AUTO_RETRIES) setTimeout(() => autoConnect(tabId, attempt + 1), AUTO_DELAY_MS);
}
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === 'complete' && tab.url && PAGE_URL.test(tab.url)) autoConnect(tabId, 0);
});

async function disconnect() {
  const tab = await activeTab();
  const value = await withDebugger(tab.id, async (send) =>
    unwrap(await send('Runtime.evaluate', { expression: UNINSTALL_EXPRESSION, returnByValue: true, objectGroup: GROUP }), 'uninstall').value);
  return { state: 'off', tabId: tab.id, uninstall: value === null ? 'nothing installed' : value };
}

async function run(op) {
  if (busy) return { state: 'error', error: 'another operation is running' };
  busy = true;
  let last;
  try { last = await op(); } catch (e) { last = { state: 'error', error: String(e && e.message || e) }; }
  finally { busy = false; }
  await setLast(last);
  return last;
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  (async () => {
    if (msg && msg.cmd === 'connect') reply(await run(connect));
    else if (msg && msg.cmd === 'disconnect') reply(await run(disconnect));
    else reply((await chrome.storage.session.get('last')).last || { state: 'off', note: 'not connected' });
  })();
  return true;
});

chrome.debugger.onDetach.addListener(async (source, reason) => {
  if (ours.has(source.tabId)) return;
  await setLast({ state: 'error', tabId: source.tabId, error: `debugger detached: ${reason}` });
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { last } = await chrome.storage.session.get('last');
  if (last && last.tabId === tabId && last.state === 'on') await setLast({ state: 'error', tabId, error: 'game tab closed' });
});
