/**
 * init_db.js — seed the Patient-Zero database with realistic-looking secrets.
 *
 * The whole point of a SQL-injection demo is that the injection LEAKS something
 * that obviously shouldn't be public. So we seed a `users` table whose `secret`
 * column holds fake AWS keys, and an `admin_tokens` table with fake password
 * hashes. When Tartarus detonates `?name=x' OR '1'='1`, this is the data that
 * spills out — concrete proof the exploit worked.
 *
 * Uses Node's built-in `node:sqlite` (Node 22.5+), so there is NO native module
 * to compile — it runs identically on a laptop and inside the Daytona sandbox.
 *
 * Writes to ./patient-zero.db. Safe to run repeatedly (drops & recreates).
 *
 * Run with:  node src/init_db.js
 */
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.PZ_DB_PATH || path.join(__dirname, '..', 'patient-zero.db');

function seed() {
  const db = new DatabaseSync(DB_PATH);

  db.exec(`
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS admin_tokens;

    CREATE TABLE users (
      id     INTEGER PRIMARY KEY,
      name   TEXT NOT NULL,
      email  TEXT NOT NULL,
      secret TEXT NOT NULL          -- never expose this column
    );

    CREATE TABLE admin_tokens (
      id       INTEGER PRIMARY KEY,
      username TEXT NOT NULL,
      pw_hash  TEXT NOT NULL        -- password hashes
    );
  `);

  // NOTE: these are FAKE, non-functional strings for demo purposes only.
  const insertUser = db.prepare('INSERT INTO users (name, email, secret) VALUES (?, ?, ?)');
  insertUser.run('alice', 'alice@acme.test', 'AKIAFAKEALICE0000/wJalrFakeSecretKeyEXAMPLE01');
  insertUser.run('bob', 'bob@acme.test', 'AKIAFAKEBOB000000/wJalrFakeSecretKeyEXAMPLE02');
  insertUser.run('carol', 'carol@acme.test', 'AKIAFAKECAROL0000/wJalrFakeSecretKeyEXAMPLE03');

  const insertAdmin = db.prepare('INSERT INTO admin_tokens (username, pw_hash) VALUES (?, ?)');
  insertAdmin.run('root', '$2b$12$FAKEHASHrootFAKEHASHrootFAKEHASHrootFAKEHASHro');
  insertAdmin.run('deploy', '$2b$12$FAKEHASHdeployFAKEHASHdeployFAKEHASHdeployFAKE');

  const users = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  const admins = db.prepare('SELECT COUNT(*) AS n FROM admin_tokens').get().n;
  db.close();
  return { DB_PATH, users, admins };
}

if (require.main === module) {
  const { DB_PATH: p, users, admins } = seed();
  console.log(`✓ seeded ${p} — ${users} users, ${admins} admin tokens (all fake).`);
}

module.exports = { seed, DB_PATH };
