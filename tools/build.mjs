// plain concat into one scope, so top-level names must be unique across core/*.js
// TODO: esbuild if the module count or collisions grow
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ORDER = ['config', 'finders', 'patch', 'run', 'diagnose', 'api', 'features/common', 'features/stats', 'features/powers', 'features/locator', 'features/spawns', 'features/automation', 'features', 'index'];

// every code unit above 0x7F becomes a \u escape so the output survives any clipboard
export const asciiOnly = text => text.replace(/[^\x00-\x7f]/g, c => String.fromCharCode(92) + 'u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

export const UI_ORDER = ['model', 'panel'];

export function bundle(coreDir = join(root, 'core'), uiDir = join(root, 'ui')) {
  const seen = new Map();
  const parts = [...ORDER.map(n => [coreDir, n]), ...UI_ORDER.map(n => [uiDir, n])].map(([dir, name]) => {
    const src = readFileSync(join(dir, `${name}.js`), 'utf8').replace(/\r\n/g, '\n');
    const body = src
      .replace(/^import\s[^;]*?from\s+['"][^'"]+['"];?[ 	]*$/gm, '') // may span lines
      .replace(/^export (default )?/gm, '');
    if (/^(import|export)\b/m.test(body)) throw new Error(`${name}.js: unsupported import/export form`);
    for (const m of body.matchAll(/^(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)) {
      if (seen.has(m[1])) throw new Error(`duplicate top-level name "${m[1]}" in ${name}.js and ${seen.get(m[1])}.js`);
      seen.set(m[1], name);
    }
    return `// --- ${name}.js\n${body}`;
  });
  const code = asciiOnly(`function psInstall(objects, opts) {\n'use strict';\n${parts.join('\n')}\nconst api = install(objects, opts);\nif (!opts || opts.ui !== false) uiMount(api, opts);\nreturn api;\n}\n`);
  new Function(`${code}\nreturn psInstall;`); // SyntaxError on duplicate const etc
  return code;
}

export function build(outFile = join(root, 'dist', 'core.js')) {
  const code = bundle();
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, code);
  if (outFile === join(root, 'dist', 'core.js')) writeFileSync(join(root, 'extension', 'core.js'), code); // generated
  if (outFile === join(root, 'dist', 'core.js')) writeFileSync(join(root, 'userscript', 'ivo-mod.user.js'), userscript(code)); // generated
  return { outFile, bytes: code.length };
}

export function userscriptHeader(version) {
  return ['// ==UserScript==', '// @name         IVO-mod', `// @version      ${version}`,
    '// @match        https://pokesurvivor.com/*', '// @grant        none', '// @inject-into  page', '// @run-at       document-idle', '// ==/UserScript==', ''].join('\n');
}

export function userscript(bundleText) {
  const version = JSON.parse(readFileSync(join(root, 'extension', 'manifest.json'), 'utf8')).version;
  const loader = readFileSync(join(root, 'userscript', 'loader.js'), 'utf8').replace(/\r\n/g, '\n').replace(/^export /gm, '');
  const run = 'runLoader({ win: window, psInstall, log: (...a) => console.log(...a), setInterval: (f, ms) => setInterval(f, ms), clearInterval: t => clearInterval(t), now: () => Date.now() });';
  const code = asciiOnly([userscriptHeader(version) + '(function () {', "'use strict';", bundleText, loader, run, '})();', ''].join('\n'));
  new Function(code);
  return code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = build();
  console.log(`built ${r.outFile} (${r.bytes} bytes)`);
}
