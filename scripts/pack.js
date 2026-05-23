/**
 * pack.js — creates ZeroApi-deploy.zip, excluding node_modules and existing zips.
 * Usage: node scripts/pack.js
 */
const JSZip = require('jszip');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(ROOT, '..', 'ZeroApi-deploy.zip');

const IGNORE = new Set(['node_modules', '.git', 'package-lock.json']);
const IGNORE_EXT = new Set(['.zip']);

function shouldIgnore(relPath) {
  const parts = relPath.split(path.sep);
  return parts.some((p) => IGNORE.has(p)) || IGNORE_EXT.has(path.extname(relPath));
}

function walkDir(dir, base = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const rel = base ? path.join(base, entry.name) : entry.name;
    if (shouldIgnore(rel)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(full, rel));
    } else {
      files.push({ rel, full });
    }
  }
  return files;
}

async function main() {
  const zip = new JSZip();
  const folder = zip.folder('ZeroApi');
  const files = walkDir(ROOT);

  console.log(`📦  Packing ${files.length} files…`);
  for (const { rel, full } of files) {
    const content = fs.readFileSync(full);
    folder.file(rel, content);
  }

  if (fs.existsSync(OUT)) fs.unlinkSync(OUT);

  const buf = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  fs.writeFileSync(OUT, buf);
  const kb = (buf.length / 1024).toFixed(1);
  console.log(`✅  ZeroApi-deploy.zip  (${kb} KB)  →  ${OUT}`);
}

main().catch((err) => { console.error('pack failed:', err.message); process.exit(1); });
