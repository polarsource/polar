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
POLAR_ACCESS_TOKEN=... POLAR_BASE_URL=http://127.0.0.1:8000 make testacc  # against local stack
```

## Conventions

- **Match the server, not the SDKs.** Attribute names, immutability, and delete semantics
  come from `server/polar/{module}/` (schemas + service layer). Cite the server behavior in
  the resource's Markdown descriptions when it is surprising (archive-on-destroy,
  conditional immutability).
- **Archive-on-destroy** for resources without a DELETE endpoint (meters today; products
  when added): destroy maps to `is_archived: true`, Read treats archived as destroyed.
- **Server-generated values** (webhook secrets, IDs, timestamps) are `Computed` with
  `UseStateForUnknown`; secrets are `Sensitive`.
- **Fail at plan time when the API would silently rewrite input** (e.g. `metadata.`
  prefixes on meter filter properties) — a custom validator beats a perpetual diff.
- **Retry policy**: 429 always; 5xx and network errors only for GET. Writes are not
  retried on 5xx.
- API changes that touch these endpoints must keep this provider compiling: the monorepo
  CI job `terraform-provider-ci` runs on every PR touching `sdk/terraform/`.

## Releasing

Run the **Terraform Provider Publish** workflow (workflow_dispatch, version input). It
syncs this directory (minus this file) to the public repository and pushes the version
tag; the public repository's release workflow builds and signs the registry assets. See
README.md for the one-time setup checklist.

## Roadmap

Remaining catalog resources, in rough order of value: `polar_product` (nested prices —
the hard one; see the price-replacement semantics in `server/polar/product/service.py`),
`polar_benefit`, `polar_discount`, `polar_checkout_link`, `polar_metric_dashboard`,
`polar_organization` (update-only singleton), plus data sources for products, benefits and
event types.
