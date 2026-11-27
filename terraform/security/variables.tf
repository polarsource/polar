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

variable "inspector_alert_slack_bot_token" {
  description = "Slack bot token used to post Inspector findings."
  type        = string
  sensitive   = true
  nullable    = false
}

variable "inspector_alert_slack_channel" {
  description = "Slack channel ID Inspector findings are posted to."
  type        = string
  nullable    = false
}
