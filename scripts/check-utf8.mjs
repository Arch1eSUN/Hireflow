#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const root = process.cwd();
const ignoreDirs = new Set([
  '.git', 'node_modules', '.next', 'dist', 'build', 'coverage', '.turbo', '.venv', 'venv', '__pycache__'
]);

const textExt = new Set([
  '.ts','.tsx','.js','.jsx','.mjs','.cjs','.json','.md','.yml','.yaml','.toml','.env','.txt','.graphql','.gql','.proto','.sql','.py','.java','.go','.rs','.c','.cpp','.h','.hpp','.sh','.zsh','.ini','.conf','.xml','.html','.css','.scss','.svg'
]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (!ignoreDirs.has(entry)) walk(full, out);
      continue;
    }
    out.push(full);
  }
  return out;
}

function isLikelyText(file, buf) {
  const ext = extname(file).toLowerCase();
  if (textExt.has(ext)) return true;
  if (buf.includes(0)) return false;
  // if mostly printable/whitespace, treat as text
  const sample = buf.subarray(0, Math.min(buf.length, 4096));
  let printable = 0;
  for (const b of sample) {
    if ((b >= 32 && b <= 126) || b === 9 || b === 10 || b === 13) printable++;
  }
  return sample.length > 0 && printable / sample.length > 0.85;
}

function firstBadUtf8Offset(buf) {
  let i = 0;
  while (i < buf.length) {
    const b = buf[i];
    if (b <= 0x7f) { i++; continue; }

    let needed = 0;
    let min = 0;
    if ((b & 0xe0) === 0xc0) { needed = 1; min = 0x80; }
    else if ((b & 0xf0) === 0xe0) { needed = 2; min = 0x800; }
    else if ((b & 0xf8) === 0xf0) { needed = 3; min = 0x10000; }
    else return i;

    if (i + needed >= buf.length) return i;

    let cp = b & (0x7f >> (needed + 1));
    for (let j = 1; j <= needed; j++) {
      const c = buf[i + j];
      if ((c & 0xc0) !== 0x80) return i + j;
      cp = (cp << 6) | (c & 0x3f);
    }

    if (cp < min || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return i;
    i += needed + 1;
  }
  return -1;
}

const files = walk(root);
const bad = [];

for (const f of files) {
  const buf = readFileSync(f);
  if (!isLikelyText(f, buf)) continue;
  const off = firstBadUtf8Offset(buf);
  if (off !== -1) bad.push({ file: relative(root, f), offset: off });
}

if (bad.length) {
  console.error('❌ Invalid UTF-8 detected in text-like files:');
  for (const item of bad) console.error(`- ${item.file} (byte ${item.offset})`);
  process.exit(1);
}

console.log('✅ UTF-8 check passed (text-like files).');
