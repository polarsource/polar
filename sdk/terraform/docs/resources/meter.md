---
page_title: "polar_meter Resource - polar"
description: |-
  A usage-billing meter aggregating ingested events.
---

# polar_meter (Resource)

A usage-billing meter aggregating ingested events into billable quantities.

Two Polar-specific lifecycle rules apply:

- **Destroy archives.** Polar has no meter deletion; destroying this resource archives the
  meter. Archiving fails while the meter is attached to active metered product prices or
  meter-credit benefits — remove those references first. A meter archived outside
  Terraform is treated as destroyed on the next refresh.
- **Conditional immutability.** `filter` and `aggregation` become immutable once the meter
  has aggregated billed events. Terraform cannot know this at plan time; the apply fails
  with guidance to create a new meter instead.

## Example Usage

```terraform
resource "polar_meter" "prompt_tokens" {
  name = "Prompt Tokens"
  unit = "token"

  filter = {
    conjunction = "and"
    clauses = [{
      property     = "name"
      operator     = "eq"
      value_string = "llm_usage"
    }]
    # One level of nested groups is supported:
    groups = [{
      conjunction = "or"
      clauses = [
        { property = "model", operator = "like", value_string = "gpt%" },
        { property = "model", operator = "like", value_string = "claude%" },
      ]
    }]
  }

  aggregation = {
    func     = "sum"
    property = "prompt_tokens"
  }
}
```

## Schema

### Required

- `name` (String) The name of the meter, shown on customer invoices and usage pages.
  Minimum 3 characters.
- `filter` (Attributes) The filter selecting which ingested events feed the meter:
  - `conjunction` (String) `and` or `or`.
  - `clauses` (Attributes List) Flat comparisons: `property`, `operator` (`eq`, `ne`,
    `gt`, `gte`, `lt`, `lte`, `like`, `not_like`) and exactly one of `value_string`,
    `value_number`, `value_boolean`. For metadata properties use the plain key — the API
    strips a `metadata.` prefix.
  - `groups` (Attributes List) Nested clause groups, one level deep (`conjunction` +
    `clauses`). Deeper nesting cannot be represented and must be managed outside
    Terraform.
- `aggregation` (Attributes) How matched events aggregate:
  - `func` (String) `count`, `sum`, `max`, `min`, `avg` or `unique`.
  - `property` (String) The event property to aggregate over. Required for every function
    except `count`.

### Optional

- `unit` (String) The unit of the meter: `scalar` (default), `token` or `custom`.
- `custom_label` (String) Label for the custom unit, e.g. `request`. Required when `unit`
  is `custom`.
- `custom_multiplier` (Number) Multiplier from base unit to display scale. Only with
  `unit = "custom"`.
- `metadata` (Map of String) Key-value metadata. Values are stored as strings.
- `organization_id` (String) Owning organization. Not needed with an organization token.

### Read-Only

- `id` (String) The ID of the meter.
- `created_at` (String) Creation timestamp.

## Import

```shell
terraform import polar_meter.prompt_tokens 00000000-0000-0000-0000-000000000000
```
