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

# Google
variable "google_client_id" {
  description = "Google Client ID for production"
  type        = string
  sensitive   = true
}

variable "google_client_secret" {
  description = "Google Client Secret for production"
  type        = string
  sensitive   = true
}

# OpenAI
variable "openai_api_key" {
  description = "OpenAI API Key for production"
  type        = string
  sensitive   = true
}

# Backend - Production
variable "backend_current_jwk_kid" {
  description = "Current JWK KID for production"
  type        = string
  sensitive   = true
}

variable "backend_discord_bot_token" {
  description = "Discord Bot Token for production"
  type        = string
  sensitive   = true
}

variable "backend_discord_client_id" {
  description = "Discord Client ID for production"
  type        = string
  sensitive   = true
}

variable "backend_discord_client_secret" {
  description = "Discord Client Secret for production"
  type        = string
  sensitive   = true
}

variable "backend_resend_api_key" {
  description = "Resend API Key for production"
  type        = string
  sensitive   = true
}

variable "backend_logo_dev_publishable_key" {
  description = "Logo.dev Publishable Key for production"
  type        = string
  sensitive   = true
}

variable "backend_secret" {
  description = "Backend Secret for production"
  type        = string
  sensitive   = true
}

variable "backend_sentry_dsn" {
  description = "Sentry DSN for production"
  type        = string
  sensitive   = true
}


variable "backend_jwks" {
  description = "Backend JWKS content for production"
  type        = string
  sensitive   = true
}

# AWS S3
variable "aws_access_key_id" {
  description = "AWS Access Key ID for production"
  type        = string
  sensitive   = true
}

variable "aws_secret_access_key" {
  description = "AWS Secret Access Key for production"
  type        = string
  sensitive   = true
}

variable "s3_files_download_salt" {
  description = "S3 Files Download Salt for production"
  type        = string
  sensitive   = true
}

variable "s3_files_download_secret" {
  description = "S3 Files Download Secret for production"
  type        = string
  sensitive   = true
}

# GitHub
variable "github_client_id" {
  description = "GitHub Client ID for production"
  type        = string
  sensitive   = true
}

variable "github_client_secret" {
  description = "GitHub Client Secret for production"
  type        = string
  sensitive   = true
}

variable "github_repository_benefits_app_identifier" {
  description = "GitHub Repository Benefits App Identifier for production"
  type        = string
  sensitive   = true
}

variable "github_repository_benefits_app_namespace" {
  description = "GitHub Repository Benefits App Namespace for production"
  type        = string
  sensitive   = true
}

variable "github_repository_benefits_app_private_key" {
  description = "GitHub Repository Benefits App Private Key for production"
  type        = string
  sensitive   = true
}

variable "github_repository_benefits_client_id" {
  description = "GitHub Repository Benefits Client ID for production"
  type        = string
  sensitive   = true
}

variable "github_repository_benefits_client_secret" {
  description = "GitHub Repository Benefits Client Secret for production"
  type        = string
  sensitive   = true
}

# Stripe
variable "stripe_connect_webhook_secret" {
  description = "Stripe Connect Webhook Secret for production"
  type        = string
  sensitive   = true
}

variable "stripe_secret_key" {
  description = "Stripe Secret Key for production"
  type        = string
  sensitive   = true
}

variable "stripe_publishable_key" {
  description = "Stripe Publishable Key for production"
  type        = string
  sensitive   = true
}

variable "stripe_webhook_secret" {
  description = "Stripe Webhook Secret for production"
  type        = string
  sensitive   = true
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
