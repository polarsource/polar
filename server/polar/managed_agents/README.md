# Plain triage with Claude Managed Agents

A Claude Managed Agent that triages Plain support threads by adding an
**internal note** containing a summary and a **suggested reply**. It
does not — and structurally cannot — reply to customers directly.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Anthropic — managed-agents control plane                       │
│  - hosts the agent loop (model + tool dispatch)                 │
│  - serves the cloud sandbox container (file ops, scratch)       │
│  - proxies MCP calls to mcp.plain.com using the vault cred      │
└──────────────────┬──────────────────────────────────────────────┘
                   │  SSE event stream + events.send()
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│  Orchestrator — server/polar/managed_agents/triage.py           │
│  Runs inside Polar's infra (already on Tailscale to prod DB).   │
│  - kicks the session off with one user.message                  │
│  - answers agent.custom_tool_use (DB lookups) via asyncpg       │
│    against the polar_read Postgres role                         │
│  - approves/denies agent.mcp_tool_use confirmations             │
│  - the denylist refuses replyToThread even if it slipped in     │
└─────────────────────────────────────────────────────────────────┘
```

Why this shape:

1. **DB credential never leaves Polar's VPC.** The agent's sandbox has
   no Postgres access; it asks the orchestrator (which is already on
   Tailscale) via custom tool calls. The DB password lives in the
   orchestrator's env, exactly where it lives today.
2. **Cloud sandbox, not self-hosted.** Self-hosted sandboxes would run
   the worker in Polar's infra, but they add a long-running poller and
   require operating an additional service. The custom-tool pattern
   keeps the same DB-isolation property without the extra moving piece.
   MCP Tunnels would be cleaner long-term but are still in research
   preview at time of writing.
3. **Plain MCP via vault.** Plain ships an official MCP server at
   `https://mcp.plain.com/mcp`. Anthropic injects the OAuth credential
   from the vault after the request leaves the sandbox, so the Plain
   token also never sits inside the agent container.

## Safety — why the agent can't reply directly

Three layers, in order of strength:

1. **Plain Machine User scope (server-enforced, strongest).** Bind the
   vault credential to a Plain Machine User whose scopes include
   `note:create`, `thread:read`, `customer:read`, `customer:read:email`,
   `thread:search`, `label:create` — and explicitly NOT
   `thread:reply` / `thread:edit`. Plain rejects the call at the API
   regardless of what the model attempts.
2. **`mcp_toolset` allowlist (config-enforced).** `agent.yaml` sets
   `default_config.enabled: false` on the Plain MCP toolset and opts in
   only to the tools triage needs (`getThreadDetails`, `createNote`,
   etc.). `replyToThread` is unreachable — the agent never sees the
   tool's schema. Writes (`createNote`, `addLabels`, `assignThread`,
   `changeThreadPriority`) require human confirmation via
   `permission_policy: always_ask`.
3. **Orchestrator denylist (runtime-enforced).** `triage.py`'s
   `DENY_TOOLS` set rejects any `tool_confirmation` for
   `replyToThread`, `createThread`, `upsertCustomer`, `upsertTenant`, or
   schema mutations — even if a future agent.yaml edit accidentally
   enables one.

The "suggested reply" is therefore always shaped as the body of an
internal note (Plain doesn't have a separate suggested-reply mutation,
and `createNote` is the right surface anyway — humans see it inline
when reviewing the thread).

## Files

| File | What it is |
|---|---|
| `agent.yaml` | Agent definition. Apply with `ant beta:agents create < agent.yaml`. |
| `environment.yaml` | Cloud sandbox config. Apply with `ant beta:environments create < environment.yaml`. |
| `setup.py` | One-time programmatic alternative — creates env + agent + vault using the SDK. |
| `triage.py` | The orchestrator. Run once per thread to triage. |

## Setup

### 1. Install the Anthropic CLI

```sh
brew install anthropics/tap/ant
xattr -d com.apple.quarantine "$(brew --prefix)/bin/ant"
```

Linux/WSL: see the install instructions at
<https://platform.claude.com/docs/en/api/sdks/cli>.

### 2. Create a Plain Machine User and OAuth-connect

In Plain → Settings → API → Machine users, create
`polar-triage-agent` with the scopes listed above (no `thread:reply`).

Then connect via OAuth. The simplest one-time path uses
`mcp-remote`:

```sh
npx -y mcp-remote https://mcp.plain.com/mcp
```

