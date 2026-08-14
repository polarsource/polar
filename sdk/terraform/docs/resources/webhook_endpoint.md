---
page_title: "polar_webhook_endpoint Resource - polar"
description: |-
  A webhook endpoint receiving events for the organization.
---

# polar_webhook_endpoint (Resource)

A webhook endpoint receiving events for the organization. The signing secret is generated
by Polar and exposed as the sensitive `secret` attribute — treat your Terraform state
accordingly.

## Example Usage

```terraform
resource "polar_webhook_endpoint" "billing_events" {
  url    = "https://example.com/polar/webhooks"
  format = "raw"
  events = [
    "order.created",
    "subscription.created",
    "subscription.revoked",
  ]
}

output "webhook_secret" {
  value     = polar_webhook_endpoint.billing_events.secret
  sensitive = true
}
```

## Schema

### Required

- `url` (String) The HTTPS URL where webhook events are sent. Localhost and private
  addresses are rejected by the API.
- `format` (String) The payload format: `raw`, `discord` or `slack`.
- `events` (List of String) The event types delivered to this endpoint, e.g.
  `order.created`. See the [Polar webhook documentation](https://docs.polar.sh/integrate/webhooks/events)
  for the full list.

### Optional

- `name` (String) An optional name to help identify the endpoint.
- `enabled` (Boolean) Whether the endpoint receives events. Defaults to `true`. The API
  creates endpoints enabled; `enabled = false` is applied with an immediate follow-up
  update after creation.
- `organization_id` (String) Owning organization. Not needed with an organization token.

### Read-Only

- `id` (String) The ID of the webhook endpoint.
- `secret` (String, Sensitive) The secret used to sign webhook payloads.
- `created_at` (String) Creation timestamp.

## Import

```shell
terraform import polar_webhook_endpoint.billing_events 00000000-0000-0000-0000-000000000000
```
