# Claude Code self-hosted runners (ECS Fargate)

Runs Claude Code cloud sessions on our AWS so they can reach the Speakeasy MCP gateway, which
is only reachable over the tailnet. Every session gets its own Fargate task, destroyed when the
session ends. This follows Anthropic's [deployment guidance](https://code.claude.com/docs/en/self-hosted-environments-deploy):
one fresh container per runner, `--capacity 1`, and on-demand runners started by an orchestrator.

```
claude.ai ──queued session──▶ orchestrator (ECS service, 1 task)
                                 │ hooks/spawn-runner
                                 │  1. mints a single-use, ephemeral Tailscale key (tag:claude-session)
                                 │  2. aws ecs run-task, passing the work order + key as overrides
                                 ▼
                     session task (one per session, no IAM task role)
                       runner    claude self-hosted-runner --capacity 1
                                 Speakeasy gateway hostname → 127.0.0.1:443 → tailscale nc
                       postgres · redis · minio   (sidecars on localhost)
```

Terraform: `terraform/modules/claude_runners`, wired up in `terraform/sandbox/claude_runners.tf`
behind `claude_runners_enabled` (off by default). The image is built by
`.github/workflows/build_infra_images.yml` as `ghcr.io/polarsource/polar-claude-runner`.

## Security model

- **Session tasks hold no long-lived secrets.** The environment secret and the Tailscale OAuth
  client stay on the orchestrator, which never runs session code. A session task gets a
  single-use work order and a single-use Tailscale key that expires in 15 minutes. Its tailnet
  node is ephemeral and disappears with the task.
- **No AWS credentials in sessions.** The session task has an execution role, used by ECS to pull
  the image and write logs, and no task role.
- **Network:** open internet outbound, no inbound. The VPC is dedicated: it has no peering or
  private links to sandbox or production resources. On the tailnet, the access policy lets
  `tag:claude-session` reach only the gateway.
- **Only gateway traffic uses the tailnet.** The API stream to `api.anthropic.com`, GitHub and
  package registries go straight out through NAT, so no proxy can buffer the session stream.
- **Git:** `--use-anthropic-git-proxy`, so no GitHub token sits in the container.
- **Gateway tools:** `managed-settings.json` asks before every `mcp__speakeasy` tool call and
  disables bypass mode. Once we know the gateway's tool names, narrow `ask` to the destructive
  ones (deletes, bulk updates, resolve/ignore).
- **Known exposure:** the work order and the Tailscale key travel as `run-task` overrides,
  visible to anyone with `ecs:DescribeTasks` in the account. Both are single-use and consumed
  when the task starts.

## Setup

1. **claude.ai:** an Owner enables self-hosted environments (Admin settings → Cloud environments),
   creates an environment for the pilot, and copies its environment secret.
2. **Tailscale:**
   - Create an OAuth client with the *Auth Keys* write scope, limited to `tag:claude-session`.
   - Add this to the tailnet policy, with the gateway's real node or tag as `dst`. Make sure no
     wildcard grant also matches `tag:claude-session`.

     ```jsonc
     "tagOwners": { "tag:claude-session": ["autogroup:admin"] },
     "grants": [
       { "src": ["tag:claude-session"], "dst": ["<speakeasy-gateway>"], "ip": ["tcp:443"] }
     ]
     ```
3. **GitHub:** set the repository variable `CLAUDE_CODE_VERSION` (v2.1.318 or later), then run
   *Build Infrastructure Images* manually.
4. **HCP Terraform (sandbox):** set `claude_runner_environment_secret`,
   `claude_runner_tailscale_oauth_client_id`, `claude_runner_tailscale_oauth_client_secret`,
   `claude_runner_ghcr_username`, `claude_runner_ghcr_token` (read:packages) and
   `speakeasy_gateway_url`. Then set `claude_runners_enabled = true` and apply.
5. Start a session in the new environment from claude.ai/code. Check that a task appears in
   the `polar-sandbox` cluster and that `/mcp` lists `speakeasy`.

## Defaults worth revisiting

| Setting | Default | Notes |
|---|---|---|
| Task size | 4 vCPU / 16 GB / 100 GiB disk | About $0.20/hour on demand. `capacity_provider = "FARGATE_SPOT"` is cheaper; an interrupted session resumes on a new task. |
| `min_idle` | 0 | Pre-warmed standby tasks, to hide cold starts. Each one is a running task you pay for. |
| `release_idle_session_min` | 30 | An idle session's task is released. The session resumes on a new task, with its branch pushed first. |
| `kill_session_after_min` | 480 | Hard cap on a task's lifetime. |

## To verify in the pilot

- That hooks inherit the orchestrator's environment (`RUNNER_*`, `TS_*`). If they don't, have
  the entrypoint write those values to a file the hook sources.
- That the `PolarPermissionBoundary` allows `ecs:RunTask`, `ecs:TagResource` and
  `iam:PassRole` for the orchestrator role.
- Sidecar images come from Docker Hub through a shared NAT IP. If pulls hit rate limits, add an
  ECR pull-through cache.
- Cold start time from queued to first answer. Pre-baking `uv sync` and `pnpm install` caches into
  the image, or raising `min_idle`, are the levers.
