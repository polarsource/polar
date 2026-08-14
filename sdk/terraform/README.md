# Polar Terraform Provider

Manage a [Polar](https://polar.sh) organization's product catalog and settings as code:
custom fields, webhook endpoints, usage-billing meters — with more of the catalog
(products, benefits, discounts, checkout links) on the roadmap.

The provider authenticates with an **organization access token** created once in the Polar
dashboard. Everything else happens through Terraform.

```terraform
terraform {
  required_providers {
    polar = {
      source  = "polarsource/polar"
      version = "~> 0.1"
    }
  }
}

provider "polar" {
  # Or set POLAR_ACCESS_TOKEN. Use `server = "sandbox"` against the sandbox environment.
}

resource "polar_meter" "api_calls" {
  name = "API Calls"

  filter = {
    conjunction = "and"
    clauses = [{
      property     = "name"
      operator     = "eq"
      value_string = "api_call"
    }]
  }

  aggregation = {
    func = "count"
  }
}

resource "polar_webhook_endpoint" "billing_events" {
  url    = "https://example.com/polar/webhooks"
  format = "raw"
  events = ["order.created", "subscription.created", "subscription.revoked"]
}
```

## Resources

| Resource | Notes |
| --- | --- |
| `polar_custom_field` | Checkout form fields. Full lifecycle; `type` forces replacement. |
| `polar_webhook_endpoint` | Webhook endpoints. The signing `secret` is server-generated and stored as sensitive state. |
| `polar_meter` | Usage-billing meters. Polar has no meter deletion: destroy archives the meter. `filter`/`aggregation` become immutable once the meter has billed events. |

Generated documentation for each resource lives in [`docs/`](docs/) and on the Terraform Registry.

## Development

**Primary development happens in the [`polarsource/polar`](https://github.com/polarsource/polar)
monorepo under `sdk/terraform/`.** The `polarsource/terraform-provider-polar` repository is a
publish target the monorepo syncs to at release time — the Terraform Registry requires a
dedicated repository with this exact name. Please open issues and pull requests against the
monorepo.

```bash
cd sdk/terraform
make build      # compile
make test       # unit tests
make lint       # vet + gofmt
```

Acceptance tests run real create/read/update/destroy cycles. Point them at a sandbox
organization, or at a local Polar development stack via `base_url`:

```bash
POLAR_ACCESS_TOKEN=polar_oat_... POLAR_SERVER=sandbox make testacc
POLAR_ACCESS_TOKEN=...           POLAR_BASE_URL=http://127.0.0.1:8000 make testacc
```

## Releasing

Releases are cut from the monorepo with the **Terraform Provider Publish** GitHub Actions
workflow (`workflow_dispatch`, version input, e.g. `0.1.0`). It syncs `sdk/terraform/` to
this repository, pushes a `v0.1.0` tag, and the tag triggers `release.yml` here, which
builds and GPG-signs the registry assets with goreleaser.

### One-time setup (not yet done)

1. Create the public `polarsource/terraform-provider-polar` repository.
2. Generate an RSA GPG signing key for releases; add `GPG_PRIVATE_KEY` and `GPG_PASSPHRASE`
   secrets to that repository, and register the public key in the Terraform Registry
   organization settings.
3. Add a `TERRAFORM_PROVIDER_PUSH_TOKEN` secret to the monorepo: a token for the public
   repository with contents:write **and** workflows:write (the sync pushes workflow files).
4. Publish the provider once through the Terraform Registry UI (sign in with the
   polarsource GitHub organization, select the repository); subsequent releases are
   ingested automatically via webhook.
5. Optionally submit the provider and signing key to the OpenTofu registry
   (issue-based submission in opentofu/registry).

## License

Apache-2.0, same as the Polar monorepo.
