// Build-update checker: node tools/check-build.mjs. Exit 0 same build, 2 new build, 1 error
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = 'https://pokesurvivor.com';
const headers = { 'User-Agent': 'build-check/1.0' };

export const parseBuildConst = text => (/export\s+const\s+BUILD\s*=\s*['"]([^'"]+)['"]/.exec(text) || [])[1] || null;
export const findBundleSrc = html => (/<script[^>]+src=["']([^"']*app\.min\.js\?v=[^"']*)["']/i.exec(html) || [])[1] || null;

async function get(url) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r;
}

async function main() {
  const cfgPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'core', 'config.js');
  const mine = parseBuildConst(readFileSync(cfgPath, 'utf8'));
  if (!mine) throw new Error('BUILD not found in core/config.js');
  const live = String((await (await get(`${SITE}/version.json`)).json()).v);
  console.log(`config BUILD: ${mine}\nversion.json v: ${live}`);
  const src = findBundleSrc(await (await get(`${SITE}/`)).text());
  if (!src) throw new Error('app.min.js?v= script tag not found in page HTML');
  const bytes = (await (await get(new URL(src, `${SITE}/`))).arrayBuffer()).byteLength;
  console.log(`bundle: ${src} (${bytes} bytes)`);
  if (live === mine) { console.log('same build'); return 0; }
  console.log(`NEW BUILD ${live}: run the in-game diagnose`);
  console.log('  1. open the game, connect core (extension, or userscript after queryObjects(Object) stored as a global)');
  console.log("  2. DevTools console: JSON.stringify(globalThis[Symbol.for('ps.core.installed')].diagnose(), null, 1)");
  console.log('  3. compare the JSON with core/config.js (missing keys and modules show what moved)');
  return 2;
}

main().then(c => process.exit(c), e => { console.error(`error: ${e.message}`); process.exit(1); });
