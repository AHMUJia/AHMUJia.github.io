/**
 * Seed (or reset) a user account.
 *
 * Examples:
 *   # First-time admin:
 *   SEED_USERNAME=mengjialin SEED_PASSWORD='somethingLong!' SEED_ROLE=admin node seed-admin.js
 *
 *   # Add a student bound to a team slug:
 *   SEED_USERNAME=zhangsan SEED_PASSWORD='temp123456' SEED_ROLE=member SEED_SLUG=phd-zhangsan node seed-admin.js
 *
 * If the user already exists, this OVERWRITES the password (useful for resets).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';

const DATA_DIR = process.env.DATA_DIR || path.resolve('./data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

const username = process.env.SEED_USERNAME;
const password = process.env.SEED_PASSWORD;
const role     = process.env.SEED_ROLE || 'admin';
const slug     = process.env.SEED_SLUG || '';

if (!username || !password) {
  console.error('Usage: SEED_USERNAME=<name> SEED_PASSWORD=<pw> [SEED_ROLE=admin|member] [SEED_SLUG=<team-slug>] node seed-admin.js');
  process.exit(1);
}
if (!/^[a-z0-9_-]+$/i.test(username) || username.length > 32) {
  console.error('Invalid username (a-z, 0-9, _, -, max 32 chars).'); process.exit(1);
}
if (password.length < 6) {
  console.error('Password must be at least 6 characters.'); process.exit(1);
}
if (role !== 'admin' && role !== 'member') {
  console.error('SEED_ROLE must be "admin" or "member".'); process.exit(1);
}
if (role === 'member' && !slug) {
  console.error('SEED_SLUG is required for role=member.'); process.exit(1);
}

await fs.mkdir(DATA_DIR, { recursive: true });

let users = {};
try { users = JSON.parse(await fs.readFile(USERS_FILE, 'utf-8')); }
catch (e) { if (e.code !== 'ENOENT') throw e; }

const passwordHash = await bcrypt.hash(password, 12);
users[username] = { passwordHash, role, ...(role === 'member' ? { memberSlug: slug } : {}) };
await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');

console.log(`✓ Seeded ${role} user "${username}"${role === 'member' ? ` (memberSlug=${slug})` : ''}`);
console.log(`  users.json now has ${Object.keys(users).length} account(s).`);
