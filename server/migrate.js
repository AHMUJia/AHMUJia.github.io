/**
 * One-time bootstrap: read the existing static *-data.js files and turn them
 * into JSON files under DATA_DIR. Idempotent — skips files that already exist
 * in DATA_DIR.
 *
 * After running this, DATA_DIR/*.json is the source of truth; the *-data.js
 * files in SITE_DIR will be regenerated from JSON on every server start.
 *
 * Usage:
 *   SITE_DIR=/site DATA_DIR=/data node migrate.js
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { SECTIONS } from './sections.js';

const SITE_DIR = process.env.SITE_DIR || path.resolve('..');
const DATA_DIR = process.env.DATA_DIR || path.resolve('./data');

await fs.mkdir(DATA_DIR, { recursive: true });

async function fileExists(f) {
  try { await fs.access(f); return true; } catch { return false; }
}

async function loadJsData(file, varName) {
  let src;
  try { src = await fs.readFile(file, 'utf-8'); }
  catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  const ctx = { window: {} };
  vm.createContext(ctx);
  try { vm.runInContext(src, ctx, { filename: file, timeout: 2000 }); }
  catch (e) { console.error(`Failed to evaluate ${file}: ${e.message}`); return null; }
  return ctx.window[varName] ?? null;
}

async function maybeWrite(jsonPath, dataLoader, label) {
  if (await fileExists(jsonPath)) {
    console.log(`-  skip ${label} (already migrated: ${path.basename(jsonPath)})`);
    return;
  }
  const data = await dataLoader();
  if (data == null) {
    console.log(`-  skip ${label} (no source)`);
    return;
  }
  await fs.writeFile(jsonPath, JSON.stringify(data, null, 2));
  const count = Array.isArray(data) ? data.length : 'object';
  console.log(`✓  ${label} -> ${path.basename(jsonPath)} (${count} ${Array.isArray(data) ? 'entries' : ''})`);
}

console.log(`SITE_DIR = ${SITE_DIR}`);
console.log(`DATA_DIR = ${DATA_DIR}\n`);

for (const [name, cfg] of Object.entries(SECTIONS)) {
  if (cfg.split) {
    await maybeWrite(
      path.join(DATA_DIR, `${name}.zh.json`),
      () => loadJsData(path.join(SITE_DIR, cfg.zhFile), cfg.var),
      `${name} (zh)`
    );
    await maybeWrite(
      path.join(DATA_DIR, `${name}.en.json`),
      () => loadJsData(path.join(SITE_DIR, cfg.enFile), cfg.var),
      `${name} (en)`
    );
  } else {
    await maybeWrite(
      path.join(DATA_DIR, `${name}.json`),
      () => loadJsData(path.join(SITE_DIR, cfg.file), cfg.var),
      name
    );
  }
}

console.log('\nMigration complete.');
