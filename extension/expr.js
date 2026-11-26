// builds the in-page function declarations, no chrome.* so node can test it

export const PAGE_URL = /^https:\/\/pokesurvivor\.com\//;

// runs with this = the queryObjects array, bundle is function psInstall(objects, opts)
export function buildInstallDeclaration(bundleText) {
  if (typeof bundleText !== 'string' || !bundleText.includes('function psInstall')) {
    throw new Error('core bundle text does not define psInstall');
  }
  return `function () {\n${bundleText}\nreturn psInstall(this, {}).status();\n}`;
}

export const UNINSTALL_EXPRESSION =
  "(() => { const a = globalThis[Symbol.for('ps.core.installed')]; return a ? a.uninstall() : null; })()";

// throws the page-side message on exceptionDetails
export function unwrap(res, what) {
  if (res && res.exceptionDetails) {
    const d = res.exceptionDetails;
    throw new Error(`${what}: ${(d.exception && (d.exception.description || d.exception.value)) || d.text}`);
  }
  if (!res || !res.result) throw new Error(`${what}: empty CDP result`);
  return res.result;
}

// game may still be initialising at 'complete', so an install that misses modules is undone and retried
export const AUTO_RETRIES = 5;
export const AUTO_DELAY_MS = 2000;
export function needsRetry(status) {
  const missing = status && status.modules && status.modules.missing;
  return Array.isArray(missing) && missing.length > 0;
}
