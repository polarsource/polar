---
page_title: "polar_custom_field Resource - polar"
description: |-
  A custom field collected from customers at checkout.
---

# polar_custom_field (Resource)

A custom field collected from customers at checkout. Attach it to products with the
product's `attached_custom_fields` (product resource support is on the roadmap).

Deleting a custom field detaches it from all products and checkouts.

## Example Usage

```terraform
resource "polar_custom_field" "company_size" {
  type = "select"
  slug = "company_size"
  name = "Company size"

  properties = {
    form_label = "How big is your team?"
    options = [
      { value = "solo", label = "Just me" },
      { value = "small", label = "2-10" },
      { value = "large", label = "11+" },
    ]
  }
}

resource "polar_custom_field" "vat_number" {
  type = "text"
  slug = "vat_number"
  name = "VAT number"

  properties = {
    form_placeholder = "EU123456789"
    min_length       = 8
  }
}
```

## Schema

### Required

- `type` (String) Data type of the custom field: `text`, `number`, `date`, `checkbox` or
  `select`. Changing it forces replacement.
- `slug` (String) Identifier of the custom field, used as the key when storing values.
  Unique across the organization. Lowercase letters, digits, hyphens and underscores only.
- `name` (String) Name of the custom field.

### Optional

- `properties` (Attributes) Form properties; which attributes apply depends on `type`:
  - `form_label`, `form_help_text`, `form_placeholder` (String) Checkout form texts.
  - `textarea` (Boolean), `min_length`, `max_length` (Number) `text` fields only.
  - `ge`, `le` (Number) Bounds for `number` fields, Unix timestamps for `date` fields.
  - `options` (Attributes List: `value`, `label`) Required for `select` fields.
- `metadata` (Map of String) Key-value metadata. Values are stored as strings.
- `organization_id` (String) Owning organization. Not needed with an organization token.

### Read-Only

- `id` (String) The ID of the custom field.
- `created_at` (String) Creation timestamp.

## Import

```shell
terraform import polar_custom_field.company_size 00000000-0000-0000-0000-000000000000
```
