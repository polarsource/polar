variable "environment" {
  description = "Environment name (production, sandbox, test)"
  type        = string

  validation {
    condition     = contains(["production", "sandbox", "test"], var.environment)
    error_message = "Must be one of \"production\", \"sandbox\" or \"test\"."
  }
}

variable "name" {
  description = "Service name, environment suffix is appended"
  type        = string
  default     = "pgbouncer"
}

variable "render_environment_id" {
  description = "The environment ID in Render"
  type        = string
}

variable "registry_credential_id" {
  description = "Render registry credential ID for GHCR"
  type        = string
  sensitive   = true
}

variable "image_url" {
  description = "Docker image URL for PgBouncer"
  type        = string
  default     = "ghcr.io/polarsource/polar-pgbouncer"
}

variable "image_tag" {
  description = "Docker image tag"
  type        = string
  default     = "latest"
}

variable "plan" {
  description = "Render service plan"
  type        = string
  default     = "starter"
}

variable "num_instances" {
  description = "Number of PgBouncer instances"
  type        = number
  default     = 1
}

variable "database" {
  description = "Postgres endpoint PgBouncer proxies to. Set additional_user/additional_password during a credential rotation to keep both roles accepted while services redeploy."
  type = object({
    host                = string
    port                = string
    user                = string
    password            = string
    additional_user     = optional(string)
    additional_password = optional(string)
  })
  sensitive = true

  validation {
    condition     = (var.database.additional_user == null) == (var.database.additional_password == null)
    error_message = "Set additional_user and additional_password together, or neither."
  }
}

variable "pool_config" {
  description = "PgBouncer pooling configuration"
  type = object({
    pool_mode               = optional(string, "transaction")
    max_client_conn         = optional(string, "1000")
    default_pool_size       = optional(string, "20")
    min_pool_size           = optional(string, "0")
    reserve_pool_size       = optional(string, "0")
    max_prepared_statements = optional(string, "200")
  })
  default = {}
}
