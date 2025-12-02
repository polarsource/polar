
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
# Remote references that are managed by a different state.
# ============================================================================

data "tfe_outputs" "production" {
  organization = "polar-sh"
  workspace    = "polar"
}

data "render_postgres" "db" {
  id = data.tfe_outputs.production.values.postgres_id
}

data "render_redis" "redis" {
  id = data.tfe_outputs.production.values.redis_id
}

# =============================================================================
# Locals
# =============================================================================

locals {
  # Database connection info (derived from postgres resource)
  # db_host          = render_postgres.db.id
  db_internal_host = data.render_postgres.db.id
  db_port          = "5432"
  # db_name          = data.render_postgres.db.database_name
  db_user     = data.render_postgres.db.database_user
  db_password = data.render_postgres.db.connection_info.password

  # Read replica connection info
  read_replica = [for r in data.render_postgres.db.read_replicas : r if r.name == "polar-read"][0]

  # Redis connection info
  redis_host = data.render_redis.redis.id
  redis_port = "6379"
}



# =============================================================================
# Environment Variable Groups - Sandbox
# =============================================================================

resource "render_env_group" "google_sandbox" {
  environment_id = data.tfe_outputs.production.values.sandbox_environment_id
  name           = "google-sandbox"
  env_vars = {
    POLAR_GOOGLE_CLIENT_ID     = { value = var.google_client_id_sandbox }
    POLAR_GOOGLE_CLIENT_SECRET = { value = var.google_client_secret_sandbox }
  }
}

resource "render_env_group" "openai_sandbox" {
  environment_id = data.tfe_outputs.production.values.sandbox_environment_id
  name           = "openai-sandbox"
  env_vars = {
    POLAR_OPENAI_API_KEY = { value = var.openai_api_key_sandbox }
  }
}

resource "render_env_group" "backend_sandbox" {
  environment_id = data.tfe_outputs.production.values.sandbox_environment_id
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
  environment_id = data.tfe_outputs.production.values.sandbox_environment_id
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
  environment_id = data.tfe_outputs.production.values.sandbox_environment_id
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
  environment_id = data.tfe_outputs.production.values.sandbox_environment_id
  name           = "stripe-sandbox"
  env_vars = {
    POLAR_STRIPE_CONNECT_WEBHOOK_SECRET = { value = var.stripe_connect_webhook_secret_sandbox }
    POLAR_STRIPE_SECRET_KEY             = { value = var.stripe_secret_key_sandbox }
    POLAR_STRIPE_WEBHOOK_SECRET         = { value = var.stripe_webhook_secret_sandbox }
  }
}

resource "render_env_group" "apple_sandbox" {
  environment_id = data.tfe_outputs.production.values.sandbox_environment_id
  name           = "apple-sandbox"
  env_vars = {
    POLAR_APPLE_CLIENT_ID = { value = var.apple_client_id }
    POLAR_APPLE_TEAM_ID   = { value = var.apple_team_id }
    POLAR_APPLE_KEY_ID    = { value = var.apple_key_id }
    POLAR_APPLE_KEY_VALUE = { value = var.apple_key_value }
  }
}

# =============================================================================
# Web Services - Sandbox
# =============================================================================

resource "render_web_service" "api_sandbox" {
  environment_id     = data.tfe_outputs.production.values.sandbox_environment_id
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

  lifecycle {
    ignore_changes = [
      runtime_source.image.digest,
      runtime_source.image.tag,
    ]
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
  environment_id    = data.tfe_outputs.production.values.sandbox_environment_id
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

  lifecycle {
    ignore_changes = [
      runtime_source.image.digest,
      runtime_source.image.tag,
    ]
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
