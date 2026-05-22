# Plain triage with Claude Managed Agents — self-hosted sandbox

A Claude Managed Agent that triages Plain support threads by adding an
**internal note** containing a summary and a **suggested reply**. It
does not — and structurally cannot — reply to customers directly.

## Architecture (A1 + B3 + C3)

```
┌─────────────────────────────────────────────────────────────────┐
│  Anthropic — agent loop only                                    │
│  - hosts the model + tool-dispatch loop                         │
│  - proxies MCP calls to mcp.plain.com using the vault cred      │
│  - dispatches built-in + custom tool calls to OUR worker        │
│    (no Anthropic-hosted sandbox container)                      │
└──────────────────┬────────────────────────────┬─────────────────┘
                   │ POST /v1/sessions (fire-   │ outbound long-
                   │ and-forget on webhook)     │ poll from worker
                   ▼                            ▼
┌─────────────────────────────────────┐  ┌──────────────────────┐
│ Polar API                           │  │ Self-hosted sandbox  │
│ webhook.py — verifies Plain HMAC,   │  │ worker.py — long-    │
│ creates the session, returns 202.   │  │ running EnvironmentWorker
│ ~120 LoC.                           │  │ process in Polar's   │
│                                     │  │ VPC. Holds the DB    │
│                                     │  │ pool against the     │
│                                     │  │ polar_read role over │
│                                     │  │ Tailscale.           │
└─────────────────────────────────────┘  └──────────┬───────────┘
                                                    │ SELECT only
                                                    ▼
                                            Polar Postgres
                                            (polar_read)
```

Why this shape:

1. **Webhook stays small.** The FastAPI endpoint does HMAC verify +
   `sessions.create()` + return 202. No streaming, no Dramatiq job, no
   in-process orchestrator. If the worker is down the session just
   queues until the worker reconnects.
2. **DB credential never enters Anthropic's infra.** The
   `EnvironmentWorker` runs in Polar's VPC, holds the asyncpg pool
   against the read-only role, and answers tool calls locally.
3. **Plain MCP stays cloud-routed.** Anthropic still dials
   `mcp.plain.com` from their orchestration layer with the vault
   credential. The Plain token also never enters our worker.
4. **Tool execution is in our trust boundary.** The `bash`/`read`/
   `write`/`edit`/`glob`/`grep` tools that the agent uses for scratch
   reasoning run inside our worker container, not an Anthropic
   sandbox — anything the agent writes to disk stays here.

## Safety — three layers that prevent direct replies

1. **Plain Machine User scope (server-enforced, strongest).** Bind the
   vault credential to a Plain Machine User with `note:create`,
   `thread:read`, `customer:read`, `customer:read:email`,
   `thread:search`, `label:create` scopes — and explicitly NOT
   `thread:reply` / `thread:edit`. Plain rejects the call at the API
   regardless of what the model attempts.
2. **`mcp_toolset` allowlist (config-enforced).** `agent.yaml` sets
   `default_config.enabled: false` on the Plain MCP toolset and opts in
   only to the tools triage needs. `replyToThread` is unreachable —
   the agent never sees the tool's schema. Writes get
   `permission_policy: always_ask`.
