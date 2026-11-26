const out = document.getElementById('out');
const show = (r) => { out.textContent = JSON.stringify(r, null, 2); };
const ask = async (cmd) => {
  out.textContent = 'working...';
  try { show(await chrome.runtime.sendMessage({ cmd })); } catch (e) { show({ state: 'error', error: String(e.message || e) }); }
};
document.getElementById('c').addEventListener('click', () => ask('connect'));
document.getElementById('d').addEventListener('click', () => ask('disconnect'));
ask('status');
