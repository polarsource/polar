variable "private_backoffice" {
  description = "Tailscale backoffice URL, OAuth client ID, and dedicated auth key."
  type = object({
    url             = string
    oauth_client_id = string
    auth_key        = string
    tags            = optional(string, "tag:backoffice")
    plan            = optional(string, "standard")
  })
  sensitive = true
  default   = null
}

variable "public_backoffice_enabled" {
  description = "Set false after verifying the private backoffice."
  type        = bool
  default     = true
}

output "backoffice_service_id" {
  value = one(module.test[*].backoffice_service_id)
}
