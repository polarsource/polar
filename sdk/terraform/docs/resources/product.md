---
page_title: "polar_product Resource - polar"
description: |-
  A product customers can buy, with its prices, benefits and checkout fields.
---

# polar_product (Resource)

A product customers can buy, with its prices, benefits and checkout fields.

Four Polar-specific lifecycle rules apply:

- **Destroy archives.** Polar has no product deletion; destroying this resource archives the
  product. Archived products cannot be bought, while existing subscriptions keep renewing and
  granted benefits stay granted. A product archived outside Terraform is treated as destroyed
  on the next refresh.
- **Prices are immutable.** The API has no price update: changing anything about a price
  archives the old price and creates a replacement with a new ID. The provider matches each
  planned price against the prices in state, keeps the ones that are unchanged, and lets the
  API archive the rest — so an edited price shows its `id` as `(known after apply)`.
- **The billing interval is fixed.** `recurring_interval`, `recurring_interval_count`,
  `meter_interval` and `meter_interval_count` cannot be changed on an existing product; a
  change forces replacement.
- **Benefits go through their own endpoint.** `benefits` is applied with a separate call that
  re-runs benefit grant processing for every customer, so the provider only makes it when the
  list actually changes.

## Example Usage

```terraform
resource "polar_product" "pro" {
  name        = "Pro"
  description = "Everything in Starter, plus usage-based API access."

  recurring_interval   = "month"
  trial_interval       = "day"
  trial_interval_count = 14

  prices = [
    {
      amount_type  = "fixed"
      price_amount = 2900
    },
    {
      amount_type = "metered_unit"
      meter_id    = polar_meter.api_calls.id
      unit_amount = "0.015"
      cap_amount  = 50000
    },
  ]

  benefits = [polar_benefit.monthly_credits.id]

  metadata = {
    tier = "pro"
  }
}
```

A one-time purchase omits `recurring_interval`. A free product is a `fixed` price of `0` —
the API has no separate free price type.

```terraform
resource "polar_product" "handbook" {
  name = "The Handbook"

  prices = [{
    amount_type  = "fixed"
    price_amount = 0
  }]
}
```

## Schema

### Required

- `name` (String) The name of the product, shown at checkout and on invoices. 3 to 64
  characters, without surrounding whitespace (the API strips it).
- `prices` (Attributes List) The prices the product is sold at, at least one. See
  [Prices](#prices) below.

### Optional

- `description` (String) The description of the product, shown at checkout.
- `visibility` (String) `public` (default), `private` (reachable by direct link only) or
  `draft`.
- `recurring_interval` (String) The billing interval — `day`, `week`, `month` or `year` —
  making the product a subscription. Omit for a one-time purchase. Forces replacement.
- `recurring_interval_count` (Number) How many billing intervals each period spans, 1 to 999.
  Defaults to `1`. Recurring products only; forces replacement.
- `meter_interval` (String) An optional meter cycle independent of the billing interval, e.g.
  monthly credits on yearly billing. It must evenly divide the billing interval. The API
  cannot change it after creation, so a change forces replacement.
- `meter_interval_count` (Number) How many meter intervals each meter cycle spans, 1 to 999.
  Defaults to `1` when `meter_interval` is set; forces replacement.
- `trial_interval` (String) The unit of the free trial granted to new subscribers: `day`,
  `week`, `month` or `year`. Set together with `trial_interval_count`; recurring products only.
- `trial_interval_count` (Number) How many trial intervals the free trial lasts, 1 to 1000.
- `benefits` (List of String) IDs of the benefits granted by the product, in display order.
  Omit the attribute instead of passing an empty list.
- `attached_custom_fields` (Attributes List) Custom fields collected at checkout, in display
  order: `custom_field_id` (String) and `required` (Boolean). Omit the attribute instead of
  passing an empty list.
- `medias` (List of String) IDs of `product_media` files shown on the checkout page, in
  display order. Upload them through the files API first. Omit the attribute instead of
  passing an empty list.
- `metadata` (Map of String) Key-value metadata. Values are stored as strings.
- `organization_id` (String) Owning organization. Not needed with an organization token.
  Forces replacement.

### Read-Only

- `id` (String) The ID of the product.
- `created_at` (String) Creation timestamp.

## Prices

Each element of `prices` is discriminated by `amount_type`; set exactly the attributes
belonging to that kind.

### Common

- `amount_type` (String, **required**) `fixed`, `custom`, `seat_based` or `metered_unit`.
- `price_currency` (String) Lowercase ISO 4217 code, `usd` by default.
- `tax_behavior` (String) `location`, `inclusive` or `exclusive`. Defaults to the
  organization's setting. All prices sharing a currency must agree on it.
- `id` (String, read-only) The server-assigned price ID.

### `fixed`

- `price_amount` (Number, **required**) The price in cents. `0` makes the product free; any
  other value must clear the currency's minimum charge.

### `custom` (pay what you want)

- `minimum_amount` (Number, **required**) The lowest amount a customer may pay, in cents. `0`
  means "free or pay what you want". Required by this provider because the API would
  otherwise silently apply its own 50-cent floor.
- `maximum_amount` (Number) The highest amount a customer may pay.
- `preset_amount` (Number) The amount shown to the customer by default.

### `seat_based`

- `seat_tiers` (Attributes, **required**)
  - `seat_tier_type` (String) `volume` (default) prices every seat at the matching tier's
    rate, `graduated` prices each tier's range independently.
  - `tiers` (Attributes List, **required**) `min_seats`, `max_seats` (omit on the last tier to
    leave it unbounded) and `price_per_seat`, in cents. Tiers must be listed in ascending seat
    order and be contiguous — the API sorts them, so an out-of-order list is rejected at plan
    time rather than left as a permanent diff.

Seat-based pricing is a per-organization feature; the API rejects it until Polar enables it.

### `metered_unit`

- `meter_id` (String, **required**) The meter billed by the price. A meter may only back one
  price per currency. Recurring products only.
- `unit_amount` (String, **required**) The price per metered unit in cents, as a decimal
  string (e.g. `"0.015"`). A string keeps the exact scale you wrote; up to 12 decimal places
  and 17 digits are stored.
- `cap_amount` (Number) Cap in cents on what the price can charge in a period, however many
  units are consumed.

### Combining prices

Per currency you may combine one `fixed` price with one `seat_based` price, or have a single
`custom` price, plus any number of `metered_unit` prices. If you price in several currencies,
every currency must offer the same set of price kinds, and at least one price must be in the
organization's default presentment currency.

Prices created outside the catalog by a Checkout session (`source = "ad_hoc"` in the API) are
never read into state.

## Import

```shell
terraform import polar_product.pro 00000000-0000-0000-0000-000000000000
```

Products whose prices carry their own recurring interval (the deprecated per-price
subscription model) cannot be represented by this provider; importing one fails with an
explicit error rather than a guessed price list.