3. **No orchestrator-side denylist needed.** With the agent running
   autonomously (no `tool_confirmation` round-trip on Polar's side),
   defense relies on layers 1 and 2. If you want a hard runtime block,
   add a permission-policy intercept on the Anthropic side via a
   `user.tool_confirmation` webhook handler — see "Open questions"
   below.

The "suggested reply" is shaped as the body of an internal note
(Plain doesn't have a separate suggested-reply mutation, and
`createNote` is the right surface anyway — humans see it inline when
reviewing the thread).

## Files

| File | Role |
|---|---|
| `agent.yaml` | Agent definition. Apply with `ant beta:agents create < agent.yaml`. |
| `environment.yaml` | Self-hosted env config (`config.type: self_hosted`). Apply with `ant beta:environments create < environment.yaml`. |
| `webhook.py` | FastAPI router — receives Plain webhooks, fires `sessions.create()`. |
| `worker.py` | Long-running `EnvironmentWorker` — polls Anthropic for tool-execution work and runs DB queries against `polar_read`. |

## Running it locally without Plain webhooks

Plain webhooks aren't required for development. You can drive the
agent end-to-end from your laptop by:

1. running the worker against a local Postgres,
2. provisioning the Anthropic resources once (agent + env + vault),
3. kicking off a session via `python -m polar.managed_agents.trigger`
   (or `ant beta:sessions create`).

### Step 1 — local DB

```sh
cd server
docker compose up -d
./dev/setup-environment

# Sanity-check the read-only role docker-compose ships with.
docker compose exec db psql -U polar_read -d polar_development -c "SELECT 1"

# DSN for the worker (points at the local DB):
export POLAR_MANAGED_READ_DSN="postgresql://polar_read:polar@127.0.0.1:5432/polar_development"
```

### Step 2 — install Anthropic CLI + sync deps

```sh
brew install anthropics/tap/ant
xattr -d com.apple.quarantine "$(brew --prefix)/bin/ant"
export ANTHROPIC_API_KEY=sk-ant-...   # console.anthropic.com → API keys

cd server
uv sync   # picks up the new anthropic dep
```

### Step 3 — provision agent + environment (one-time)

```sh
cd server/polar/managed_agents

# Self-hosted environment.
export POLAR_MANAGED_ENV_ID=$(ant beta:environments create < environment.yaml \
  --transform id -r)

# Agent — if you don't want to OAuth Plain right now, comment out the
# `mcp_servers` and the `mcp_toolset` block in agent.yaml before this
# call (local testing without Plain is fine; the DB tools still work).
export POLAR_MANAGED_AGENT_ID=$(ant beta:agents create < agent.yaml \
  --transform id -r)

# Vault — REQUIRED on the session even if you stripped Plain MCP. Create
# an empty one for now; add credentials later when you wire Plain.
export POLAR_MANAGED_VAULT_ID=$(ant beta:vaults create \
  --display-name polar-plain-triage-local \
  --transform id -r)

echo "POLAR_MANAGED_AGENT_ID=$POLAR_MANAGED_AGENT_ID"
echo "POLAR_MANAGED_ENV_ID=$POLAR_MANAGED_ENV_ID"
echo "POLAR_MANAGED_VAULT_ID=$POLAR_MANAGED_VAULT_ID"
```

### Step 4 — get the environment key

Open the [Anthropic Console](https://platform.claude.com), find the
`polar-plain-triage` environment, click **Generate environment key**,
copy the `sk-ant-oat01-...` value.

```sh
export ANTHROPIC_ENVIRONMENT_KEY=sk-ant-oat01-...
```

### Step 5 — run the worker

```sh
cd server
uv run python -m polar.managed_agents.worker
# expect: "DB pool ready..." then "starting EnvironmentWorker..."
```

The worker stays long-polling. Leave it running in this terminal.

### Step 6 — trigger a session (from another terminal)

```sh
cd server
# Use any value for thread_id when Plain MCP is stripped — the
# agent will fail getThreadDetails but the DB tools still run.
uv run python -m polar.managed_agents.trigger thr_local_test_123
```

The script prints a Console URL — open it to watch tool calls land,
events stream, and the agent reason in real time. Worker logs in
terminal 5 should show each `polar_*` DB tool being executed.

### Optional — exercise the webhook path with ngrok

If you want to test the FastAPI webhook handler itself (not just the
worker), expose your local API via ngrok:

```sh
# Terminal 1
cd server && uv run task api          # 127.0.0.1:8000

# Terminal 2
ngrok http 8000                       # → https://abc123.ngrok-free.app

# In Plain → Settings → Webhooks, point at
# https://abc123.ngrok-free.app/v1/managed_agents/plain/webhook
# Subscribe to thread.thread_created only.
# Copy the secret Plain shows you into POLAR_PLAIN_WEBHOOK_SECRET.

export POLAR_PLAIN_WEBHOOK_SECRET=plain_whsec_...
```

You can also forge a webhook locally without Plain:

```sh
BODY='{"type":"thread.thread_created","payload":{"thread":{"id":"thr_test"}}}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$POLAR_PLAIN_WEBHOOK_SECRET" | awk '{print $2}')
curl -X POST http://127.0.0.1:8000/v1/managed_agents/plain/webhook \
  -H "Content-Type: application/json" \
  -H "plain-request-signature: $SIG" \
  -d "$BODY"
# → {"status":"queued","session_id":"sesn_...","thread_id":"thr_test"}
```

## Production setup

### 1. Install the Anthropic CLI

```sh
brew install anthropics/tap/ant
xattr -d com.apple.quarantine "$(brew --prefix)/bin/ant"
```

### 2. Create a Plain Machine User and OAuth-connect

In Plain → Settings → API → Machine users, create
`polar-triage-agent` with the scopes listed under "Safety" above (no
`thread:reply`). OAuth-connect via:

```sh
npx -y mcp-remote https://mcp.plain.com/mcp
```

Browser opens, log in as the Machine User, then read the tokens out of
`~/.mcp-auth/` for the vault credential payload.

### 3. Apply environment + agent + vault

```sh
export ANTHROPIC_API_KEY=...

POLAR_MANAGED_ENV_ID=$(ant beta:environments create < environment.yaml \
  --transform id -r)
POLAR_MANAGED_AGENT_ID=$(ant beta:agents create < agent.yaml \
  --transform id -r)

POLAR_MANAGED_VAULT_ID=$(ant beta:vaults create \
  --display-name polar-plain-triage \
  --transform id -r)

ant beta:vaults:credentials create \
  --vault-id "$POLAR_MANAGED_VAULT_ID" \
  --display-name "Plain MCP (polar-plain-triage)" \
  --auth '{
    type: mcp_oauth,
    mcp_server_url: https://mcp.plain.com/mcp,
    access_token: '"$PLAIN_MCP_ACCESS_TOKEN"',
    expires_at: '"$PLAIN_MCP_TOKEN_EXPIRES_AT"',
    refresh: {
      refresh_token: '"$PLAIN_MCP_REFRESH_TOKEN"',
      client_id: '"$PLAIN_MCP_CLIENT_ID"',
      token_endpoint: https://mcp.plain.com/oauth/token,
      token_endpoint_auth: { type: none },
    }
  }'

echo "POLAR_MANAGED_ENV_ID=$POLAR_MANAGED_ENV_ID"
echo "POLAR_MANAGED_AGENT_ID=$POLAR_MANAGED_AGENT_ID"
echo "POLAR_MANAGED_VAULT_ID=$POLAR_MANAGED_VAULT_ID"
```

### 4. Generate an environment key

In the Anthropic Console open the `polar-plain-triage` environment and
click "Generate environment key" — this returns an
`sk-ant-oat01-...` token scoped to that environment's work queue.
Store as `ANTHROPIC_ENVIRONMENT_KEY` in the worker's env. **This is
NOT the same as `ANTHROPIC_API_KEY`** — don't set both on the worker
host. The env key intentionally has less reach (one environment's
queue) so a leak doesn't compromise the whole workspace.

### 5. Configure env vars

In Polar's `config.py` the new entries are:

```
POLAR_MANAGED_AGENT_ID
POLAR_MANAGED_ENV_ID
POLAR_MANAGED_VAULT_ID
POLAR_MANAGED_READ_DSN
```

Plus on the worker host only:

```
ANTHROPIC_ENVIRONMENT_KEY    # from step 4
POLAR_MANAGED_READ_DSN       # postgresql://polar_read:...@... over Tailscale
```

Plus on the API host only:

```
ANTHROPIC_API_KEY            # for the webhook to call sessions.create()
PLAIN_REQUEST_SIGNING_SECRET # already exists; used by other Plain integrations too
```

### 6. Wire the webhook route into FastAPI

Add to `server/polar/api.py` next to the other integration routers:

```python
from polar.managed_agents.webhook import router as managed_agents_router
...
router.include_router(managed_agents_router)
```

### 7. Subscribe the webhook in Plain

Plain → Settings → Webhooks → add
`https://api.polar.sh/v1/managed_agents/plain/webhook`, subscribe to
`thread.thread_created` only, and copy the shared secret into
`PLAIN_REQUEST_SIGNING_SECRET`.

### 8. Deploy the worker

Run `polar.managed_agents.worker` as a separate long-running process —
the Render equivalent is a "Background Worker" service distinct from
the existing Dramatiq worker. Do not bolt it onto the Dramatiq worker:
the `EnvironmentWorker` owns its asyncio loop, and mixing it with
Dramatiq's loop ownership is fragile.

Minimal Render config: same image as the API/worker, with
`startCommand: uv run python -m polar.managed_agents.worker`.

## Reference the Support SOP

The Google Doc support SOP plugs in as a Custom Skill — Claude
auto-loads it when relevant, instead of bloating the system prompt.

One-time setup:

1. Export the Google Doc as Markdown (File → Download → Markdown). The
   first paragraph becomes the description Claude sees by default —
   keep it under ~200 chars and write it as a short pitch ("Polar's
   support SOP: refund policy, severity tiers, escalation paths,
   things the AI is NOT allowed to do unilaterally").

2. Create the skill:

   ```sh
   ant beta:skills create \
     --display-name "polar-support-sop" \
     --source-dir ./polar-support-sop \
     --transform id -r
   ```

3. Paste the returned skill_id into the commented `skills:` block in
   `agent.yaml`, then push the agent update:

   ```sh
   ant beta:agents update --agent-id "$POLAR_MANAGED_AGENT_ID" \
     --version <current_version> < agent.yaml
   ```

## Where the orchestrator lives — revisited

What's on Polar's side under B3+C3:

| Component | Where | Why |
|---|---|---|
| `webhook.py` | Polar API | Plain delivers to our URL; we translate the payload into `sessions.create()` |
| `worker.py` | new background-worker container | self-hosted sandbox needs an `EnvironmentWorker` poller in our VPC |
| DB pool | inside `worker.py` | DB credential stays in our VPC |
| Plain OAuth credential | Anthropic vault | injected after the sandbox boundary; never enters our worker |
| Agent loop | Anthropic | runs the model + dispatches tool calls |

The webhook handler is ~120 lines; the worker is ~270 lines (most of
which is the SQL for the four DB tools). If you want it smaller, the
next step is **MCP Tunnels** when out of research preview: replace
`worker.py`'s @beta_tool functions with a Postgres MCP server in the
VPC, tunneled to Anthropic. Then the worker disappears entirely and
the DB tools become a third MCP server alongside Plain.

## Open questions / follow-ups

- **Custom-tool API drift.** `worker.py` uses what we believe is the
  correct shape for composing `beta_agent_toolset` + `@beta_tool`
  custom tools into `EnvironmentWorker`. If the installed Anthropic
  SDK version exposes a different signature (e.g.
  `tool_runner()`-based composition), adjust the imports and the
  `EnvironmentWorker(tools=…)` call accordingly — follow
  `shared/managed-agents-self-hosted-sandboxes.md` in the
  Anthropic docs.
- **Pre-flight smoke test.** The first time you deploy, the worker
  has to reach Anthropic's work queue AND the Postgres DB. A
  `--smoke-test` mode that does both connection checks and exits 0
  would catch misconfigs at deploy time instead of during the first
  webhook.
- **Slack approvals (optional).** If the team wants a human-in-the-
  loop on createNote, swap the per-tool `permission_policy` from
  `always_ask` (which currently has no orchestrator to answer it) to
  a Slack block-kit message via an Anthropic webhook that listens for
  `session.status_idled` with `requires_action`.
- **MCP Tunnels.** When out of research preview, switch the DB
  tools from `@beta_tool` in `worker.py` to a Postgres MCP server
  tunneled in. `worker.py` disappears, the agent calls SQL through
  MCP directly, and Polar runs only the webhook + the MCP server.
- **Tier 2 review findings from `/code-review`** still applicable:
  custom-tool errors should set `is_error: true` on the result; no
  driver-level read-only enforcement (the
  `default_transaction_read_only=on` server_setting now in `worker.py`
  closes this for Postgres).
