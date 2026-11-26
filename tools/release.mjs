// build, then package release/ivo-mod-<version>/ (extension zip, userscript, docs)
// version comes from extension/manifest.json
import { readFileSync, rmSync, mkdirSync, cpSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { build } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'extension', 'manifest.json'), 'utf8'));
build();

const out = join(root, 'release', `ivo-mod-${version}`);
const stage = join(out, `ivo-mod-connector-${version}`);
rmSync(out, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
for (const f of readdirSync(join(root, 'extension'))) if (f !== 'test') cpSync(join(root, 'extension', f), join(stage, f), { recursive: true });
for (const f of ['userscript/ivo-mod.user.js', 'README.md', 'RELEASE_NOTES.md']) {
  if (!existsSync(join(root, f))) throw new Error(`missing ${f}`);
  cpSync(join(root, f), join(out, f.split('/').pop()));
}

const zip = `${stage}.zip`;
// HACK: .NET ZipFile on windows (Compress-Archive fails to load in some shells), `zip` elsewhere
if (process.platform === 'win32') {
  execFileSync('powershell', ['-NoProfile', '-Command',
    `Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory('${stage}', '${zip}')`], { stdio: 'inherit' });
} else {
  execFileSync('zip', ['-r', '-q', zip, '.'], { cwd: stage, stdio: 'inherit' });
}
rmSync(stage, { recursive: true, force: true });
console.log(`release ${version}: ${readdirSync(out).join(', ')}`);
