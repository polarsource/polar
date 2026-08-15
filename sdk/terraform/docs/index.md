---
page_title: "Polar Provider"
description: |-
  Manage a Polar organization's product catalog and settings as code, authenticated with an organization access token.
---

# Polar Provider

Manage a [Polar](https://polar.sh) organization's product catalog and settings as code.
The provider authenticates with an **organization access token** (`polar_oat_...`) created
in the Polar dashboard under **Settings → General → Developers**. One token is bound to one
organization; to manage several organizations, configure one provider alias per
organization.

The token needs the write scopes for the resources you manage, e.g. `products:write`,
`benefits:write`, `custom_fields:write`, `webhooks:write` and `meters:write`. Write scopes
imply read access on the corresponding read endpoints.

## Example Usage

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
  # access_token can also come from the POLAR_ACCESS_TOKEN environment variable.
  # server = "sandbox" targets the sandbox environment (separate tokens!).
}
```

## Schema

### Optional

- `access_token` (String, Sensitive) Organization access token (`polar_oat_...`). Can also
  be set with the `POLAR_ACCESS_TOKEN` environment variable.
- `server` (String) Polar environment to target: `production` (default) or `sandbox`. Can
  also be set with the `POLAR_SERVER` environment variable. Tokens are
  environment-specific: a production token does not work against sandbox.
- `base_url` (String) Override the API base URL, e.g. to target a local development stack.
  Takes precedence over `server`. Can also be set with the `POLAR_BASE_URL` environment
  variable.
