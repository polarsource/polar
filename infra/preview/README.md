# Preview environments

One exe.dev VM per PR, cloned from a golden image (`polar-base`). Each VM runs the
full stack (uvicorn :10000, dramatiq, redis :6379, `next dev` :3000) behind Caddy
(:8000), served tailnet-only at `https://pr-<N>.<tailnet>.ts.net` — Caddy also listens
on :443 and terminates TLS with a MagicDNS certificate fetched from tailscaled
(`get_certificate tailscale`; deploy.sh sets `tailscale set --operator=caddy`).
OpenCode 2 runs as a root systemd service on :4097 and is exposed through Caddy on
the tailnet-only HTTPS port :4096.
Postgres (template-copied database per preview) and Tinybird (branch per preview) are
shared services provisioned by `server/scripts/preview.py` from the GitHub workflow.

## Prerequisites

- exe.dev account with the CI SSH keypair registered (`ssh exe.dev ssh-key add`).
- Tailscale trust credential with Auth Keys write and tag `tag:preview` only.
  Minted keys must carry the credential's exact tag set. Editing a credential's tags
  does not re-scope already-issued secrets — regenerate the secret after editing.
- GitHub secrets: `POLAR_PREVIEW_SSH_KEY` (exe.dev account key),
  `POLAR_PREVIEW_TAILSCALE_OAUTH_SECRET` (trust credential secret),
  `POLAR_PREVIEW_STRIPE_SECRET_KEY`, `POLAR_PREVIEW_STRIPE_WEBHOOK_SECRET`,
  `POLAR_PREVIEW_PYDANTIC_AI_GATEWAY_API_KEY`, plus the existing
  `POLAR_PREVIEW_POSTGRES_ADMIN_DSN` and `POLAR_PREVIEW_TINYBIRD_ADMIN_TOKEN`.
- Tailnet policy: members can reach `tag:preview` on 443; `tag:preview` can reach the
  preview Postgres on 5432 and nothing else; MagicDNS + HTTPS certificates enabled.

## Base image

Build (setup scripts run unprivileged on exe.dev, so run over SSH with sudo):

```bash
ssh exe.dev new --name=polar-base
ssh polar-base.exe.xyz "sudo git clone --depth 50 https://github.com/polarsource/polar.git /srv/polar && sudo bash /srv/polar/infra/preview/setup-base-vm.sh"
```

This installs the toolchain (uv, Node 24, pnpm, OpenCode 2, Caddy, redis, tailscale), clones the
repo to `/srv/polar`, warms dependencies (`uv sync`, `pnpm install`, email renderer,
backoffice assets), and installs `/srv/preview-tools` and the systemd units. Tailscale
is installed but not joined (clones would duplicate the node identity), and no secrets
are baked in. `polar-backend`/`polar-frontend` are gated on `ConditionPathExists` for
their env files, so fresh clones boot idle until the first deploy.

Update (after dependency drift or infra/preview changes — do this every few weeks):

```bash
ssh polar-base.exe.xyz "cd /srv/polar && sudo git fetch origin main && sudo git checkout -f origin/main && sudo bash infra/preview/setup-base-vm.sh"
```

Or rebuild from scratch: `ssh exe.dev rm polar-base` and run the build again.

## Deploys

`.github/workflows/preview.yml`, on PR open/reopen/push (or `workflow_dispatch`):

1. Provisions the preview database and Tinybird branch (`scripts.preview`).
2. Clones the VM if missing: `ssh exe.dev cp polar-base pr-<N>` (~1 s, copy-on-write).
3. Mints a single-use ephemeral Tailscale key (10 min TTL) via the trust credential.
4. Pipes a JSON payload over SSH to `sudo /srv/preview-tools/deploy.sh`, which joins
   the tailnet (first deploy only), checks out the SHA, delta-builds, writes env
   files, migrates, loads readiness-critical seed data, restarts the services,
   and starts a deferred background seed for the remaining demo data. OpenCode 2 is
   already enabled from the base image and becomes reachable at port 4096 after the
   Tailscale join.

On PR close: `ssh exe.dev rm pr-<N>` plus `scripts.preview destroy`.

## Access and debugging

- Preview URL is tailnet-only; the `pr-<N>.exe.xyz` URL stays private to the account.
- OpenCode 2 is available to tailnet clients at `https://pr-<N>.<tailnet>.ts.net:4096`.
  Run `opencode2 --server https://pr-<N>.<tailnet>.ts.net:4096` locally to connect to
  the server operating on `/srv/polar` in that VM.
- Logs: `https://pr-<N>.<tailnet>.ts.net/_logs/backend` (and `/_logs/frontend`); login
  OTP codes appear there (`LOGIN CODE`).
- Shell: `ssh pr-<N>.exe.xyz` (lands as `exedev` with passwordless sudo, regardless of
  the username given).
- Port 9999 is taken by Shelley on every exeuntu VM; the log viewer uses 9990.
