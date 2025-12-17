# =============================================================================
# Variables
# =============================================================================

variable "ghcr_auth_token" {
  description = "GitHub Container Registry auth token (Personal Access Token with read:packages scope)"
  type        = string
  sensitive   = true
}

variable "ghcr_username" {
  description = "GitHub username for GHCR authentication"
  type        = string
  sensitive   = true
}

variable "google_client_id_sandbox" {
  description = "Google Client ID for sandbox"
  type        = string
  sensitive   = true
}

variable "google_client_secret_sandbox" {
  description = "Google Client Secret for sandbox"
  type        = string
  sensitive   = true
}

variable "openai_api_key_sandbox" {
  description = "OpenAI API Key for sandbox"
  type        = string
  sensitive   = true
}

# Backend - Sandbox
variable "backend_current_jwk_kid_sandbox" {
  description = "Current JWK KID for sandbox"
  type        = string
  sensitive   = true
}

variable "backend_discord_bot_token_sandbox" {
  description = "Discord Bot Token for sandbox"
  type        = string
  sensitive   = true
}

variable "backend_discord_client_id_sandbox" {
  description = "Discord Client ID for sandbox"
  type        = string
  sensitive   = true
}

variable "backend_discord_client_secret_sandbox" {
  description = "Discord Client Secret for sandbox"
  type        = string
  sensitive   = true
}

variable "backend_resend_api_key_sandbox" {
  description = "Resend API Key for sandbox"
  type        = string
  sensitive   = true
}

variable "backend_logo_dev_publishable_key_sandbox" {
  description = "Logo.dev Publishable Key for sandbox"
  type        = string
  sensitive   = true
}

variable "backend_secret_sandbox" {
  description = "Backend Secret for sandbox"
  type        = string
  sensitive   = true
}

variable "backend_sentry_dsn_sandbox" {
  description = "Sentry DSN for sandbox"
  type        = string
  sensitive   = true
}

variable "backend_jwks_sandbox" {
  description = "Backend JWKS content for sandbox"
  type        = string
  sensitive   = true
}

# AWS S3 - Sandbox
variable "aws_access_key_id_sandbox" {
  description = "AWS Access Key ID for sandbox"
  type        = string
  sensitive   = true
}

variable "aws_secret_access_key_sandbox" {
  description = "AWS Secret Access Key for sandbox"
  type        = string
  sensitive   = true
}

variable "s3_files_download_salt_sandbox" {
  description = "S3 Files Download Salt for sandbox"
  type        = string
  sensitive   = true
}

variable "s3_files_download_secret_sandbox" {
  description = "S3 Files Download Secret for sandbox"
  type        = string
  sensitive   = true
}

# GitHub - Sandbox
variable "github_client_id_sandbox" {
  description = "GitHub Client ID for sandbox"
  type        = string
  sensitive   = true
}

variable "github_client_secret_sandbox" {
  description = "GitHub Client Secret for sandbox"
  type        = string
  sensitive   = true
}

variable "github_repository_benefits_app_identifier_sandbox" {
  description = "GitHub Repository Benefits App Identifier for sandbox"
  type        = string
  sensitive   = true
}

variable "github_repository_benefits_app_namespace_sandbox" {
  description = "GitHub Repository Benefits App Namespace for sandbox"
  type        = string
  sensitive   = true
}

variable "github_repository_benefits_app_private_key_sandbox" {
  description = "GitHub Repository Benefits App Private Key for sandbox"
  type        = string
  sensitive   = true
}

variable "github_repository_benefits_client_id_sandbox" {
  description = "GitHub Repository Benefits Client ID for sandbox"
  type        = string
  sensitive   = true
}

variable "github_repository_benefits_client_secret_sandbox" {
  description = "GitHub Repository Benefits Client Secret for sandbox"
  type        = string
  sensitive   = true
}

# Stripe - Sandbox
variable "stripe_connect_webhook_secret_sandbox" {
  description = "Stripe Connect Webhook Secret for sandbox"
  type        = string
  sensitive   = true
}

variable "stripe_secret_key_sandbox" {
  description = "Stripe Secret Key for sandbox"
  type        = string
  sensitive   = true
}

variable "stripe_publishable_key_sandbox" {
  description = "Stripe Publishable Key for sandbox"
  type        = string
  sensitive   = true
}

variable "stripe_webhook_secret_sandbox" {
  description = "Stripe Webhook Secret for sandbox"
  type        = string
  sensitive   = true
}

# Apple (shared across environments)
variable "apple_client_id" {
  description = "Apple Client ID"
  type        = string
  sensitive   = true
}

variable "apple_team_id" {
  description = "Apple Team ID"
  type        = string
  sensitive   = true
}

variable "apple_key_id" {
  description = "Apple Key ID"
  type        = string
  sensitive   = true
}

variable "apple_key_value" {
  description = "Apple Key Value"
  type        = string
  sensitive   = true
}

variable "prometheus_remote_write_url" {
  description = "Prometheus Remote Write URL"
  type        = string
  sensitive   = true
}

variable "prometheus_remote_write_username" {
  description = "Prometheus Remote Write Username"
  type        = string
  sensitive   = true
}

variable "prometheus_remote_write_password" {
  description = "Prometheus Remote Write Password"
  type        = string
  sensitive   = true
}

variable "prometheus_remote_write_interval" {
  description = "Prometheus Remote Write Interval"
  type        = number
  sensitive   = false
}

# Logfire
variable "logfire_token_server" {
  description = "Logfire Token for server"
  type        = string
  sensitive   = true
}

variable "logfire_token_worker" {
  description = "Logfire Token for worker"
  type        = string
  sensitive   = true
}
