# Terraform Provider

Official Terraform provider for Polar merchants, developed in this monorepo and published
to the Terraform Registry through the public mirror repository
`polarsource/terraform-provider-polar`. This file is monorepo-only guidance and is
excluded from the sync.

## Architecture

- `internal/polarapi/` — a **thin, hand-written HTTP client** for exactly the endpoints the
  provider uses. It deliberately does not depend on any published SDK; keep it minimal and
  typed against `server/polar/{module}/schemas.py`. When the API changes, this is the file
  set to update.
- `internal/provider/` — `terraform-plugin-framework` resources. One file per resource
  (`resource_*.go`), shared helpers in `conversions.go`.
- Docs in `docs/` follow the Terraform Registry layout and are hand-maintained for now
  (`make docs` regenerates with tfplugindocs once a terraform CLI is available).

## Commands

```bash
make build   # compile
make test    # unit tests (httptest-based, no network)
make lint    # go vet + gofmt check
```

Acceptance tests (`*_acc_test.go`, `TestAcc*`) drive the real terraform CLI through
create/read/update/import/destroy against a live API. They only run with `TF_ACC=1`, so
`make test` skips them. Against a local stack, with the token minted for you:

```bash
cd server && uv run task api    # in another terminal
cd sdk/terraform && make testacc-local
```

`make testacc` is the raw entry point when you already have a token — for a sandbox
organization, `POLAR_ACCESS_TOKEN=polar_oat_... POLAR_SERVER=sandbox make testacc`.

Organization access tokens can only be created from the dashboard (the OAT endpoints are
private and reject organization tokens), so `tools/mint_acceptance_token.py` runs inside the
server's environment and reuses its services and token crypto to mint one:

```bash
cd server && uv run python ../sdk/terraform/tools/mint_acceptance_token.py
```

It is idempotent on the user and the organization — reusing them across runs, and enabling
the `member_model_enabled` and `seat_based_pricing_enabled` feature settings the suite needs
on an organization created before they were the default — and revokes the tokens it
previously minted, since only the hash is stored and an old token cannot be recovered.

## Conventions

- **Match the server, not the SDKs.** Attribute names, immutability, and delete semantics
  come from `server/polar/{module}/` (schemas + service layer). Cite the server behavior in
  the resource's Markdown descriptions when it is surprising (archive-on-destroy,
  conditional immutability).
- **Archive-on-destroy** for resources without a DELETE endpoint (meters and products):
  destroy maps to `is_archived: true`, Read treats archived as destroyed.
- **Server-generated values** (webhook secrets, IDs, timestamps) are `Computed` with
  `UseStateForUnknown`; secrets are `Sensitive`.
- **Fail at plan time when the API would silently rewrite input** (e.g. `metadata.`
  prefixes on meter filter properties) — a custom validator beats a perpetual diff.
- **Retry policy**: 429 always; 5xx and network errors only for GET. Writes are not
  retried on 5xx.
- **Acceptance-test every resource's special semantics.** Each `resource_*_acc_test.go`
  covers create/update/import/destroy plus what makes that resource unusual (a meter is
  archived rather than deleted, a product's price IDs survive unrelated edits, a seat-based
  price's tier ladder round-trips in order, a product's benefits survive an update that does
  not mention them). Checks that matter server-side — archiving, clearing an optional field,
  the order of a product's benefit attachments — are verified with a direct API call, not
  just against Terraform's state.
- API changes that touch these endpoints must keep this provider compiling: the monorepo
  CI job `terraform-provider-ci` runs on every PR touching `sdk/terraform/`. The separate
  `terraform-provider-acceptance` workflow boots the backend and runs the acceptance suite
  against it, on those same PRs and nightly — the nightly is what catches a server change
  that broke the provider without touching `sdk/terraform/`.

## Releasing

Run the **Terraform Provider Publish** workflow (workflow_dispatch, version input). It
syncs this directory (minus this file) to the public repository and pushes the version
tag; the public repository's release workflow builds and signs the registry assets. See
README.md for the one-time setup checklist.

## Roadmap

Remaining catalog resources, in rough order of value:
`polar_checkout_link`, `polar_metric_dashboard`, `polar_organization` (update-only
singleton), the four integration-backed benefit types (`discord`, `github_repository`,
`feature_flag`, `slack_shared_channel`), plus data sources for products, benefits and
event types.
