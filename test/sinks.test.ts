/**
 * Tests for the vulnerability sink detector (src/mcp/tools/scanRepoForVulns.ts).
 *
 * `detectSinks` is the cheap first-pass heuristic that flags where Claude should
 * look. These tests prove it flags the classic sinks (including the exact two in
 * Patient-Zero) and stays quiet on clean, parameterised code — so the scan phase
 * points at real risk, not noise.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectSinks } from '../src/mcp/tools/scanRepoForVulns.ts';

test('flags string-concatenated SQL (Patient-Zero /users)', () => {
  const code = "const q = `SELECT id, name FROM users WHERE name = '` + name + `'`;";
  assert.ok(detectSinks(code).some((h) => /SQL/i.test(h)));
});

test('flags shell exec / command injection (Patient-Zero /ping)', () => {
  const code = "const out = execSync(`ping -c 1 ${host}`);";
  assert.ok(detectSinks(code).some((h) => /command injection/i.test(h)));
});

test('flags eval, raw HTML XSS, weak crypto, and unsafe deserialization', () => {
  assert.ok(detectSinks('eval(userInput)').some((h) => /eval/i.test(h)));
  assert.ok(detectSinks('el.innerHTML = data').some((h) => /XSS/i.test(h)));
  assert.ok(detectSinks('const h = md5(password)').some((h) => /weak crypto/i.test(h)));
  assert.ok(detectSinks('data = pickle.loads(blob)').some((h) => /deserialization/i.test(h)));
});

test('flags path traversal file reads (Patient-Zero /file)', () => {
  const code = "const c = fs.readFileSync(path.join(PUBLIC_DIR, name), 'utf8');";
  assert.ok(detectSinks(code).some((h) => /path traversal/i.test(h)));
});

test('flags SSRF outbound requests (Patient-Zero /fetch)', () => {
  assert.ok(detectSinks('const r = await fetch(req.query.url);').some((h) => /SSRF/i.test(h)));
  assert.ok(detectSinks('axios.get(userUrl)').some((h) => /SSRF/i.test(h)));
  assert.ok(detectSinks('requests.get(url)').some((h) => /SSRF/i.test(h)));
});

test('stays silent on clean, parameterised code', () => {
  const safe = "const rows = db.prepare('SELECT id FROM users WHERE name = ?').all(name);";
  assert.deepEqual(detectSinks(safe), []);
});

test('returns every distinct sink present in one file', () => {
  const code = 'eval(x); el.innerHTML = y; const out = execSync(cmd);';
  const hints = detectSinks(code);
  assert.ok(hints.length >= 3);
});

test('flags string-built UPDATE/DELETE, not just SELECT', () => {
  assert.ok(detectSinks("db.run('UPDATE users SET x=1 WHERE id=' + id)").some((h) => /SQL/i.test(h)));
});

test('does not false-positive on a plain relative import', () => {
  assert.deepEqual(detectSinks("import { x } from '../utils/helpers.js';"), []);
});
