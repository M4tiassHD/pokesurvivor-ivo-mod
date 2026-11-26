import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildInstallDeclaration, UNINSTALL_EXPRESSION, PAGE_URL, unwrap, needsRetry } from '../expr.js';
import { bundle } from '../../tools/build.mjs';

test('install declaration parses and calls psInstall(this, ...)', () => {
  const d = buildInstallDeclaration(bundle());
  assert.match(d, /psInstall\(this, \{\}\)/);
  assert.equal(typeof new Function(`return (${d});`)(), 'function');
});

test('install declaration runs with a fake bundle', () => {
  const fake = 'function psInstall(o, opts) { return { status: () => ({ n: o.length }) }; }';
  const fn = new Function(`return (${buildInstallDeclaration(fake)});`)();
  assert.deepEqual(fn.call([1, 2, 3]), { n: 3 });
});

test('rejects a bundle without psInstall', () => assert.throws(() => buildInstallDeclaration('x')));

test('uninstall expression parses; null when nothing installed', () => {
  assert.equal(eval(UNINSTALL_EXPRESSION), null);
});

test('url filter and unwrap', () => {
  assert.ok(PAGE_URL.test('https://pokesurvivor.com/'));
  assert.ok(!PAGE_URL.test('https://pokesurvivor.com.evil.io/'));
  assert.throws(() => unwrap({ exceptionDetails: { text: 'x', exception: { description: 'boom' } } }, 'w'), /w: boom/);
});

test('manifest is minimal MV3', () => {
  const m = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url)));
  assert.equal(m.manifest_version, 3);
  assert.deepEqual(m.host_permissions, ['https://pokesurvivor.com/*']);
  assert.ok(!m.content_scripts && !m.permissions.includes('<all_urls>'));
});

test('auto-connect retries only while modules are missing', () => {
  assert.equal(needsRetry({ modules: { missing: ['Game'] } }), true);
  assert.equal(needsRetry({ modules: { missing: [] } }), false);
  assert.equal(needsRetry(undefined), false);
});
