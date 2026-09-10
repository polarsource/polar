# Polar CLI

A Polar CLI for your terminal.

- Tunnel Webhooks to your local environment
- Initialize Polar boilerplate with a single command
- And much more...

Currently in development.

## Telemetry

Every command reports one anonymous `cli_command` event straight to PostHog when
it finishes: the command path (for example `auth login`), the names of the flags
used (never their values), whether it succeeded, failed or was interrupted, the
error type, the duration, the CLI version, OS, architecture, Bun version, whether
it ran in CI, and which AI coding agent (if any) invoked it. Events are keyed by a
random install id stored in `~/.polar/telemetry.json`. Access tokens,
organization IDs, URLs and payloads are never sent. The PostHog project key is a
public write-only token, the same one the website uses.

Telemetry is wired around the root command in `src/cli.ts`, so new commands are
covered automatically. Only the compiled release binary sends events; running
from source or from `bin/cli.js` sends nothing. Opt out with
`POLAR_CLI_TELEMETRY_OPTOUT=1` (`DO_NOT_TRACK=1` is honoured too).

## Development

From `clients/`, install dependencies with `pnpm install`, then use
`pnpm --filter polar-cli test`, `typecheck`, `format`, or `lint`.
Bun `1.4.2` is the runtime, test runner, and binary compiler; pnpm manages dependencies.

Run the CLI from source with `bun src/cli.ts <command>` in this directory, or
compile the release binary with `pnpm build:binary` and run `./polar`.

**To run against a local Polar API** instead of sandbox or production, point the CLI
at it with `POLAR_API_URL` and authenticate with an organization access token
created in the local dashboard (scopes `webhooks:read`, `webhooks:write`,
`organizations:read`). The token replaces `auth login`, so there is no browser
flow and no environment to choose:

```bash
export POLAR_API_URL=http://127.0.0.1:8000
export POLAR_ACCESS_TOKEN=polar_oat_...
bun src/cli.ts listen http://localhost:4321/webhooks
bun src/cli.ts trigger order.created
```

The URL passed to `listen` is the app you are integrating Polar into, the one
that receives webhooks.

### Testing webhook triggers

This walks through the full loop against sandbox or production. Against a local
Polar API, set the two variables from the section above instead and skip step 1;
everything else is the same.

**1. Sign in and pick an organization.** Use `--sandbox` or `--production`. The browser opens for consent, then you choose an organization. Every command after this uses that organization's environment.

```bash
bun src/cli.ts auth login --sandbox
bun src/cli.ts auth whoami
```

**2. Start a webhook receiver** in its own terminal. This stands in for your
own app's webhook route; if you have one, point the tunnel at that instead.
The one-liner logs each event it receives:

```bash
bun -e 'Bun.serve({ port: 4321, fetch: async (req) => { const b = await req.json(); console.log(b.type, "triggered:", req.headers.get("x-polar-triggered"), "customer:", b.data?.customer?.email ?? b.data?.email); return new Response("ok") } })'
```

**3. Open the tunnel** in a second terminal. You should see the connection banner with the organization name and the signing secret:

```bash
bun src/cli.ts listen http://localhost:4321/webhooks
```

**4. Trigger events** from a third terminal. Start with the catalog, then send a few:

```bash
bun src/cli.ts trigger --list
bun src/cli.ts trigger order.created
bun src/cli.ts trigger
bun src/cli.ts trigger order.paid --override data.customer.email=astrid.lindgren@polar.sh --override data.subtotal_amount=99900 --seed 7
bun src/cli.ts trigger customer_seat.assigned --seed 1 && bun src/cli.ts trigger customer_seat.claimed --seed 1 && bun src/cli.ts trigger customer_seat.revoked --seed 1
bun src/cli.ts trigger customer.created --json --seed 3
```

Each trigger prints a confirmation, the listen terminal logs the forwarded event with your server's status code, and the receiver prints the payload type with `triggered: true`. Nothing is created in the organization: the dashboard shows no new orders, customers, or webhook deliveries.

## Generated customer commands prototype

