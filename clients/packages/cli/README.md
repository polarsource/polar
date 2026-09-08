# Polar CLI

A Polar CLI for your terminal.

- Migrate from Lemon Squeezy, Paddle & Stripe
- Tunnel Webhooks to your local environment
- Initialize Polar boilerplate with a single command
- And much more...

Currently in development.

## Development

From `clients/`, install dependencies with `pnpm install`, then use
`pnpm --filter polar-cli test`, `typecheck`, `format`, or `lint`.
Bun `1.4.2` is the runtime, test runner, and binary compiler; pnpm manages dependencies.

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
