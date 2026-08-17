# The organization this provider's access token belongs to. Creating the
# resource adopts it; destroying the resource only forgets it.
resource "polar_organization" "this" {
  name    = "Acme"
  email   = "support@acme.com"
  website = "https://acme.com/"

  socials = [
    { url = "https://github.com/acme" },
    { url = "https://x.com/acme" },
  ]

  # Hosts allowed to open an embedded checkout.
  embed_hosts = [
    "acme.com",
    "*.acme.com",
    "localhost:3000",
  ]

  default_presentment_currency = "usd"
  default_tax_behavior         = "location"

  subscription_settings = {
    allow_multiple_subscriptions    = false
    proration_behavior              = "prorate"
    benefit_revocation_grace_period = 7
  }

  # Only the toggles named here are managed; the rest keep their dashboard value.
  customer_email_settings = {
    subscription_renewal_reminder = true
  }

  customer_portal_settings = {
    subscription = {
      update_plan  = true
      update_seats = true
    }
  }

  feature_settings = {
    member_model_enabled          = true
    checkout_localization_enabled = true
  }
}

output "organization_slug" {
  value = polar_organization.this.slug
}
