/**
 * Tartarus-Patient-Zero — an INTENTIONALLY VULNERABLE demo service.
 *
 * ⚠️  DO NOT DEPLOY THIS. It exists solely as a target for the Tartarus SecOps
 *     agent to scan, exploit (in an isolated sandbox), and patch during a demo.
 *
 * Four classic, obvious bugs across multiple attack vectors:
 *   1. SQL injection      → GET /users?name=...   (string-concatenated query)
 *   2. Command injection  → GET /ping?host=...    (unsanitised shell exec)
 *   3. Path traversal      → GET /file?name=...    (unsanitised fs read)
 *   4. SSRF                → GET /fetch?url=...     (fetches any user URL)
 *
 * The database is file-backed and seeded with fake secrets (init_db.js), so a
 * successful injection leaks concrete data. Uses built-in node:sqlite (no native
 * module to compile) so it runs identically on a laptop and in the sandbox.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const express = require('express');

const { DB_PATH, seed } = require('./init_db.js');

if (!fs.existsSync(DB_PATH)) seed();

const app = express();
const db = new DatabaseSync(DB_PATH);
const PUBLIC_DIR = path.join(__dirname, 'public');

/**
 * VULNERABILITY #1 — SQL Injection.
 * `name` is concatenated straight into the SQL string: `?name=x' OR '1'='1`
 * returns every row (incl. `secret`); a UNION reaches `admin_tokens`.
 */
app.get('/users', (req, res) => {
  const name = req.query.name ?? '';
  const query = `SELECT id, name, email, secret FROM users WHERE name = '${name}'`;
  try {
    res.json({ query, rows: db.prepare(query).all() });
  } catch (err) {
    res.status(500).json({ query, error: String(err) });
  }
});

/**
 * VULNERABILITY #2 — Command Injection.
 * `host` is interpolated into a shell command: `?host=127.0.0.1; id` runs
 * arbitrary commands on the host.
 */
app.get('/ping', (req, res) => {
  const host = req.query.host ?? 'localhost';
  try {
    res.type('text/plain').send(execSync(`ping -c 1 ${host}`).toString());
  } catch (err) {
    res.status(500).type('text/plain').send(String(err));
  }
});

/**
 * VULNERABILITY #3 — Path Traversal.
 * `name` is joined onto the public dir with no containment check, so
 * `?name=../../flag.txt` escapes the web root and reads arbitrary files.
 */
app.get('/file', (req, res) => {
  const name = String(req.query.name ?? 'welcome.txt');
  try {
    const contents = fs.readFileSync(path.join(PUBLIC_DIR, name), 'utf8');
    res.type('text/plain').send(contents);
  } catch (err) {
    res.status(404).type('text/plain').send(String(err));
  }
});

/**
 * VULNERABILITY #4 — SSRF (Server-Side Request Forgery).
 * The server fetches whatever URL the user supplies, so an attacker can reach
 * internal services / cloud metadata: `?url=http://169.254.169.254/latest/meta-data/`.
 */
app.get('/fetch', async (req, res) => {
  const url = String(req.query.url ?? '');
  try {
    const upstream = await fetch(url);
    res.type('text/plain').send(await upstream.text());
  } catch (err) {
    res.status(502).type('text/plain').send(String(err));
  }
});

app.get('/', (_req, res) => {
  res.json({ service: 'patient-zero', endpoints: ['/users?name=', '/ping?host=', '/file?name=', '/fetch?url='] });
});

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`patient-zero listening on :${PORT}`));
}

module.exports = { app, db };
