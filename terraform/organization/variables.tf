variable "production_account_email" {
  description = "Email address for the production AWS account."
  type        = string
  sensitive   = true
  nullable    = false
}

variable "sandbox_account_email" {
  description = "Email address for the sandbox AWS account."
  type        = string
  sensitive   = true
  nullable    = false
}

variable "test_account_email" {
  description = "Email address for the test AWS account."
  type        = string
  sensitive   = true
  nullable    = false
}

variable "member_account_bootstrap_role_name" {
  description = "IAM role name Terraform uses from the management account to bootstrap IAM resources in member accounts."
  type        = string
  default     = "OrganizationAccountAccessRole"
}

variable "identity_account_email" {
  description = "Email address for the identity AWS account."
  type        = string
  sensitive   = true
  nullable    = false
}

variable "security_account_email" {
  description = "Email address for the security AWS account."
  type        = string
  sensitive   = true
  nullable    = false
}

variable "guardduty_alert_email" {
  description = "Email address subscribed to GuardDuty malware scan alerts."
  type        = string
  sensitive   = true
  nullable    = false
}
