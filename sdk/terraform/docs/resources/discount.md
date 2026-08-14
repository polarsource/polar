---
page_title: "polar_discount Resource - polar"
description: |-
  A discount customers can redeem at checkout.
---

# polar_discount (Resource)

A discount customers can redeem at checkout, either with a code or applied via the API.

Two immutability rules apply:

- `type` and `duration` (with `duration_in_months`) can never change — Terraform forces
  replacement.
- The discount value (`amounts` or `basis_points`) and `duration_in_months` become
  immutable **after the first redemption**. Terraform cannot know this at plan time; the
  apply fails with guidance to create a new discount instead.

## Example Usage

```terraform
resource "polar_discount" "launch" {
  name     = "Launch discount"
  type     = "percentage"
  duration = "once"

  basis_points = 2000 # 20%
  code         = "LAUNCH20"

  ends_at         = "2026-12-31T23:59:59Z"
  max_redemptions = 100
}

resource "polar_discount" "partner_fixed" {
  name     = "Partner deal"
  type     = "fixed"
  duration = "repeating"

  duration_in_months = 12
  amounts = {
    usd = 1000 # $10.00 off
    eur = 900
  }

  products = [polar_product.pro.id]
}
```

## Schema

### Required

- `name` (String) Displayed to the customer when the discount is applied.
- `type` (String) `fixed` (amount off) or `percentage`. Forces replacement.
- `duration` (String) For subscriptions: `once`, `forever` or `repeating`. Forces
  replacement.

### Optional

- `duration_in_months` (Number) Required when `duration` is `repeating`, forbidden
  otherwise. Multiply by 12 for yearly pricing. Forces replacement.
- `amounts` (Map of Number) Currency → fixed amount in cents, e.g. `{ usd = 1000 }`.
  Required for `fixed` discounts.
- `basis_points` (Number) Percentage in basis points (`2550` = 25.5%). Required for
  `percentage` discounts.
- `code` (String) 3–256 alphanumeric characters customers type at checkout. Without a
  code, the discount can only be applied via the API.
- `starts_at` / `ends_at` (String) RFC 3339 redeemability window.
- `max_redemptions` / `max_redemptions_per_customer` (Number) Redemption limits.
- `products` (List of String) Product IDs the discount is restricted to. Omit to apply to
  all products.
- `metadata` (Map of String) Key-value metadata. Values are stored as strings.
- `organization_id` (String) Owning organization. Not needed with an organization token.

### Read-Only

- `id` (String) The ID of the discount.
- `redemptions_count` (Number) Number of redemptions, refreshed on read.
- `created_at` (String) Creation timestamp.

## Import

```shell
terraform import polar_discount.launch 00000000-0000-0000-0000-000000000000
```
