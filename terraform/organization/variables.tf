variable "management_account_email" {
  description = "Email address for the AWS Organizations management account."
  type        = string
  sensitive   = true
  nullable    = false
}

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
