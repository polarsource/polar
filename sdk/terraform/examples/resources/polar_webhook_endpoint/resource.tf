resource "polar_webhook_endpoint" "billing_events" {
  url    = "https://example.com/polar/webhooks"
  format = "raw"
  events = [
    "order.created",
    "subscription.created",
    "subscription.revoked",
  ]
}
