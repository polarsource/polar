# Setup for module
variable "environment" {
  description = "Environment that the service runs in"
  type        = string

  validation {
    condition     = contains(["production", "sandbox", "test"], var.environment)
    error_message = "Must be either \"production\", \"sandbox\" or \"test\"."
  }
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

# Variables for configuring the services and workers
variable "api_service_config" {
  description = "API service configuration"
  type = object({
    allowed_hosts          = string # "[\"polar.sh\", \"backoffice.polar.sh\"]"
    cors_origins           = string # "[\"https://polar.sh\", \"https://github.com\", \"https://docs.polar.sh\"]"
    custom_domains         = list(object({ name = string }))
    web_concurrency        = optional(string, "2")
    forwarded_allow_ips    = optional(string, "*")
    database_pool_size     = optional(string, "20")
    postgres_database      = optional(string, "polar_cpit")
    postgres_read_database = optional(string, "polar_cpit")
    redis_db               = optional(string, "0")
  })
}

variable "workers" {
  description = "Map of worker configurations"
  type = map(object({
    start_command      = string
    digest             = optional(string)
    tag                = optional(string)
    custom_domains     = optional(list(object({ name = string })), [])
    dramatiq_prom_port = optional(string, "10000")
    plan               = optional(string, "pro")
    num_instances      = optional(number, 1)
  }))

  validation {
    condition = alltrue([
      for name, worker in var.workers :
      (worker.digest != null) != (worker.tag != null)
    ])
    error_message = "Each worker must specify exactly one of 'digest' or 'tag', not both or neither."
  }
}

variable "postgres_config" {
  description = "PostgreSQL connection configuration"
  type = object({
    host          = string
    port          = string
    user          = string
    password      = string
    read_host     = string
    read_port     = string
    read_user     = string
    read_password = string
  })
  sensitive = true
}

variable "redis_config" {
  description = "Redis connection configuration"
  type = object({
    host = string
    port = string
  })
  sensitive = true
}


# Variables for the different env groups
variable "google_secrets" {
  description = "Google secrets (sensitive)"
  type = object({
    client_id     = string
    client_secret = string
  })
  sensitive = true
}

variable "openai_secrets" {
  description = "OpenAI secrets (sensitive)"
  type = object({
    api_key = string
  })
  sensitive = true
}

variable "backend_config" {
  description = "Backend environment configuration (non-sensitive)"
  type = object({
    environment                          = optional(string, null) # Default to the environment variable
    base_url                             = string                 # "https://api.polar.sh"
    backoffice_host                      = optional(string, null) # "backoffice.polar.sh"
    user_session_cookie_domain           = string                 # "polar.sh"
    user_session_cookie_key              = optional(string, "")
    debug                                = string               # "0"
    email_sender                         = string               # "resend"
    email_from_name                      = string               # "Polar"
    email_from_domain                    = string               # "notifications.polar.sh"
    frontend_base_url                    = string               # "https://polar.sh"
    checkout_base_url                    = string               # "https://buy.polar.sh/{client_secret}"
    jwks_path                            = string               # "/etc/secrets/jwks.json"
    log_level                            = string               # "INFO"
    testing                              = string               # "0"
    organizations_billing_engine_default = string               # "1"
    auth_cookie_domain                   = string               # "polar.sh"
    auth_cookie_key                      = optional(string, "") # "polar.sh"
    invoices_additional_info             = string               # "[support@polar.sh](mailto:support@polar.sh)\nVAT: EU372061545"
  })
}

variable "backend_secrets" {
  description = "Backend secrets (sensitive)"
  type = object({
    stripe_publishable_key         = string
    current_jwk_kid                = string
    discord_bot_token              = string
    discord_client_id              = string
    discord_client_secret          = string
    discord_webhook_url            = optional(string, "")
    loops_api_key                  = optional(string, "")
    posthog_project_api_key        = optional(string, "")
    resend_api_key                 = string
    logo_dev_publishable_key       = optional(string, "")
    secret                         = string
    sentry_dsn                     = string
    plain_request_signing_secret   = optional(string, "")
    plain_token                    = optional(string, "")
    plain_chat_secret              = optional(string, "")
    jwks                           = string
    app_review_email               = optional(string, "")
    app_review_otp_code            = optional(string, "")
    chargeback_stop_webhook_secret = optional(string, "")
  })
  sensitive = true
}

variable "aws_s3_config" {
  description = "AWS S3 environment configuration (non-sensitive)"
  type = object({
    region                        = string # "us-east-2"
    signature_version             = string # "v4"
    files_presign_ttl             = string # "600"
    files_public_bucket_name      = string # "polar-public-files"
    customer_invoices_bucket_name = string # "polar-customer-invoices"
    payout_invoices_bucket_name   = string # "polar-payout-invoices"
  })
}

variable "aws_s3_secrets" {
  description = "AWS S3 secrets (sensitive)"
  type = object({
    access_key_id         = string
    secret_access_key     = string
    files_download_salt   = string
    files_download_secret = string
  })
  sensitive = true
}

variable "github_secrets" {
  description = "GitHub secrets (sensitive)"
  type = object({
    client_id                           = string
    client_secret                       = string
    repository_benefits_app_identifier  = string
    repository_benefits_app_namespace   = string
    repository_benefits_app_private_key = string
    repository_benefits_client_id       = string
    repository_benefits_client_secret   = string
  })
  sensitive = true
}

variable "stripe_secrets" {
  description = "Stripe secrets (sensitive)"
  type = object({
    connect_webhook_secret = string
    secret_key             = string
    webhook_secret         = string
  })
  sensitive = true
}

variable "logfire_config" {
  description = "Logfire configuration (optional)"
  type = object({
    server_project_name = string # "production"
    worker_project_name = string # "production-worker"
    server_token        = string
    worker_token        = string
  })
  default   = null
  sensitive = true
}
variable "apple_secrets" {
  description = "Apple secrets (sensitive)"
  type = object({
    client_id = string
    team_id   = string
    key_id    = string
    key_value = string
  })
  sensitive = true
}

variable "prometheus_config" {
  description = "Prometheus Remote Write configuration"
  type = object({
    url      = string
    username = string
    password = string
    interval = number
  })
  sensitive = true
}