This opens a browser, prompts you to log in as the Machine User, and
caches the OAuth tokens to `~/.mcp-auth/`. Read the `access_token`,
`refresh_token`, `expires_at`, and `client_id` out of that file (or
inspect the browser dev tools network tab during the flow).

### 3. Apply the agent and environment

Preferred — version-controlled YAML via `ant`:

```sh
export ANTHROPIC_API_KEY=...

POLAR_MANAGED_ENV_ID=$(ant beta:environments create < environment.yaml \
  --transform id -r)
POLAR_MANAGED_AGENT_ID=$(ant beta:agents create < agent.yaml \
  --transform id -r)

# Create the vault and add the Plain credential.
POLAR_MANAGED_VAULT_ID=$(ant beta:vaults create \
  --name polar-plain-triage \
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

# Persist the three IDs in your env (1Password, Render env, .envrc, etc.).
echo "POLAR_MANAGED_ENV_ID=$POLAR_MANAGED_ENV_ID"
echo "POLAR_MANAGED_AGENT_ID=$POLAR_MANAGED_AGENT_ID"
echo "POLAR_MANAGED_VAULT_ID=$POLAR_MANAGED_VAULT_ID"
```

Alternative — programmatic setup via the SDK:

```sh
uv add anthropic asyncpg pyyaml
PLAIN_MCP_ACCESS_TOKEN=... \
PLAIN_MCP_REFRESH_TOKEN=... \
PLAIN_MCP_TOKEN_EXPIRES_AT=... \
PLAIN_MCP_CLIENT_ID=... \
uv run python -m polar.managed_agents.setup
```

### 4. Wire up the read-only DB DSN

In **development** point `POLAR_MANAGED_READ_DSN` at the local docker
DB's `polar_read` user:

```sh
export POLAR_MANAGED_READ_DSN=postgresql://polar_read:polar@127.0.0.1:5432/polar_development
```

In **production** point it at the prod DB through Tailscale, using a
dedicated read-only role (NOT `polar`/`polar_read` from
docker-compose — provision a real prod role with the same shape). The
orchestrator should be deployed inside Polar's infra so the Tailscale
route is available.

### 5. Run

```sh
export ANTHROPIC_API_KEY=...
export POLAR_MANAGED_AGENT_ID=agent_...
export POLAR_MANAGED_ENV_ID=env_...
export POLAR_MANAGED_VAULT_ID=vlt_...
export POLAR_MANAGED_READ_DSN=postgresql://...

uv run python -m polar.managed_agents.triage <plain_thread_id>
```

The orchestrator prints a Console URL on session start —
follow along visually instead of parsing the event stream:

```
session: https://platform.claude.com/workspaces/default/sessions/sesn_...
```

When the agent reaches a write tool (`createNote`, `addLabels`,
`assignThread`, `changeThreadPriority`) the CLI prompts for approval.
Type `y` to allow, blank or `n` to deny silently, or free-text to deny
with that text as the reason fed back to the model.

## Iterating on the agent

The agent is a versioned resource. To tweak the system prompt or
tool surface:

```sh
# Get the current version.
ant beta:agents retrieve --agent-id "$POLAR_MANAGED_AGENT_ID" \
  --transform '{version}' --format yaml

# Edit agent.yaml, then push as the next version.
ant beta:agents update --agent-id "$POLAR_MANAGED_AGENT_ID" \
  --version <current_version> < agent.yaml
```

Sessions in flight keep their pinned version; new sessions pick up the
latest. Roll back by starting sessions with an explicit `version`.

## Open questions / follow-ups

- **Automate the trigger.** Today this is a CLI driven manually. To run
  on every new Plain thread, set up Plain → Webhooks pointing at a new
  FastAPI route in `server/polar/integrations/plain/endpoints.py` that
  invokes `triage.run(thread_id)` as a background task (Dramatiq).
- **Slack approvals.** Replace `_prompt_confirmation` with a Slack
  block-kit interactive message if you want unattended operation
  outside engineering hours.
- **Tighten the DB tools.** The current queries assume the schema
  shapes in `server/polar/models/`. If those drift, the tools start
  returning errors — re-check column names whenever an order/
  subscription migration lands. Consider pointing the orchestrator at
  a read replica with `statement_timeout=15s` so a runaway query can't
  affect prod.
- **MCP Tunnels.** When MCP Tunnels exit research preview, consider
  switching the DB access path from "custom tool" to "private Postgres
  MCP server tunneled in" — that lets Claude write Postgres-flavoured
  queries directly while keeping the DB private.
