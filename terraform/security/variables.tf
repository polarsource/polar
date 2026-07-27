variable "guardduty_alert_email" {
  description = "Email address subscribed to GuardDuty finding alerts."
  type        = string
  sensitive   = true
  nullable    = false
}

variable "guardduty_finding_severity_threshold" {
  description = "Minimum GuardDuty finding severity that triggers an alert (4 = Medium, 7 = High)."
  type        = number
  default     = 4
}