The CLI imports its API command tree from the private `@polar-sh/cli-commands`
package in `sdk/cli-commands` through a local `file:` dependency. The generator and templates live in
`sdk/generator/cli_commands`; the CLI supplies the Effect runtime implementation
in `src/services/api-runtime.ts`.

```bash
pnpm generate
bun src/cli.ts customers --help
bun src/cli.ts customers list --email=alice@example.com --limit=20
bun src/cli.ts customers create --email=alice@example.com --org=<organization-id>
bun src/cli.ts customers update <id> -d '{"name":"Alice"}'
```

These make real requests, defaulting to sandbox. The prototype covers 12 customer
operations; see [its README](../../../sdk/cli-commands/README.md) for the generated
files, setup, and limitations. Generation is explicit for now, and generated files
are committed. Start with `sdk/cli-commands/src/customers/list.ts` to inspect the
emitted Effect command.

## Releases

Add a changeset from `clients/` with `pnpm exec changeset` and select `polar-cli`.
Changesets updates `package.json` and `CHANGELOG.md` in the existing release PR.
The CLI is private to npm, but Changesets still versions it. The binary embeds
its version from `package.json`; do not edit `src/version.ts` for releases.

Merging a CLI version bump into `main` starts
[Release CLI](../../../.github/workflows/release_cli.yml). It tests the CLI,
compiles the three supported targets, signs and notarizes the macOS binaries,
and uploads these assets to a draft release in `polarsource/polar`:

- `polar-darwin-arm64.zip`
- `polar-darwin-x64.zip`
- `polar-linux-x64.tar.gz`
- `checksums.txt`

Only after every upload succeeds does the workflow publish the release, tagged
`polar-cli@<version>`. Release notes come from the CLI's changelog. CLI releases
do not become the monorepo's generic GitHub "latest" release: the updater lists
releases, follows pagination, filters stable `polar-cli@` tags, and compares
semantic versions. Publishing is independent of the npm release workflow.

The workflow skips metadata-only changes and already-published versions. It does
not publish the imported `1.3.9` version just because the CLI moved repositories.

### Signing secrets

Configure these repository secrets in `polarsource/polar` before the first run:

- `MACOS_CERTIFICATE_P12_BASE64`
- `MACOS_CERTIFICATE_PASSWORD`
- `MACOS_SIGNING_IDENTITY`
- `APP_STORE_CONNECT_API_KEY_P8`
- `APP_STORE_CONNECT_API_KEY_ID`
- `APP_STORE_CONNECT_ISSUER_ID`

The workflow uses the monorepo's `GITHUB_TOKEN` to upload releases; no npm token
or cross-repository token is needed for normal CLI publishing. Both the test and
release workflows read Bun `1.4.2` from `engines.bun` in the CLI's `package.json`.

### Verification and retries

Manually run **Release CLI** with `publish` unchecked to build and upload a
verification draft. Its `polar-cli-verify-...` tag is ignored by the updater.

To retry a failed stable release, rerun the original workflow run. If no draft
exists yet, you can also dispatch the workflow on `main` with `publish` checked.
An existing draft can only be resumed from its original source commit. Published
releases are never overwritten; corrections require a new changeset/version.

### One-time bridge release

Existing installations and the legacy `install.sh` use `polarsource/cli`.
After the first monorepo release is published:

1. Disable the old repository's tag-triggered release workflow so it cannot build
   the old source over the bridge release.
2. Download the four assets from `polar-cli@<version>` in `polarsource/polar`.
3. Upload those **same signed assets and checksums** to a draft `v<version>`
   release in `polarsource/cli`. Record the monorepo release URL in its notes;
   the monorepo commit SHA is not a commit in the old repository.
4. Verify the draft, then publish it as the old repository's latest release.

This is a manual operation with credentials that can publish to `polarsource/cli`;
the monorepo workflow does not publish there. Do not rebuild the bridge binaries
from the old repository. Existing clients install the bridge via `polar update`,
then discover future releases from the monorepo. Keep the bridge release available
indefinitely for users who update later.

The legacy installer is deliberately retained as a bridge bootstrap: it installs
the bridge version, after which `polar update` installs the newest monorepo version.
