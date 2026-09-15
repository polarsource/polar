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

  attached_custom_fields = [
    {
      custom_field_id = polar_custom_field.vat_number.id
      required        = false
    },
  ]

  metadata = {
    tier = "pro"
  }
}

# A one-time purchase: omit recurring_interval. A free product is a fixed
# price of 0.
resource "polar_product" "handbook" {
  name = "The Handbook"

  prices = [{
    amount_type  = "fixed"
    price_amount = 0
  }]
}

# Pay what you want, with a floor and a suggested amount.
resource "polar_product" "support_us" {
  name = "Support Us"

  prices = [{
    amount_type    = "custom"
    minimum_amount = 500
    preset_amount  = 2000
  }]
}
