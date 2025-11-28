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

# Google
variable "google_client_id_production" {
  description = "Google Client ID for production"
  type        = string
  sensitive   = true
}

variable "google_client_secret_production" {
  description = "Google Client Secret for production"
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

# OpenAI
variable "openai_api_key_production" {
  description = "OpenAI API Key for production"
  type        = string
  sensitive   = true
}

variable "openai_api_key_sandbox" {
  description = "OpenAI API Key for sandbox"
  type        = string
  sensitive   = true
}

# Backend - Production
variable "backend_current_jwk_kid_production" {
  description = "Current JWK KID for production"
  type        = string
  sensitive   = true
}

variable "backend_discord_bot_token_production" {
  description = "Discord Bot Token for production"
  type        = string
  sensitive   = true
}

variable "backend_discord_client_id_production" {
  description = "Discord Client ID for production"
  type        = string
  sensitive   = true
}

variable "backend_discord_client_secret_production" {
  description = "Discord Client Secret for production"
  type        = string
  sensitive   = true
}

variable "backend_discord_webhook_url_production" {
  description = "Discord Webhook URL for production"
  type        = string
  sensitive   = true
}

variable "backend_loops_api_key_production" {
  description = "Loops API Key for production"
  type        = string
  sensitive   = true
}

variable "backend_posthog_project_api_key_production" {
  description = "PostHog Project API Key for production"
  type        = string
  sensitive   = true
}

variable "backend_resend_api_key_production" {
  description = "Resend API Key for production"
  type        = string
  sensitive   = true
}

variable "backend_secret_production" {
  description = "Backend Secret for production"
  type        = string
  sensitive   = true
}

variable "backend_sentry_dsn_production" {
  description = "Sentry DSN for production"
  type        = string
  sensitive   = true
}

variable "backend_plain_request_signing_secret_production" {
  description = "Plain Request Signing Secret for production"
  type        = string
  sensitive   = true
}

variable "backend_plain_token_production" {
  description = "Plain Token for production"
  type        = string
  sensitive   = true
}

variable "backend_plain_chat_secret_production" {
  description = "Plain Chat Secret for production"
  type        = string
  sensitive   = true
}

variable "backend_jwks_production" {
  description = "Backend JWKS content for production"
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

# AWS S3 - Production
variable "aws_access_key_id_production" {
  description = "AWS Access Key ID for production"
  type        = string
  sensitive   = true
}

variable "aws_secret_access_key_production" {
  description = "AWS Secret Access Key for production"
  type        = string
  sensitive   = true
}

variable "s3_files_download_salt_production" {
  description = "S3 Files Download Salt for production"
  type        = string
  sensitive   = true
}

variable "s3_files_download_secret_production" {
  description = "S3 Files Download Secret for production"
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

# GitHub - Production
variable "github_client_id_production" {
  description = "GitHub Client ID for production"
  type        = string
  sensitive   = true
}

variable "github_client_secret_production" {
  description = "GitHub Client Secret for production"
  type        = string
  sensitive   = true
}

variable "github_repository_benefits_app_identifier_production" {
  description = "GitHub Repository Benefits App Identifier for production"
  type        = string
  sensitive   = true
}

variable "github_repository_benefits_app_namespace_production" {
  description = "GitHub Repository Benefits App Namespace for production"
  type        = string
  sensitive   = true
}

variable "github_repository_benefits_app_private_key_production" {
  description = "GitHub Repository Benefits App Private Key for production"
  type        = string
  sensitive   = true
}

variable "github_repository_benefits_client_id_production" {
  description = "GitHub Repository Benefits Client ID for production"
  type        = string
  sensitive   = true
}

variable "github_repository_benefits_client_secret_production" {
  description = "GitHub Repository Benefits Client Secret for production"
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

# Stripe - Production
variable "stripe_connect_webhook_secret_production" {
  description = "Stripe Connect Webhook Secret for production"
  type        = string
  sensitive   = true
}

variable "stripe_secret_key_production" {
  description = "Stripe Secret Key for production"
  type        = string
  sensitive   = true
}

variable "stripe_publishable_key_production" {
  description = "Stripe Publishable Key for production"
  type        = string
  sensitive   = true
}

variable "stripe_webhook_secret_production" {
  description = "Stripe Webhook Secret for production"
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

# =============================================================================
# Registry Credential
# =============================================================================

resource "render_registry_credential" "ghcr" {
  name       = "Registry Credentials for GHCR"
  registry   = "GITHUB"
  username   = var.ghcr_username
  auth_token = var.ghcr_auth_token
}

# =============================================================================
# Locals
# =============================================================================

locals {
  # Database connection info (derived from postgres resource)
  db_host          = render_postgres.db.id
  db_internal_host = render_postgres.db.id
  db_port          = "5432"
  db_name          = render_postgres.db.database_name
  db_user          = render_postgres.db.database_user
  db_password      = render_postgres.db.connection_info.password

  # Read replica connection info
  read_replica = [for r in render_postgres.db.read_replicas : r if r.name == "polar-read"][0]

  # Redis connection info
  redis_host = render_redis.redis.id
  redis_port = "6379"
}

# =============================================================================
# Project and Environments
# ============================================================================

resource "render_project" "polar" {
  name = "Polar"
  environments = {
    "Production" : {
      id               = "evm-cj3pgodiuie55pmjh2l0"
      name             = "Production"
      protected_status = "unprotected"
    },
    "Sandbox" : {
      id               = "evm-crkmmujv2p9s73e47bn0"
      name             = "Sandbox"
      protected_status = "unprotected"
    }
  }
}

# =============================================================================
# PostgreSQL Database
# =============================================================================

resource "render_postgres" "db" {
  environment_id = render_project.polar.environments["Production"].id
  name           = "db"
  database_name  = "polar_cpit"
  database_user  = "polar_cpit_user"
  plan           = "pro_16gb"
  region         = "ohio"
  version        = "15"
  disk_size_gb   = 100

  high_availability_enabled = true

  read_replicas = [
    { name = "polar-read" },
    { name = "polar-replica" }
  ]
}

# =============================================================================
# Redis
# =============================================================================

resource "render_redis" "redis" {
  environment_id    = render_project.polar.environments["Production"].id
  name              = "redis"
  plan              = "standard"
  region            = "ohio"
  max_memory_policy = "noeviction"

  # Empty IP allow list means only private network connections
  ip_allow_list = []
}

# =============================================================================
# Environment Variable Groups - Production
# =============================================================================

resource "render_env_group" "google_production" {
  environment_id = render_project.polar.environments["Production"].id
  name           = "google-production"
  env_vars = {
    POLAR_GOOGLE_CLIENT_ID     = { value = var.google_client_id_production }
    POLAR_GOOGLE_CLIENT_SECRET = { value = var.google_client_secret_production }
  }
}

resource "render_env_group" "openai_production" {
  environment_id = render_project.polar.environments["Production"].id
  name           = "openai-production"
  env_vars = {
    POLAR_OPENAI_API_KEY = { value = var.openai_api_key_production }
  }
}

resource "render_env_group" "backend_production" {
  environment_id = render_project.polar.environments["Production"].id
  name           = "backend-production"
  env_vars = {
    POLAR_USER_SESSION_COOKIE_DOMAIN           = { value = "polar.sh" }
    POLAR_BASE_URL                             = { value = "https://api.polar.sh" }
    POLAR_BACKOFFICE_HOST                      = { value = "backoffice.polar.sh" }
    POLAR_DEBUG                                = { value = "0" }
    POLAR_EMAIL_SENDER                         = { value = "resend" }
    POLAR_EMAIL_FROM_NAME                      = { value = "Polar" }
    POLAR_EMAIL_FROM_DOMAIN                    = { value = "notifications.polar.sh" }
    POLAR_ENV                                  = { value = "production" }
    POLAR_FRONTEND_BASE_URL                    = { value = "https://polar.sh" }
    POLAR_CHECKOUT_BASE_URL                    = { value = "https://buy.polar.sh/{client_secret}" }
    POLAR_JWKS                                 = { value = "/etc/secrets/jwks.json" }
    POLAR_LOG_LEVEL                            = { value = "INFO" }
    POLAR_TESTING                              = { value = "0" }
    POLAR_ORGANIZATIONS_BILLING_ENGINE_DEFAULT = { value = "1" }
    POLAR_AUTH_COOKIE_DOMAIN                   = { value = "polar.sh" }
    POLAR_INVOICES_ADDITIONAL_INFO             = { value = "[support@polar.sh](mailto:support@polar.sh)\nVAT: EU372061545" }
    POLAR_STRIPE_PUBLISHABLE_KEY               = { value = var.stripe_publishable_key_production }
    POLAR_CURRENT_JWK_KID                      = { value = var.backend_current_jwk_kid_production }
    POLAR_DISCORD_BOT_TOKEN                    = { value = var.backend_discord_bot_token_production }
    POLAR_DISCORD_CLIENT_ID                    = { value = var.backend_discord_client_id_production }
    POLAR_DISCORD_CLIENT_SECRET                = { value = var.backend_discord_client_secret_production }
    POLAR_DISCORD_WEBHOOK_URL                  = { value = var.backend_discord_webhook_url_production }
    POLAR_LOOPS_API_KEY                        = { value = var.backend_loops_api_key_production }
    POLAR_POSTHOG_PROJECT_API_KEY              = { value = var.backend_posthog_project_api_key_production }
    POLAR_RESEND_API_KEY                       = { value = var.backend_resend_api_key_production }
    POLAR_SECRET                               = { value = var.backend_secret_production }
    POLAR_SENTRY_DSN                           = { value = var.backend_sentry_dsn_production }
    POLAR_PLAIN_REQUEST_SIGNING_SECRET         = { value = var.backend_plain_request_signing_secret_production }
    POLAR_PLAIN_TOKEN                          = { value = var.backend_plain_token_production }
    POLAR_PLAIN_CHAT_SECRET                    = { value = var.backend_plain_chat_secret_production }
  }

  secret_files = {
    "jwks.json" = {
      content = var.backend_jwks_production
    }
  }
}

resource "render_env_group" "aws_s3_production" {
  environment_id = render_project.polar.environments["Production"].id
  name           = "aws-s3-production"
  env_vars = {
    POLAR_AWS_REGION                       = { value = "us-east-2" }
    POLAR_AWS_SIGNATURE_VERSION            = { value = "v4" }
    POLAR_S3_FILES_BUCKET_NAME             = { value = "polar-production-files" }
    POLAR_S3_FILES_PRESIGN_TTL             = { value = "600" }
    POLAR_S3_FILES_PUBLIC_BUCKET_NAME      = { value = "polar-public-files" }
    POLAR_S3_CUSTOMER_INVOICES_BUCKET_NAME = { value = "polar-customer-invoices" }
    POLAR_S3_PAYOUT_INVOICES_BUCKET_NAME   = { value = "polar-payout-invoices" }
    POLAR_AWS_ACCESS_KEY_ID                = { value = var.aws_access_key_id_production }
    POLAR_AWS_SECRET_ACCESS_KEY            = { value = var.aws_secret_access_key_production }
    POLAR_S3_FILES_DOWNLOAD_SALT           = { value = var.s3_files_download_salt_production }
    POLAR_S3_FILES_DOWNLOAD_SECRET         = { value = var.s3_files_download_secret_production }
  }
}

resource "render_env_group" "github_production" {
  environment_id = render_project.polar.environments["Production"].id
  name           = "github-production"
  env_vars = {
    POLAR_GITHUB_CLIENT_ID                           = { value = var.github_client_id_production }
    POLAR_GITHUB_CLIENT_SECRET                       = { value = var.github_client_secret_production }
    POLAR_GITHUB_REPOSITORY_BENEFITS_APP_IDENTIFIER  = { value = var.github_repository_benefits_app_identifier_production }
    POLAR_GITHUB_REPOSITORY_BENEFITS_APP_NAMESPACE   = { value = var.github_repository_benefits_app_namespace_production }
    POLAR_GITHUB_REPOSITORY_BENEFITS_APP_PRIVATE_KEY = { value = var.github_repository_benefits_app_private_key_production }
    POLAR_GITHUB_REPOSITORY_BENEFITS_CLIENT_ID       = { value = var.github_repository_benefits_client_id_production }
    POLAR_GITHUB_REPOSITORY_BENEFITS_CLIENT_SECRET   = { value = var.github_repository_benefits_client_secret_production }
  }
}

resource "render_env_group" "stripe_production" {
  environment_id = render_project.polar.environments["Production"].id
  name           = "stripe-production"
  env_vars = {
    POLAR_STRIPE_CONNECT_WEBHOOK_SECRET = { value = var.stripe_connect_webhook_secret_production }
    POLAR_STRIPE_SECRET_KEY             = { value = var.stripe_secret_key_production }
    POLAR_STRIPE_WEBHOOK_SECRET         = { value = var.stripe_webhook_secret_production }
  }
}

resource "render_env_group" "logfire_server" {
  environment_id = render_project.polar.environments["Production"].id
  name           = "logfire-server"
  env_vars = {
    POLAR_LOGFIRE_PROJECT_NAME = { value = "production" }
    POLAR_LOGFIRE_TOKEN        = { value = var.logfire_token_server }
  }
}

resource "render_env_group" "logfire_worker" {
  environment_id = render_project.polar.environments["Production"].id
  name           = "logfire-worker"
  env_vars = {
    POLAR_LOGFIRE_PROJECT_NAME = { value = "production-worker" }
    POLAR_LOGFIRE_TOKEN        = { value = var.logfire_token_worker }
  }
}

resource "render_env_group" "apple_production" {
  environment_id = render_project.polar.environments["Production"].id
  name           = "apple-production"
  env_vars = {
    POLAR_APPLE_CLIENT_ID = { value = var.apple_client_id }
    POLAR_APPLE_TEAM_ID   = { value = var.apple_team_id }
    POLAR_APPLE_KEY_ID    = { value = var.apple_key_id }
    POLAR_APPLE_KEY_VALUE = { value = var.apple_key_value }
  }
}

# =============================================================================
# Environment Variable Groups - Sandbox
# =============================================================================

resource "render_env_group" "google_sandbox" {
  environment_id = render_project.polar.environments["Sandbox"].id
  name           = "google-sandbox"
  env_vars = {
    POLAR_GOOGLE_CLIENT_ID     = { value = var.google_client_id_sandbox }
    POLAR_GOOGLE_CLIENT_SECRET = { value = var.google_client_secret_sandbox }
  }
}

resource "render_env_group" "openai_sandbox" {
  environment_id = render_project.polar.environments["Sandbox"].id
  name           = "openai-sandbox"
  env_vars = {
    POLAR_OPENAI_API_KEY = { value = var.openai_api_key_sandbox }
  }
}

resource "render_env_group" "backend_sandbox" {
  environment_id = render_project.polar.environments["Sandbox"].id
  name           = "backend-sandbox"
  env_vars = {
    POLAR_USER_SESSION_COOKIE_KEY              = { value = "polar_sandbox_session" }
    POLAR_USER_SESSION_COOKIE_DOMAIN           = { value = "polar.sh" }
    POLAR_BASE_URL                             = { value = "https://sandbox-api.polar.sh" }
    POLAR_DEBUG                                = { value = "0" }
    POLAR_EMAIL_SENDER                         = { value = "resend" }
    POLAR_EMAIL_FROM_NAME                      = { value = "[SANDBOX] Polar" }
    POLAR_EMAIL_FROM_DOMAIN                    = { value = "notifications.sandbox.polar.sh" }
    POLAR_ENV                                  = { value = "sandbox" }
    POLAR_FRONTEND_BASE_URL                    = { value = "https://sandbox.polar.sh" }
    POLAR_CHECKOUT_BASE_URL                    = { value = "https://sandbox-api.polar.sh/v1/checkout-links/{client_secret}/redirect" }
    POLAR_JWKS                                 = { value = "/etc/secrets/jwks.json" }
    POLAR_LOG_LEVEL                            = { value = "INFO" }
    POLAR_TESTING                              = { value = "0" }
    POLAR_ORGANIZATIONS_BILLING_ENGINE_DEFAULT = { value = "1" }
    POLAR_AUTH_COOKIE_DOMAIN                   = { value = "polar.sh" }
    POLAR_AUTH_COOKIE_KEY                      = { value = "polar_sandbox_session" }
    POLAR_STRIPE_PUBLISHABLE_KEY               = { value = var.stripe_publishable_key_sandbox }
    POLAR_CURRENT_JWK_KID                      = { value = var.backend_current_jwk_kid_sandbox }
    POLAR_DISCORD_BOT_TOKEN                    = { value = var.backend_discord_bot_token_sandbox }
    POLAR_DISCORD_CLIENT_ID                    = { value = var.backend_discord_client_id_sandbox }
    POLAR_DISCORD_CLIENT_SECRET                = { value = var.backend_discord_client_secret_sandbox }
    POLAR_RESEND_API_KEY                       = { value = var.backend_resend_api_key_sandbox }
    POLAR_SECRET                               = { value = var.backend_secret_sandbox }
    POLAR_SENTRY_DSN                           = { value = var.backend_sentry_dsn_sandbox }
  }

  secret_files = {
    "jwks.json" = {
      content = var.backend_jwks_sandbox
    }
  }
}

resource "render_env_group" "aws_s3_sandbox" {
  environment_id = render_project.polar.environments["Sandbox"].id
  name           = "aws-s3-sandbox"
  env_vars = {
    POLAR_AWS_REGION                       = { value = "us-east-2" }
    POLAR_AWS_SIGNATURE_VERSION            = { value = "v4" }
    POLAR_S3_FILES_BUCKET_NAME             = { value = "polar-sandbox-files" }
    POLAR_S3_FILES_PRESIGN_TTL             = { value = "600" }
    POLAR_S3_FILES_PUBLIC_BUCKET_NAME      = { value = "polar-public-sandbox-files" }
    POLAR_S3_CUSTOMER_INVOICES_BUCKET_NAME = { value = "polar-sandbox-customer-invoices" }
    POLAR_S3_PAYOUT_INVOICES_BUCKET_NAME   = { value = "polar-sandbox-payout-invoices" }
    POLAR_AWS_ACCESS_KEY_ID                = { value = var.aws_access_key_id_sandbox }
    POLAR_AWS_SECRET_ACCESS_KEY            = { value = var.aws_secret_access_key_sandbox }
    POLAR_S3_FILES_DOWNLOAD_SALT           = { value = var.s3_files_download_salt_sandbox }
    POLAR_S3_FILES_DOWNLOAD_SECRET         = { value = var.s3_files_download_secret_sandbox }
  }
}

resource "render_env_group" "github_sandbox" {
  environment_id = render_project.polar.environments["Sandbox"].id
  name           = "github-sandbox"
  env_vars = {
    POLAR_GITHUB_CLIENT_ID                           = { value = var.github_client_id_sandbox }
    POLAR_GITHUB_CLIENT_SECRET                       = { value = var.github_client_secret_sandbox }
    POLAR_GITHUB_REPOSITORY_BENEFITS_APP_IDENTIFIER  = { value = var.github_repository_benefits_app_identifier_sandbox }
    POLAR_GITHUB_REPOSITORY_BENEFITS_APP_NAMESPACE   = { value = var.github_repository_benefits_app_namespace_sandbox }
    POLAR_GITHUB_REPOSITORY_BENEFITS_APP_PRIVATE_KEY = { value = var.github_repository_benefits_app_private_key_sandbox }
    POLAR_GITHUB_REPOSITORY_BENEFITS_CLIENT_ID       = { value = var.github_repository_benefits_client_id_sandbox }
    POLAR_GITHUB_REPOSITORY_BENEFITS_CLIENT_SECRET   = { value = var.github_repository_benefits_client_secret_sandbox }
  }
}

resource "render_env_group" "stripe_sandbox" {
  environment_id = render_project.polar.environments["Sandbox"].id
  name           = "stripe-sandbox"
  env_vars = {
    POLAR_STRIPE_CONNECT_WEBHOOK_SECRET = { value = var.stripe_connect_webhook_secret_sandbox }
    POLAR_STRIPE_SECRET_KEY             = { value = var.stripe_secret_key_sandbox }
    POLAR_STRIPE_WEBHOOK_SECRET         = { value = var.stripe_webhook_secret_sandbox }
  }
}

resource "render_env_group" "apple_sandbox" {
  environment_id = render_project.polar.environments["Sandbox"].id
  name           = "apple-sandbox"
  env_vars = {
    POLAR_APPLE_CLIENT_ID = { value = var.apple_client_id }
    POLAR_APPLE_TEAM_ID   = { value = var.apple_team_id }
    POLAR_APPLE_KEY_ID    = { value = var.apple_key_id }
    POLAR_APPLE_KEY_VALUE = { value = var.apple_key_value }
  }
}

# =============================================================================
# Web Services - Production
# =============================================================================

resource "render_web_service" "api" {
  environment_id     = render_project.polar.environments["Production"].id
  name               = "api"
  plan               = "standard"
  region             = "ohio"
  health_check_path  = "/healthz"
  pre_deploy_command = "uv run task pre_deploy"

  runtime_source = {
    image = {
      image_url              = "ghcr.io/polarsource/polar"
      tag                    = "latest"
      registry_credential_id = render_registry_credential.ghcr.id
    }
  }

  autoscaling = {
    enabled = true
    min     = 1
    max     = 2
    criteria = {
      cpu = {
        enabled    = true
        percentage = 90
      }
      memory = {
        enabled    = true
        percentage = 90
      }
    }
  }

  custom_domains = [
    { name = "api.polar.sh" },
    { name = "backoffice.polar.sh" }
  ]

  env_vars = {
    WEB_CONCURRENCY              = { value = "2" }
    FORWARDED_ALLOW_IPS          = { value = "*" }
    POLAR_ALLOWED_HOSTS          = { value = "[\"polar.sh\", \"backoffice.polar.sh\"]" }
    POLAR_CORS_ORIGINS           = { value = "[\"https://polar.sh\", \"https://github.com\", \"https://docs.polar.sh\"]" }
    POLAR_DATABASE_POOL_SIZE     = { value = "20" }
    POLAR_POSTGRES_DATABASE      = { value = "polar_cpit" }
    POLAR_POSTGRES_HOST          = { value = local.db_internal_host }
    POLAR_POSTGRES_PORT          = { value = local.db_port }
    POLAR_POSTGRES_USER          = { value = local.db_user }
    POLAR_POSTGRES_PWD           = { value = local.db_password }
    POLAR_POSTGRES_READ_DATABASE = { value = "polar_cpit" }
    POLAR_POSTGRES_READ_HOST     = { value = local.read_replica.id }
    POLAR_POSTGRES_READ_PORT     = { value = local.db_port }
    POLAR_POSTGRES_READ_USER     = { value = local.db_user }
    POLAR_POSTGRES_READ_PWD      = { value = local.db_password }
    POLAR_REDIS_HOST             = { value = local.redis_host }
    POLAR_REDIS_PORT             = { value = local.redis_port }
    POLAR_REDIS_DB               = { value = "0" }
  }
}

resource "render_web_service" "worker" {
  environment_id    = render_project.polar.environments["Production"].id
  name              = "worker"
  plan              = "pro"
  region            = "ohio"
  health_check_path = "/"
  start_command     = "uv run dramatiq polar.worker.run -p 2 -t 8 --queues low_priority"
  num_instances     = 1

  custom_domains = [
    { name = "worker.polar.sh" }
  ]

  runtime_source = {
    image = {
      image_url              = "ghcr.io/polarsource/polar"
      digest                 = "sha256:d55ecc35d8a51bcf7dde0d4d865c96b9de8d2c3469b12d1a719fef2ae39a4825"
      registry_credential_id = render_registry_credential.ghcr.id
    }
  }

  env_vars = {
    dramatiq_prom_port           = { value = "10000" }
    POLAR_POSTGRES_DATABASE      = { value = "polar_cpit" }
    POLAR_POSTGRES_HOST          = { value = local.db_internal_host }
    POLAR_POSTGRES_PORT          = { value = local.db_port }
    POLAR_POSTGRES_USER          = { value = local.db_user }
    POLAR_POSTGRES_PWD           = { value = local.db_password }
    POLAR_POSTGRES_READ_DATABASE = { value = "polar_cpit" }
    POLAR_POSTGRES_READ_HOST     = { value = local.read_replica.id }
    POLAR_POSTGRES_READ_PORT     = { value = local.db_port }
    POLAR_POSTGRES_READ_USER     = { value = local.db_user }
    POLAR_POSTGRES_READ_PWD      = { value = local.db_password }
    POLAR_REDIS_HOST             = { value = local.redis_host }
    POLAR_REDIS_PORT             = { value = local.redis_port }
    POLAR_REDIS_DB               = { value = "0" }
  }
}

resource "render_web_service" "worker_medium_priority" {
  environment_id    = render_project.polar.environments["Production"].id
  name              = "worker-medium-priority"
  plan              = "pro"
  region            = "ohio"
  health_check_path = "/"
  start_command     = "uv run dramatiq polar.worker.run -p 2 -t 8 --queues default medium_priority"
  num_instances     = 1

  runtime_source = {
    image = {
      image_url              = "ghcr.io/polarsource/polar"
      tag                    = "latest"
      registry_credential_id = render_registry_credential.ghcr.id
    }
  }

  env_vars = {
    dramatiq_prom_port           = { value = "10001" }
    POLAR_POSTGRES_DATABASE      = { value = "polar_cpit" }
    POLAR_POSTGRES_HOST          = { value = local.db_internal_host }
    POLAR_POSTGRES_PORT          = { value = local.db_port }
    POLAR_POSTGRES_USER          = { value = local.db_user }
    POLAR_POSTGRES_PWD           = { value = local.db_password }
    POLAR_POSTGRES_READ_DATABASE = { value = "polar_cpit" }
    POLAR_POSTGRES_READ_HOST     = { value = local.read_replica.id }
    POLAR_POSTGRES_READ_PORT     = { value = local.db_port }
    POLAR_POSTGRES_READ_USER     = { value = local.db_user }
    POLAR_POSTGRES_READ_PWD      = { value = local.db_password }
    POLAR_REDIS_HOST             = { value = local.redis_host }
    POLAR_REDIS_PORT             = { value = local.redis_port }
    POLAR_REDIS_DB               = { value = "0" }
  }
}

resource "render_web_service" "worker_high_priority" {
  environment_id    = render_project.polar.environments["Production"].id
  name              = "worker-high-priority"
  plan              = "pro"
  region            = "ohio"
  health_check_path = "/"
  start_command     = "uv run dramatiq polar.worker.run -p 2 -t 8 --queues high_priority -f polar.worker.scheduler:start"
  num_instances     = 1

  runtime_source = {
    image = {
      image_url              = "ghcr.io/polarsource/polar"
      tag                    = "latest"
      registry_credential_id = render_registry_credential.ghcr.id
    }
  }

  env_vars = {
    dramatiq_prom_port           = { value = "10001" }
    POLAR_POSTGRES_DATABASE      = { value = "polar_cpit" }
    POLAR_POSTGRES_HOST          = { value = local.db_internal_host }
    POLAR_POSTGRES_PORT          = { value = local.db_port }
    POLAR_POSTGRES_USER          = { value = local.db_user }
    POLAR_POSTGRES_PWD           = { value = local.db_password }
    POLAR_POSTGRES_READ_DATABASE = { value = "polar_cpit" }
    POLAR_POSTGRES_READ_HOST     = { value = local.read_replica.id }
    POLAR_POSTGRES_READ_PORT     = { value = local.db_port }
    POLAR_POSTGRES_READ_USER     = { value = local.db_user }
    POLAR_POSTGRES_READ_PWD      = { value = local.db_password }
    POLAR_REDIS_HOST             = { value = local.redis_host }
    POLAR_REDIS_PORT             = { value = local.redis_port }
    POLAR_REDIS_DB               = { value = "0" }
  }
}

resource "render_web_service" "worker_default" {
  environment_id    = render_project.polar.environments["Production"].id
  name              = "worker-default"
  plan              = "pro"
  region            = "ohio"
  health_check_path = "/"
  start_command     = "uv run dramatiq polar.worker.run -p 2 -t 8 --queues default"
  num_instances     = 1

  runtime_source = {
    image = {
      image_url              = "ghcr.io/polarsource/polar"
      tag                    = "latest"
      registry_credential_id = render_registry_credential.ghcr.id
    }
  }

  env_vars = {
    dramatiq_prom_port           = { value = "10001" }
    POLAR_POSTGRES_DATABASE      = { value = "polar_cpit" }
    POLAR_POSTGRES_HOST          = { value = local.db_internal_host }
    POLAR_POSTGRES_PORT          = { value = local.db_port }
    POLAR_POSTGRES_USER          = { value = local.db_user }
    POLAR_POSTGRES_PWD           = { value = local.db_password }
    POLAR_POSTGRES_READ_DATABASE = { value = "polar_cpit" }
    POLAR_POSTGRES_READ_HOST     = { value = local.read_replica.id }
    POLAR_POSTGRES_READ_PORT     = { value = local.db_port }
    POLAR_POSTGRES_READ_USER     = { value = local.db_user }
    POLAR_POSTGRES_READ_PWD      = { value = local.db_password }
    POLAR_REDIS_HOST             = { value = local.redis_host }
    POLAR_REDIS_PORT             = { value = local.redis_port }
    POLAR_REDIS_DB               = { value = "0" }
  }
}

# =============================================================================
# Web Services - Sandbox
# =============================================================================

resource "render_web_service" "api_sandbox" {
  environment_id     = render_project.polar.environments["Sandbox"].id
  name               = "api-sandbox"
  plan               = "standard"
  region             = "ohio"
  health_check_path  = "/healthz"
  pre_deploy_command = "uv run task pre_deploy"
  num_instances      = 1

  runtime_source = {
    image = {
      image_url              = "ghcr.io/polarsource/polar"
      tag                    = "latest"
      registry_credential_id = render_registry_credential.ghcr.id
    }
  }

  custom_domains = [
    { name = "sandbox-api.polar.sh" }
  ]

  env_vars = {
    WEB_CONCURRENCY              = { value = "2" }
    FORWARDED_ALLOW_IPS          = { value = "*" }
    POLAR_ALLOWED_HOSTS          = { value = "[\"sandbox.polar.sh\"]" }
    POLAR_CORS_ORIGINS           = { value = "[\"https://sandbox.polar.sh\", \"https://github.com\", \"https://docs.polar.sh\"]" }
    POLAR_POSTGRES_DATABASE      = { value = "polar_sandbox" }
    POLAR_POSTGRES_HOST          = { value = local.db_internal_host }
    POLAR_POSTGRES_PORT          = { value = local.db_port }
    POLAR_POSTGRES_USER          = { value = local.db_user }
    POLAR_POSTGRES_PWD           = { value = local.db_password }
    POLAR_POSTGRES_READ_DATABASE = { value = "polar_sandbox" }
    POLAR_POSTGRES_READ_HOST     = { value = local.read_replica.id }
    POLAR_POSTGRES_READ_PORT     = { value = local.db_port }
    POLAR_POSTGRES_READ_USER     = { value = local.db_user }
    POLAR_POSTGRES_READ_PWD      = { value = local.db_password }
    POLAR_REDIS_HOST             = { value = local.redis_host }
    POLAR_REDIS_PORT             = { value = local.redis_port }
    POLAR_REDIS_DB               = { value = "1" }
  }
}

resource "render_web_service" "worker_sandbox" {
  environment_id    = render_project.polar.environments["Sandbox"].id
  name              = "worker-sandbox"
  plan              = "pro"
  region            = "ohio"
  health_check_path = "/"
  start_command     = "uv run dramatiq -p 2 -t 4 -f polar.worker.scheduler:start polar.worker.run"
  num_instances     = 1

  runtime_source = {
    image = {
      image_url              = "ghcr.io/polarsource/polar"
      tag                    = "latest"
      registry_credential_id = render_registry_credential.ghcr.id
    }
  }

  env_vars = {
    dramatiq_prom_port           = { value = "10000" }
    POLAR_POSTGRES_DATABASE      = { value = "polar_sandbox" }
    POLAR_POSTGRES_HOST          = { value = local.db_internal_host }
    POLAR_POSTGRES_PORT          = { value = local.db_port }
    POLAR_POSTGRES_USER          = { value = local.db_user }
    POLAR_POSTGRES_PWD           = { value = local.db_password }
    POLAR_POSTGRES_READ_DATABASE = { value = "polar_sandbox" }
    POLAR_POSTGRES_READ_HOST     = { value = local.read_replica.id }
    POLAR_POSTGRES_READ_PORT     = { value = local.db_port }
    POLAR_POSTGRES_READ_USER     = { value = local.db_user }
    POLAR_POSTGRES_READ_PWD      = { value = local.db_password }
    POLAR_REDIS_HOST             = { value = local.redis_host }
    POLAR_REDIS_PORT             = { value = local.redis_port }
    POLAR_REDIS_DB               = { value = "1" }
  }
}

# =============================================================================
# Environment Group Links - Production
# =============================================================================

resource "render_env_group_link" "aws_s3_production" {
  env_group_id = render_env_group.aws_s3_production.id
  service_ids  = [render_web_service.api.id, render_web_service.worker.id, render_web_service.worker_high_priority.id, render_web_service.worker_medium_priority.id]
}

resource "render_env_group_link" "google_production" {
  env_group_id = render_env_group.google_production.id
  service_ids  = [render_web_service.api.id, render_web_service.worker.id, render_web_service.worker_high_priority.id, render_web_service.worker_medium_priority.id]
}

resource "render_env_group_link" "github_production" {
  env_group_id = render_env_group.github_production.id
  service_ids  = [render_web_service.api.id, render_web_service.worker.id, render_web_service.worker_high_priority.id, render_web_service.worker_medium_priority.id]
}

resource "render_env_group_link" "backend_production" {
  env_group_id = render_env_group.backend_production.id
  service_ids  = [render_web_service.api.id, render_web_service.worker.id, render_web_service.worker_high_priority.id, render_web_service.worker_medium_priority.id]
}

resource "render_env_group_link" "stripe_production" {
  env_group_id = render_env_group.stripe_production.id
  service_ids  = [render_web_service.api.id, render_web_service.worker.id, render_web_service.worker_high_priority.id, render_web_service.worker_medium_priority.id]
}

resource "render_env_group_link" "logfire_server" {
  env_group_id = render_env_group.logfire_server.id
  service_ids  = [render_web_service.api.id]
}

resource "render_env_group_link" "logfire_worker" {
  env_group_id = render_env_group.logfire_worker.id
  service_ids  = [render_web_service.worker.id, render_web_service.worker_high_priority.id, render_web_service.worker_medium_priority.id]
}

resource "render_env_group_link" "openai_production" {
  env_group_id = render_env_group.openai_production.id
  service_ids  = [render_web_service.api.id, render_web_service.worker.id, render_web_service.worker_high_priority.id, render_web_service.worker_medium_priority.id]
}

resource "render_env_group_link" "apple_production" {
  env_group_id = render_env_group.apple_production.id
  service_ids  = [render_web_service.api.id]
}

# =============================================================================
# Environment Group Links - Sandbox
# =============================================================================

resource "render_env_group_link" "aws_s3_sandbox" {
  env_group_id = render_env_group.aws_s3_sandbox.id
  service_ids  = [render_web_service.api_sandbox.id, render_web_service.worker_sandbox.id]
}

resource "render_env_group_link" "google_sandbox" {
  env_group_id = render_env_group.google_sandbox.id
  service_ids  = [render_web_service.api_sandbox.id, render_web_service.worker_sandbox.id]
}

resource "render_env_group_link" "github_sandbox" {
  env_group_id = render_env_group.github_sandbox.id
  service_ids  = [render_web_service.api_sandbox.id, render_web_service.worker_sandbox.id]
}

resource "render_env_group_link" "backend_sandbox" {
  env_group_id = render_env_group.backend_sandbox.id
  service_ids  = [render_web_service.api_sandbox.id, render_web_service.worker_sandbox.id]
}

resource "render_env_group_link" "stripe_sandbox" {
  env_group_id = render_env_group.stripe_sandbox.id
  service_ids  = [render_web_service.api_sandbox.id, render_web_service.worker_sandbox.id]
}

resource "render_env_group_link" "openai_sandbox" {
  env_group_id = render_env_group.openai_sandbox.id
  service_ids  = [render_web_service.api_sandbox.id, render_web_service.worker_sandbox.id]
}

resource "render_env_group_link" "apple_sandbox" {
  env_group_id = render_env_group.apple_sandbox.id
  service_ids  = [render_web_service.api_sandbox.id]
}
