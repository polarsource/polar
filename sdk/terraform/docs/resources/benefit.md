---
page_title: "polar_benefit Resource - polar"
description: |-
  A benefit (entitlement) granted to customers of products it is attached to.
---

# polar_benefit (Resource)

A benefit (entitlement) granted to customers of the products it is attached to. Set exactly
the nested attribute matching `type`.

~> Deleting a benefit **revokes it from all customers** currently granted it. Benefits
managed automatically by Polar (`deletable = false`) cannot be destroyed.

Supported types: `custom`, `meter_credit`, `license_keys`, `downloadables`. Types requiring
a dashboard-connected integration (`discord`, `github_repository`, `feature_flag`,
`slack_shared_channel`) are not supported by the provider yet.

## Example Usage

```terraform
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
  aggregation = { func = "count" }
}

resource "polar_benefit" "monthly_credits" {
  type        = "meter_credit"
  description = "10,000 API calls per month"

  meter_credit = {
    units    = 10000
    rollover = false
    meter_id = polar_meter.api_calls.id
  }
}

resource "polar_benefit" "license" {
  type        = "license_keys"
  description = "Pro license key"

  license_keys = {
    prefix = "PRO"
    expires = {
      ttl       = 1
      timeframe = "year"
    }
    activations = {
      limit                 = 3
      enable_customer_admin = true
    }
  }
}
```

## Schema

### Required

- `type` (String) The type of the benefit: `custom`, `meter_credit`, `license_keys` or
  `downloadables`. Changing it forces replacement.
- `description` (String) Displayed on products having this benefit. 3 to 42 characters.

### Optional

- `custom` (Attributes) For `custom` benefits: `note` (String) — a private note shared
  with customers granted the benefit.
- `meter_credit` (Attributes, required for that type) `units` (Number), `rollover`
  (Boolean), `meter_id` (String).
- `license_keys` (Attributes) `prefix` (String), `limit_usage` (Number),
  `expires` (Attributes: `ttl`, `timeframe` = `year`/`month`/`day`),
  `activations` (Attributes: `limit` 1–50, `enable_customer_admin`).
- `downloadables` (Attributes, required for that type) `files` (List of String) — file IDs
  uploaded via the files API.
- `visibility` (String) `draft`, `private` or `public`. Only configurable for `custom`,
  `meter_credit` and `license_keys`; other types stay `public`.
- `metadata` (Map of String) Key-value metadata. Values are stored as strings.
- `organization_id` (String) Owning organization. Not needed with an organization token.

### Read-Only

- `id` (String) The ID of the benefit.
- `selectable` (Boolean) Whether the benefit can be attached to products.
- `deletable` (Boolean) Whether the benefit can be deleted.
- `created_at` (String) Creation timestamp.

## Import

```shell
terraform import polar_benefit.monthly_credits 00000000-0000-0000-0000-000000000000
```
