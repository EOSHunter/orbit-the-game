// Production build: copies exactly what the game needs into dist/ (zero dependencies, no bundler, no code changes).
//   node tools/build.mjs        (npm run build)       output: dist/
//
// dist/
//   index.html                       the game page, rewritten to point at the hashed folder below
//   assets/<hash>/src/**             the game modules (demo pages and *.md left out)
//   assets/<hash>/vendor/three/**    only the Three.js files the game imports, plus its LICENSE
//   og-image.png, 404.html, _headers
//
// Everything under assets/<hash>/ is content-hashed, so _headers can cache it as immutable; index.html is the only
// file that changes name-for-name between deploys and is always revalidated.
//
// The build also walks every import in the shipped modules and fails if one does not resolve, or resolves with
// different letter case than the file on disk (Windows/macOS accept that, Cloudflare's Linux does not).
import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist');
const MAX_FILE = 25 * 1024 * 1024;   // Cloudflare Pages per-file limit
const OG_SOURCE = 'docs/video/brand-kit/screenshots/07-hud-black-hole.png';

const posixRel = (p) => relative(ROOT, p).split(sep).join('/');
const fail = (msg) => { console.error(`build: ${msg}`); process.exit(1); };

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p)); else out.push(p);
  }
  return out;
}

// Does `file` exist with exactly this letter case on every path segment below ROOT?
async function existsExact(file) {
  const parts = posixRel(file).split('/');
  let dir = ROOT;
  for (const part of parts) {
    let names;
    try { names = await readdir(dir); } catch { return false; }
    if (!names.includes(part)) return false;
    dir = join(dir, part);
  }
  return true;
}

// ---- import map from the source index.html (the one place bare specifiers are resolved) ----
const srcHtml = await readFile(join(ROOT, 'index.html'), 'utf8');
const mapMatch = srcHtml.match(/<script type="importmap">([\s\S]*?)<\/script>/);
if (!mapMatch) fail('index.html has no import map');
const IMPORTS = JSON.parse(mapMatch[1]).imports;
function mapBare(spec) {
  if (IMPORTS[spec]) return IMPORTS[spec];
  for (const [prefix, target] of Object.entries(IMPORTS)) if (prefix.endsWith('/') && spec.startsWith(prefix)) return target + spec.slice(prefix.length);
  return null;
}

// ---- src: everything except demo pages and docs ----
const isDemo = (p) => /(^|\/)demo[^/]*\.(html|js)$/.test(p) || /\.md$/.test(p);
const srcFiles = (await walk(join(ROOT, 'src'))).filter((f) => !isDemo(posixRel(f)));

// ---- import crawl: verifies src and finds which vendor files are needed ----
const SPEC_RE = [
  /\b(?:import|export)\s[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g,   // import x from '...' / export * from '...'
  /\bimport\s*['"]([^'"]+)['"]/g,                                // import '...'
  /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,                         // import('...')
  /\btryImport\(\s*['"]([^'"]+)['"]\s*\)/g,                      // main3d.js's defensive loader
];
const shipped = new Set(srcFiles);
const vendorNeeded = new Set();
const seen = new Set();
async function crawl(file) {
  if (seen.has(file)) return;
  seen.add(file);
  if (!/\.m?js$/.test(file)) return;
  const text = (await readFile(file, 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
  for (const re of SPEC_RE) {
    for (const m of text.matchAll(re)) {
      const spec = m[1];
      let target;
      if (spec.startsWith('./') || spec.startsWith('../')) target = resolve(dirname(file), spec);
      else {
        const mapped = mapBare(spec);
        if (!mapped) fail(`${posixRel(file)}: bare import '${spec}' is not in the import map`);
        target = resolve(ROOT, mapped);
      }
      if (!await existsExact(target)) fail(`${posixRel(file)}: import '${spec}' does not resolve (missing file or wrong letter case): ${posixRel(target)}`);
      if (posixRel(target).startsWith('vendor/')) vendorNeeded.add(target);
      else if (!shipped.has(target)) fail(`${posixRel(file)}: import '${spec}' reaches ${posixRel(target)}, which the build does not ship`);
      await crawl(target);
    }
  }
}
for (const f of srcFiles) await crawl(f);
const vendorFiles = [...vendorNeeded, join(ROOT, 'vendor/three/LICENSE')];

// ---- content hash over everything that goes into assets/<hash>/ ----
const copies = [
  ...srcFiles.map((f) => ({ from: f, to: posixRel(f) })),
  ...vendorFiles.map((f) => ({ from: f, to: posixRel(f) })),
].sort((a, b) => (a.to < b.to ? -1 : 1));
const hash = createHash('sha256');
for (const c of copies) { hash.update(c.to); hash.update('\0'); hash.update(await readFile(c.from)); hash.update('\0'); }
const HASH = hash.digest('hex').slice(0, 12);
const ASSET_DIR = `assets/${HASH}`;

// ---- write dist/ ----
await rm(OUT, { recursive: true, force: true });
for (const c of copies) {
  const dest = join(OUT, ASSET_DIR, c.to);
  await mkdir(dirname(dest), { recursive: true });
  await cp(c.from, dest);
}

let html = srcHtml;
const rewrites = [['./vendor/three/', `./${ASSET_DIR}/vendor/three/`], ['./src/boot.js', `./${ASSET_DIR}/src/boot.js`]];
for (const [a, b] of rewrites) { if (!html.includes(a)) fail(`index.html no longer contains ${a}`); html = html.split(a).join(b); }
await writeFile(join(OUT, 'index.html'), html);

await cp(join(ROOT, OG_SOURCE), join(OUT, 'og-image.png'));
await cp(join(ROOT, 'deploy/_headers'), join(OUT, '_headers'));
await cp(join(ROOT, 'deploy/404.html'), join(OUT, '404.html'));

// ---- report + limits ----
const outFiles = await walk(OUT);
let total = 0, biggest = { size: 0, file: '' };
for (const f of outFiles) {
  const { size } = await stat(f);
  total += size;
  if (size > biggest.size) biggest = { size, file: posix.normalize(posixRel(f).replace(/^dist\//, '')) };
  if (size > MAX_FILE) fail(`${posixRel(f)} is ${(size / 1048576).toFixed(1)} MiB, over Cloudflare Pages' 25 MiB per-file limit`);
}
console.log(`build: dist/ ready: ${outFiles.length} files, ${(total / 1048576).toFixed(2)} MiB, largest ${biggest.file} (${(biggest.size / 1048576).toFixed(2)} MiB), assets/${HASH}`);
