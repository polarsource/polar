resource "polar_benefit" "monthly_credits" {
  type        = "meter_credit"
  description = "10,000 API calls per month"

  meter_credit = {
    units    = 10000
    rollover = false
    meter_id = polar_meter.api_calls.id
  }
}
