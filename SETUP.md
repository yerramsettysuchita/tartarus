# ⚙️ Tartarus, Setup Guide

A foolproof, click-by-click path from an empty machine to a live hunt. Follow it
in order; each step ends with a check so you know it worked before moving on.

**Prerequisites:** Node.js ≥ 22.14 · an Anthropic API key · a GitHub fine-grained
PAT (Contents + Pull requests: read/write) · a Daytona API key (with **Snapshots:
write**).

---

## 0. Install & configure Tartarus

```bash
npm install
cp .env.example .env
```

Open `.env` and fill in every value. The ones that matter most:

| Variable | What to put |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Your Anthropic key (also entered in the TrueForge UI, step 2). |
| `TARTARUS_MODEL` | `anthropic/claude-sonnet-4-6` (default). |
| `TARTARUS_MCP_TOKEN` | A long random string, the shared secret between TrueForge and our tools. |
| `TARTARUS_MCP_URL` | See **step 4**, this depends on how you run TrueForge. |
| `GITHUB_TOKEN` / `TARGET_REPO` | Your PAT and `your-org/Tartarus-Patient-Zero`. |
| `DAYTONA_API_KEY` | Your Daytona key. |
| `DAYTONA_NODE_IMAGE` | Leave as `node:22`, **required** for `node:sqlite` in the sandbox. |

✅ **Check:** `npm run build` completes with no errors.

---

## 1. Start the TrueForge harness

Pick **one** mode. This choice determines your `TARTARUS_MCP_URL` in step 4.

**Mode A, local (`npx`), simplest:**
```bash
npx @truefoundry/trueforge@latest      # opens http://localhost:8790
```

**Mode B, Docker Compose (hosted):**
```bash
git clone https://github.com/truefoundry/trueforge && cd trueforge
cp packages/trueforge/.env.example packages/trueforge/.env
docker compose up --build              # opens http://localhost:8791
```

✅ **Check:** the TrueForge UI loads in your browser.

---

## 2. Add the Anthropic model

In the TrueForge UI:

1. **Settings → Models** (or "Model providers").
2. Choose the **Anthropic** preset from the catalog.
3. Paste your `ANTHROPIC_API_KEY`. Save.

✅ **Check:** `anthropic/claude-sonnet-4-6` appears in the model list.

---

## 3. Add the Daytona sandbox

1. **Settings → Sandbox providers.**
2. Choose the **Daytona** preset.
3. Paste your `DAYTONA_API_KEY`. Save.

> ⚠️ The Daytona key must have **Snapshots: write** (not just Sandboxes). TrueForge
> and our tool both provision sandboxes from a snapshot; without this permission
> the first detonation fails.

✅ **Check:** the sandbox provider shows as "configured".

---

## 4. Point Tartarus's tools at TrueForge (the networking step)

This is the one edge case that trips people up. The Tartarus MCP tool server runs
on your **host** at port `8123`. Whether TrueForge can reach it at `localhost`
depends on where *TrueForge* runs:

| You started TrueForge with… | Set `TARTARUS_MCP_URL` to | Why |
|-----------------------------|---------------------------|-----|
| **`npx` (Mode A)**, same host | `http://localhost:8123/mcp` | Both processes share the host's network. |
| **Docker Compose (Mode B)**, in a container | `http://host.docker.internal:8123/mcp` | Inside a container, `localhost` is the container itself. `host.docker.internal` resolves to your host machine. |

> **Linux + Docker note:** `host.docker.internal` isn't defined by default on
> Linux. Add this to the TrueForge service in its `docker-compose.yml`:
> ```yaml
> extra_hosts:
>   - "host.docker.internal:host-gateway"
> ```

Now start the tool server and register it:

```bash
npm run mcp          # terminal 2 → "Tartarus MCP tools live on http://localhost:8123/mcp"
npm run register     # terminal 3 → registers the connector with TrueForge
```

✅ **Check:** `npm run register` prints `✓ Registered MCP connector "tartarus-tools"`,
and in the TrueForge UI under **Settings → Connectors** you see `tartarus-tools`
with its four tools.

> **If register fails:** the MCP server (`npm run mcp`) reaches TrueForge at
> `TRUEFORGE_BASE_URL`. In Mode B that's `http://localhost:8791` from your host , 
> which is correct because the tool server runs on the host, not in the container.

---

## 5. Pre-flight, then live hunt

**Always run the doctor first**, it verifies all four services in one shot so
nothing fails on camera:

```bash
npm run doctor
```

It checks: `.env` validity · TrueForge up · MCP server listening + token accepted ·
GitHub token can read **and push** to the target · Daytona credentials valid. Each
failure prints the exact fix. When it says **"All systems go"**, hunt:

```bash
npm run hunt -- your-org/Tartarus-Patient-Zero
```

You'll see: 🟢 scan → 🔴 detonate (real exploit in the sandbox) → 🟡 **gold gate**
(answer `y`) → 🔷 PR opened.

**If anything misbehaves, run with verbose logging:**
```bash
npm run mcp:debug        # terminal 2: logs every MCP tool payload (secrets redacted)
npm run hunt -- --debug your-org/Tartarus-Patient-Zero   # terminal 3: logs every harness event
```

---

## 6. (Optional) The Command Center web dashboard

For the cinematic web UI instead of (or alongside) the terminal:

```bash
npm run ui:build                       # build the dashboard once (outputs ui/dist)
npm run hunt:ui -- your-org/Tartarus-Patient-Zero
```

The hunt starts the hub on `TARTARUS_UI_PORT` (default **8799**) and serves the
dashboard there, open **http://localhost:8799**. The gold gate appears as an
approval modal in the browser; click **Approve** to open the PR.

For UI development with hot reload, run the hunt (`npm run hunt:ui`) and, in
another terminal, `npm run ui:dev` (Vite dev server on :5273, proxying `/api` to
the hub).

---

## Troubleshooting quick table

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `register` 4xx / connector never appears | TrueForge can't be reached at `TRUEFORGE_BASE_URL` | Confirm the port (8790 npx / 8791 compose). |
| Tool calls time out from TrueForge | Wrong `TARTARUS_MCP_URL` for your mode | Use the table in step 4 (`host.docker.internal` for Docker). |
| Detonation: `Cannot find module 'node:sqlite'` | Sandbox Node < 22 | Ensure `DAYTONA_NODE_IMAGE=node:22`. |
| `run_exploit_in_sandbox` timeout | Daytona slow / snapshot missing | Check the Snapshots: write permission; retry (the tool returns a retryable error). |
| GitHub 403 during scan | Rate limit or token scope | Octokit auto-retries; if it persists, check PAT scopes or lower `maxFiles`. |
| Sandbox never tears down | Crash before `finally` | Rare; the sandbox is always deleted in `finally`. Check the Daytona dashboard. |

---

Once a live hunt opens a real PR against Patient-Zero and Qodo reviews it, you're
submission-ready. See [`README.md`](README.md) for the demo-video script.
