/**
 * Batch user creation — read a TSV (tab-separated values, with header line)
 * and create accounts + team entries in one shot.
 *
 * TSV columns (header row required, tab-separated):
 *   username    password    role    name_zh    name_en    [slug]
 *
 * Roles:
 *   admin                    → creates admin account only (no team entry)
 *   copi | phd | master | ug → creates team entry + member account bound to it
 *
 * Defaults:
 *   slug (when blank for non-admin) → `<role>-<username>`
 *   name_zh / name_en blank → still creates the team entry (you can fill later)
 *   existing usernames are SKIPPED (will not overwrite passwords)
 *   existing slugs are KEPT — only the account is added (binds to existing entry)
 *
 * Usage (inside the running uroexplorer-admin container):
 *   node batch-add-users.js /data/users.tsv
 *   node batch-add-users.js -        # read from stdin
 *
 * Tips on the host:
 *   sudo cp users.tsv /opt/mengjialin-admin-data/    # /data inside container
 *   sudo docker exec uroexplorer-admin node batch-add-users.js /data/users.tsv
 *
 *   # OR pipe via stdin (no host-side file dance):
 *   sudo docker exec -i uroexplorer-admin node batch-add-users.js - < users.tsv
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { SECTIONS } from './sections.js';

const DATA_DIR = process.env.DATA_DIR || path.resolve('./data');
const SITE_DIR = process.env.SITE_DIR || path.resolve('..');

const inputArg = process.argv[2];
if (!inputArg) {
  console.error(`Usage: node batch-add-users.js <users.tsv | ->

TSV format (tab-separated, first line = header):
  username\\tpassword\\trole\\tname_zh\\tname_en\\t[slug]

Examples (fill in values):
  yangfeixiang\\t123456\\tphd\\t杨飞翔\\tYang Feixiang
  lisi\\t123456\\tmaster\\t李四\\tLi Si
  boss\\tstrong-pw\\tadmin
`);
  process.exit(1);
}

let raw;
if (inputArg === '-') {
  /* stdin */
  raw = await new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end',  () => resolve(data));
    process.stdin.on('error', reject);
  });
} else {
  raw = await fs.readFile(inputArg, 'utf-8');
}

/* ----- parse TSV ----- */
const lines = raw.split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('#'));
if (lines.length < 2) {
  console.error('Need at least a header line + 1 data line.');
  process.exit(1);
}
const header = lines[0].split('\t').map(s => s.trim().toLowerCase());
const idx = (col) => header.indexOf(col);
const cols = {
  username: idx('username'),
  password: idx('password'),
  role:     idx('role'),
  name_zh:  idx('name_zh'),
  name_en:  idx('name_en'),
  slug:     idx('slug')
};
if (cols.username < 0 || cols.password < 0 || cols.role < 0) {
  console.error('Header must contain at least: username, password, role');
  process.exit(1);
}

/* ----- load existing state ----- */
const usersFile = path.join(DATA_DIR, 'users.json');
const teamFile  = path.join(DATA_DIR, 'team.json');
let users = {};
try { users = JSON.parse(await fs.readFile(usersFile, 'utf-8')); }
catch (e) { if (e.code !== 'ENOENT') throw e; }
let team = [];
try { team = JSON.parse(await fs.readFile(teamFile, 'utf-8')); }
catch (e) { if (e.code !== 'ENOENT') throw e; }

/* ----- process rows ----- */
let added = 0, skipped = 0, errors = 0;

for (let r = 1; r < lines.length; r++) {
  const cells = lines[r].split('\t').map(s => s.trim());
  const username = cells[cols.username] || '';
  const password = cells[cols.password] || '';
  const role     = cells[cols.role]     || '';
  const nameZh   = cols.name_zh >= 0 ? (cells[cols.name_zh] || '') : '';
  const nameEn   = cols.name_en >= 0 ? (cells[cols.name_en] || '') : '';
  const slugIn   = cols.slug    >= 0 ? (cells[cols.slug]    || '') : '';

  if (!username || !password) { console.error(`× row ${r}: empty username/password`); errors++; continue; }
  if (!/^[a-z0-9_-]+$/i.test(username) || username.length > 32) {
    console.error(`× row ${r}: invalid username "${username}" (a-z, 0-9, _, -, max 32)`); errors++; continue;
  }
  if (password.length < 6) {
    console.error(`× row ${r}: password "${password}" < 6 chars (user: ${username})`); errors++; continue;
  }
  if (!['admin', 'copi', 'phd', 'master', 'ug'].includes(role)) {
    console.error(`× row ${r}: invalid role "${role}" (use admin/copi/phd/master/ug)`); errors++; continue;
  }
  if (users[username]) {
    console.log(`= row ${r}: user "${username}" already exists, skipped`); skipped++; continue;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  if (role === 'admin') {
    users[username] = { passwordHash, role: 'admin' };
    console.log(`✓ row ${r}: + admin "${username}"`);
    added++;
    continue;
  }

  /* member path: also touch team list */
  const slug = slugIn || `${role}-${username}`;
  if (!/^[a-z0-9-]+$/.test(slug)) {
    console.error(`× row ${r}: invalid slug "${slug}" (a-z, 0-9, -)`); errors++; continue;
  }
  const existing = team.find(m => m.slug === slug);
  if (!existing) {
    team.push({
      slug, role,
      name:  { zh: nameZh, en: nameEn },
      title: { zh: '', en: '' },
      affil: { zh: '', en: '' },
      email: '', photo: '',
      about: { zh: [], en: [] },
      education: [], experience: [], projects: [], publications: [], awards: [],
      social: { scholar: '', orcid: '', researchgate: '', github: '' }
    });
    console.log(`✓ row ${r}: + team member "${slug}" (${nameZh || nameEn || '<no name>'})`);
  } else {
    console.log(`= row ${r}: team "${slug}" already exists, binding new account`);
  }
  users[username] = { passwordHash, role: 'member', memberSlug: slug };
  console.log(`✓ row ${r}: + user "${username}" → ${slug}`);
  added++;
}

/* ----- persist ----- */
await fs.mkdir(DATA_DIR, { recursive: true });
await fs.writeFile(usersFile, JSON.stringify(users, null, 2), 'utf-8');
await fs.writeFile(teamFile,  JSON.stringify(team,  null, 2), 'utf-8');

/* Regenerate team-data.js so the public site picks up new entries
   without waiting for a container restart. */
const cfg = SECTIONS.team;
const jsBody =
  '/* AUTO-GENERATED by UroExplorer admin. Edit via the admin panel, not by hand. */\n' +
  `window.${cfg.var} = ${JSON.stringify(team, null, 2)};\n`;
await fs.writeFile(path.join(SITE_DIR, cfg.file), jsBody, 'utf-8');

console.log(`
Done. added: ${added}, skipped: ${skipped}, errors: ${errors}
users.json now has ${Object.keys(users).length} account(s)
team.json  now has ${team.length} member(s)`);
