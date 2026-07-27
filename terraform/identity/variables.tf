variable "ssosync_google_admin_email" {
  description = "Google Workspace admin email to impersonate."
  type        = string
  nullable    = false
}

variable "ssosync_google_credentials" {
  description = "Google service account credentials JSON."
  type        = string
  sensitive   = true
  nullable    = false
}

variable "ssosync_scim_endpoint" {
  description = "Identity Center SCIM endpoint URL."
  type        = string
  nullable    = false
}

variable "ssosync_scim_access_token" {
  description = "Identity Center SCIM access token."
  type        = string
  sensitive   = true
  nullable    = false
}

variable "ssosync_schedule_expression" {
  description = "ssosync EventBridge schedule; empty disables it."
  type        = string
  default     = ""
}

variable "ssosync_version" {
  description = "Pinned ssosync SAR version; null uses the latest."
  type        = string
  default     = null
}
