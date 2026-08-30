/**
 * app.patched.reference.js — the KNOWN-GOOD fix for all four Patient-Zero bugs.
 *
 * Not part of the running app; it's the reference you compare the agent's real
 * remediation PR against. Each vulnerability is closed while behaviour is
 * otherwise identical:
 *
 *   #1 SQL injection   → parameterised query (prepared statement placeholder).
 *   #2 Command injection → execFile with an argv array + host validation.
 *   #3 Path traversal  → resolve + containment check against the public dir.
 *   #4 SSRF            → allowlist scheme + block private/loopback address ranges.
 */
const fs = require('node:fs');
const path = require('node:path');
const dns = require('node:dns').promises;
const net = require('node:net');
const { execFile } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const express = require('express');

const { DB_PATH, seed } = require('./init_db.js');

if (!fs.existsSync(DB_PATH)) seed();

const app = express();
const db = new DatabaseSync(DB_PATH);
const PUBLIC_DIR = path.join(__dirname, 'public');

// FIX #1 — bind the user input as a parameter; the driver escapes it safely.
app.get('/users', (req, res) => {
  const name = String(req.query.name ?? '');
  try {
    const rows = db.prepare('SELECT id, name, email FROM users WHERE name = ?').all(name); // `secret` not selected
    res.json({ rows });
  } catch {
    res.status(500).json({ error: 'query failed' });
  }
});

// FIX #2 — validate the host, then pass it as a discrete argv entry (no shell).
const HOST_RE = /^[a-zA-Z0-9.-]{1,253}$/;
app.get('/ping', (req, res) => {
  const host = String(req.query.host ?? 'localhost');
  if (!HOST_RE.test(host)) { res.status(400).type('text/plain').send('invalid host'); return; }
  execFile('ping', ['-c', '1', host], { timeout: 5000 }, (err, stdout) => {
    if (err) { res.status(500).type('text/plain').send('ping failed'); return; }
    res.type('text/plain').send(stdout);
  });
});

// FIX #3 — resolve the path and confirm it stays within the public dir.
app.get('/file', (req, res) => {
  const name = String(req.query.name ?? 'welcome.txt');
  const resolved = path.resolve(PUBLIC_DIR, name);
  if (resolved !== PUBLIC_DIR && !resolved.startsWith(PUBLIC_DIR + path.sep)) {
    res.status(400).type('text/plain').send('invalid path');
    return;
  }
  try {
    res.type('text/plain').send(fs.readFileSync(resolved, 'utf8'));
  } catch {
    res.status(404).type('text/plain').send('not found');
  }
});

// FIX #4 — allow only http(s) to a public host; block loopback/private ranges.
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  return ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80');
}
app.get('/fetch', async (req, res) => {
  let url;
  try { url = new URL(String(req.query.url ?? '')); } catch { res.status(400).type('text/plain').send('bad url'); return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') { res.status(400).type('text/plain').send('scheme not allowed'); return; }
  try {
    const { address } = await dns.lookup(url.hostname);
    if (isPrivateIp(address)) { res.status(403).type('text/plain').send('blocked host'); return; }
    const upstream = await fetch(url, { redirect: 'error' });
    res.type('text/plain').send(await upstream.text());
  } catch {
    res.status(502).type('text/plain').send('fetch failed');
  }
});

app.get('/', (_req, res) => {
  res.json({ service: 'patient-zero', endpoints: ['/users?name=', '/ping?host=', '/file?name=', '/fetch?url='] });
});

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`patient-zero (patched) listening on :${PORT}`));
}

module.exports = { app, db };
