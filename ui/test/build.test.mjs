import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build, asciiOnly } from '../../tools/build.mjs';

test('asciiOnly escapes BMP characters and splits astral ones into surrogate escapes', () => {
  assert.equal(asciiOnly('a\u2013b\u00d7'), 'a\\u2013b\\u00d7');
  assert.equal(asciiOnly('\u{1F600}'), '\\ud83d\\ude00');
  assert.equal(eval(`'${asciiOnly('\u{1F600}·')}'`), '\u{1F600}·');
});

test('every built output is pure ASCII and parses', () => {
  build();
  for (const f of ['dist/core.js', 'extension/core.js', 'userscript/ivo-mod.user.js']) {
    const t = readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
    assert.equal(/[^\x00-\x7f]/.test(t), false, f);
    assert.doesNotThrow(() => new Function(t), f);
  }
  assert.match(readFileSync(new URL('../../userscript/ivo-mod.user.js', import.meta.url), 'utf8'), /@name\s+IVO-mod\n/);
});
