
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
  # db_host          = render_postgres.db.id
  db_internal_host = render_postgres.db.id
  db_port          = "5432"
  # db_name          = render_postgres.db.database_name
  db_user     = render_postgres.db.database_user
  db_password = render_postgres.db.connection_info.password

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
    },
    "Test" : {
      name             = "Test"
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

  lifecycle {
    ignore_changes = [
      ip_allow_list,
    ]
  }
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
# Production
# =============================================================================

module "production" {
  source = "../modules/render_service"

  environment            = "production"
  render_environment_id  = render_project.polar.environments["Production"].id
  registry_credential_id = render_registry_credential.ghcr.id

  api_service_config = {
    allowed_hosts = "[\"polar.sh\", \"backoffice.polar.sh\"]"
    cors_origins  = "[\"https://polar.sh\", \"https://github.com\", \"https://docs.polar.sh\"]"
  }

  postgres_config = {
    host          = local.db_internal_host
    port          = local.db_port
    user          = local.db_user
    password      = local.db_password
    read_host     = local.read_replica.id
    read_port     = local.db_port
    read_user     = local.db_user
    read_password = local.db_password
  }

  redis_config = {
    host = local.redis_host
    port = local.redis_port
  }

  workers = {
    "worker" = {
      start_command      = "uv run dramatiq polar.worker.run -p 2 -t 8 --queues low_priority"
      tag                = "latest"
      custom_domains     = [{ name = "worker.polar.sh" }]
      dramatiq_prom_port = "10000"
    }
    "worker-medium-priority" = {
      start_command      = "uv run dramatiq polar.worker.run -p 2 -t 8 --queues default medium_priority"
      tag                = "latest"
      dramatiq_prom_port = "10001"
    }
    "worker-high-priority" = {
      start_command      = "uv run dramatiq polar.worker.run -p 2 -t 8 --queues high_priority -f polar.worker.scheduler:start"
      tag                = "latest"
      dramatiq_prom_port = "10001"
    }
    "worker-default" = {
      start_command      = "uv run dramatiq polar.worker.run -p 2 -t 8 --queues default"
      digest             = "sha256:d55ecc35d8a51bcf7dde0d4d865c96b9de8d2c3469b12d1a719fef2ae39a4825"
      dramatiq_prom_port = "10001"
    }
  }

  google_secrets = {
    client_id     = var.google_client_id_production
    client_secret = var.google_client_secret_production
  }

  openai_secrets = {
    api_key = var.openai_api_key_production
  }

  backend_config = {
    base_url                             = "https://api.polar.sh"
    backoffice_host                      = "backoffice.polar.sh"
    user_session_cookie_domain           = "polar.sh"
    debug                                = "0"
    email_sender                         = "resend"
    email_from_name                      = "Polar"
    email_from_domain                    = "notifications.polar.sh"
    frontend_base_url                    = "https://polar.sh"
    checkout_base_url                    = "https://buy.polar.sh/{client_secret}"
    jwks_path                            = "/etc/secrets/jwks.json"
    log_level                            = "INFO"
    testing                              = "0"
    organizations_billing_engine_default = "1"
    auth_cookie_domain                   = "polar.sh"
    invoices_additional_info             = "[support@polar.sh](mailto:support@polar.sh)\nVAT: EU372061545"
  }

  backend_secrets = {
    stripe_publishable_key       = var.stripe_publishable_key_production
    current_jwk_kid              = var.backend_current_jwk_kid_production
    discord_bot_token            = var.backend_discord_bot_token_production
    discord_client_id            = var.backend_discord_client_id_production
    discord_client_secret        = var.backend_discord_client_secret_production
    discord_webhook_url          = var.backend_discord_webhook_url_production
    loops_api_key                = var.backend_loops_api_key_production
    posthog_project_api_key      = var.backend_posthog_project_api_key_production
    resend_api_key               = var.backend_resend_api_key_production
    secret                       = var.backend_secret_production
    sentry_dsn                   = var.backend_sentry_dsn_production
    plain_request_signing_secret = var.backend_plain_request_signing_secret_production
    plain_token                  = var.backend_plain_token_production
    plain_chat_secret            = var.backend_plain_chat_secret_production
    jwks                         = var.backend_jwks_production
    app_review_email             = var.backend_app_review_email
    app_review_otp_code          = var.backend_app_review_otp_code
  }

  aws_s3_config = {
    region                        = "us-east-2"
    signature_version             = "v4"
    files_presign_ttl             = "600"
    files_public_bucket_name      = "polar-public-files"
    customer_invoices_bucket_name = "polar-customer-invoices"
    payout_invoices_bucket_name   = "polar-payout-invoices"
  }

  aws_s3_secrets = {
    access_key_id         = var.aws_access_key_id_production
    secret_access_key     = var.aws_secret_access_key_production
    files_download_salt   = var.s3_files_download_salt_production
    files_download_secret = var.s3_files_download_secret_production
  }

  github_secrets = {
    client_id                           = var.github_client_id_production
    client_secret                       = var.github_client_secret_production
    repository_benefits_app_identifier  = var.github_repository_benefits_app_identifier_production
    repository_benefits_app_namespace   = var.github_repository_benefits_app_namespace_production
    repository_benefits_app_private_key = var.github_repository_benefits_app_private_key_production
    repository_benefits_client_id       = var.github_repository_benefits_client_id_production
    repository_benefits_client_secret   = var.github_repository_benefits_client_secret_production
  }

  stripe_secrets = {
    connect_webhook_secret = var.stripe_connect_webhook_secret_production
    secret_key             = var.stripe_secret_key_production
    webhook_secret         = var.stripe_webhook_secret_production
  }

  logfire_config = {
    server_project_name = "production"
    worker_project_name = "production-worker"
    server_token        = var.logfire_token_server
    worker_token        = var.logfire_token_worker
  }

  apple_secrets = {
    client_id = var.apple_client_id
    team_id   = var.apple_team_id
    key_id    = var.apple_key_id
    key_value = var.apple_key_value
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
