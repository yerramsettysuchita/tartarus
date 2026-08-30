# 🔑 Tartarus .env Guide

This is the exact, step-by-step checklist to fill your `.env` and turn the engine
on. Three of the four services are free. The only one that may cost a little is
the language model, and roughly five dollars of credit is plenty for a demo.

Start by copying the template:

```bash
cp .env.example .env
```

Then fill each value below.

---

## 1. The language model (the one paid piece)

The agent needs a model to reason. Pick one of these.

### Option A, Anthropic Claude (recommended)

1. Go to https://console.anthropic.com and sign in.
2. Open Billing and add about five dollars of credit.
3. Open API Keys and create a key. It starts with `sk-ant-`.
4. Put it in `.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
   TARTARUS_MODEL=anthropic/claude-sonnet-4-6
   ```
5. In the TrueForge UI later, add the Anthropic provider and paste the same key.

### Option B, OpenAI

TrueForge is vendor-neutral, so an OpenAI key works too.

1. Go to https://platform.openai.com, add a few dollars of credit, and create a key (starts with `sk-`).
2. In the TrueForge UI, add the OpenAI provider with that key, and set `TARTARUS_MODEL` to the OpenAI model id TrueForge shows, for example `openai/gpt-4o`.

> Before paying, check the hackathon Discord and resources. Organisers often
> provide model credits or a TrueFoundry gateway key. If they do, use that and
> skip the billing step entirely.

---

## 2. GitHub token (free)

Tartarus reads the target repo and opens pull requests, so it needs a token.

1. Go to https://github.com/settings/tokens and choose Fine-grained tokens, then Generate new token.
2. Resource owner: your account. Repository access: pick your `Tartarus-Patient-Zero` repo (or All repositories).
3. Repository permissions, set these to Read and write:
   - Contents
   - Pull requests
   - Webhooks (only needed for Sentinel Mode, optional)
4. Generate, copy the token (starts with `github_pat_`), and set:
   ```
   GITHUB_TOKEN=github_pat_xxxxxxxx
   TARGET_REPO=your-username/Tartarus-Patient-Zero
   ```

---

## 3. Daytona sandbox (free tier)

This is where exploits detonate in isolation.

1. Go to https://app.daytona.io and sign in.
2. Create an API key. Important: it needs Snapshots write permission, not just Sandboxes, because TrueForge and our tool clone sandboxes from a snapshot.
3. Set:
   ```
   DAYTONA_API_KEY=dtn_xxxxxxxx
   DAYTONA_API_URL=https://app.daytona.io/api
   DAYTONA_TARGET=us
   DAYTONA_NODE_IMAGE=node:22
   ```
   Leave `DAYTONA_NODE_IMAGE` as `node:22`. It is required for the built-in
   `node:sqlite` module used by the demo target.

---

## 4. The tool server secret (free, you invent it)

This is a shared secret between TrueForge and our tools. Pick any long random string.

```
TARTARUS_MCP_TOKEN=paste-a-long-random-string-here
TARTARUS_MCP_URL=http://localhost:8123/mcp
TARTARUS_MCP_PORT=8123
```

A quick way to generate one:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

---

## 5. Optional, Sentinel Mode and the dashboard

Only needed for the zero-click webhook flow and the web dashboard.

```
GITHUB_WEBHOOK_SECRET=another-long-random-string
TARTARUS_UI_PORT=8799
NGROK_AUTHTOKEN=            # optional, else the tunnel falls back to localtunnel
```

The `GITHUB_WEBHOOK_SECRET` must match the secret you set on the GitHub webhook.

---

## Verify before you run

```bash
npm run build      # should complete with no errors
npm run doctor     # checks all four services and prints the exact fix for any failure
```

When `npm run doctor` says all systems go, you are ready:

```bash
npm run mcp                 # terminal 1, the tool server
npm run register            # once, registers the tools with TrueForge
npm run hunt:ui -- your-username/Tartarus-Patient-Zero   # the live hunt with the dashboard
```

If anything fails, run with verbose logging and share the output:

```bash
npm run mcp:debug
npm run hunt -- --debug your-username/Tartarus-Patient-Zero
```
