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

variable "google_service_account_json" {
  description = "Google service account JSON key for fetching the organization review AUP"
  type        = string
  sensitive   = true
}

# OpenAI
variable "openai_api_key" {
  description = "OpenAI API Key for production"
  type        = string
  sensitive   = true
}

# Pydantic AI Gateway
variable "pydantic_ai_gateway_api_key" {
  description = "Pydantic AI Gateway API Key for test"
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
  description = "Resend API Key for test"
  type        = string
  sensitive   = true
}

variable "backend_resend_webhook_secret" {
  description = "Resend Webhook Secret for test"
  type        = string
  sensitive   = true
  default     = ""
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

variable "lambda_worker_tailscale_token" {
  description = "Tailscale auth token for test Lambda workers"
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

variable "stripe_account_risk_webhook_secret" {
  description = "Stripe Account Risk Webhook Secret for test"
  type        = string
  sensitive   = true
  default     = ""
}

# Logfire
variable "logfire_token" {
  description = "Logfire Token"
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

variable "grafana_cloud_prometheus_url" {
  description = "Grafana Cloud Prometheus base URL"
  type        = string
  sensitive   = true
}

variable "grafana_cloud_prometheus_username" {
  description = "Grafana Cloud Prometheus username (numeric stack ID)"
  type        = string
  sensitive   = true
}

variable "grafana_cloud_prometheus_password" {
  description = "Grafana Cloud Prometheus write API key"
  type        = string
  sensitive   = true
}



variable "numeral_api_key" {
  description = "Numeral API Key"
  type        = string
  sensitive   = true
}

# Tinybird
variable "tinybird_api_token" {
  description = "Tinybird API Token"
  type        = string
  sensitive   = true
}

variable "tinybird_clickhouse_username" {
  description = "Tinybird ClickHouse Username"
  type        = string
  sensitive   = true
}

variable "tinybird_clickhouse_token" {
  description = "Tinybird ClickHouse Token"
  type        = string
  sensitive   = true
}

variable "tinybird_workspace" {
  description = "Tinybird Workspace name"
  type        = string
}

variable "tinybird_read_token" {
  description = "Tinybird Read Token"
  type        = string
  sensitive   = true
}

variable "plain_default_tier_external_id" {
  description = "Default Plain tier external ID used as a fallback for the polar-self support benefit"
  type        = string
}

variable "firecrawl_api_key" {
  description = "Firecrawl Cloud API key"
  type        = string
  sensitive   = true
}

variable "backend_discord_proxy_url" {
  description = "Discord Proxy URL"
  type        = string
  sensitive   = true
}

variable "customer_portal_url_overrides" {
  description = "JSON object mapping organization IDs to custom customer portal URLs"
  type        = string
  default     = "{}"
}

variable "polar_access_token" {
  description = "Polar API access token"
  type        = string
  sensitive   = true
}

variable "polar_webhook_secret" {
  description = "Polar webhook secret"
  type        = string
  sensitive   = true
}

variable "polar_organization_id" {
  description = "Polar organization ID"
  type        = string
}

variable "polar_free_product_id" {
  description = "Polar free-tier product ID"
  type        = string
}

variable "polar_scale_product_id" {
  description = "Polar Scale-tier product ID"
  type        = string
}

# Vercel frontend
variable "stripe_publishable_key_preview" {
  description = "Stripe publishable key for Vercel preview deployments"
  type        = string
  sensitive   = true
}

variable "mintlify_assistant_api_key" {
  description = "Mintlify assistant API key for the Vercel frontend"
  type        = string
  sensitive   = true
}

variable "gram_api_key" {
  description = "Gram API key for the Vercel frontend"
  type        = string
  sensitive   = true
}

variable "sentry_auth_token" {
  description = "Sentry auth token for the Vercel frontend build"
  type        = string
  sensitive   = true
}

variable "polar_preview_access_token" {
  description = "Polar preview access token for the Vercel frontend"
  type        = string
  sensitive   = true
}

variable "mcp_oauth2_client_id" {
  description = "MCP OAuth2 client ID for the Vercel frontend"
  type        = string
  sensitive   = true
}

variable "mcp_oauth2_client_secret" {
  description = "MCP OAuth2 client secret for the Vercel frontend"
  type        = string
  sensitive   = true
}

variable "next_public_sentry_dsn" {
  description = "Sentry DSN for the Vercel frontend"
  type        = string
  sensitive   = true
}

variable "next_public_posthog_token" {
  description = "PostHog token for the Vercel frontend"
  type        = string
  sensitive   = true
}

variable "next_public_apple_domain_association" {
  description = "Apple Pay domain association for the Vercel frontend"
  type        = string
  sensitive   = true
}

variable "next_public_stripe_payment_method_configuration" {
  description = "Stripe payment method configuration ID for the Vercel frontend"
  type        = string
  sensitive   = true
}

variable "worker_sqs_actors" {
  description = "JSON array of Dramatiq actor names routed to the SQS execution engine"
  type        = string
  default     = "[\"dummy\"]"
}

variable "stripe_app_client_id" {
  description = "Stripe App OAuth client ID"
  type        = string
  default     = ""
}

variable "stripe_app_client_link_id" {
  description = "Stripe App OAuth client link ID"
  type        = string
  default     = ""
}

variable "turnstile_secret" {
  description = "Cloudflare Turnstile secret"
  type        = string
  sensitive   = true
}
