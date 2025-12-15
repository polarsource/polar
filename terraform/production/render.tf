
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

  depends_on = [render_registry_credential.ghcr]
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

  depends_on = [render_registry_credential.ghcr, render_project.polar]
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

  depends_on = [render_registry_credential.ghcr, render_project.polar]
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
    allowed_hosts  = "[\"polar.sh\", \"backoffice.polar.sh\"]"
    cors_origins   = "[\"https://polar.sh\", \"https://github.com\", \"https://docs.polar.sh\"]"
    custom_domains = [{ name = "api.polar.sh" }, { name = "backoffice.polar.sh" }]
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
    "scheduler" = {
      start_command      = "uv run python -m polar.worker.scheduler"
      plan               = "starter"
      tag                = "latest"
      dramatiq_prom_port = "10000"
    }
    "worker" = {
      start_command      = "uv run dramatiq polar.worker.run -p 2 -t 4 --queues low_priority"
      tag                = "latest"
      custom_domains     = [{ name = "worker.polar.sh" }]
      dramatiq_prom_port = "10000"
    }
    "worker-medium-priority" = {
      start_command      = "uv run dramatiq polar.worker.run -p 2 -t 4 --queues default medium_priority"
      tag                = "latest"
      dramatiq_prom_port = "10001"
    }
    "worker-high-priority" = {
      start_command      = "uv run dramatiq polar.worker.run -p 2 -t 4 --queues high_priority"
      tag                = "latest"
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
    stripe_publishable_key         = var.stripe_publishable_key_production
    current_jwk_kid                = var.backend_current_jwk_kid_production
    discord_bot_token              = var.backend_discord_bot_token_production
    discord_client_id              = var.backend_discord_client_id_production
    discord_client_secret          = var.backend_discord_client_secret_production
    discord_webhook_url            = var.backend_discord_webhook_url_production
    loops_api_key                  = var.backend_loops_api_key_production
    posthog_project_api_key        = var.backend_posthog_project_api_key_production
    resend_api_key                 = var.backend_resend_api_key_production
    logo_dev_publishable_key       = var.backend_logo_dev_publishable_key_production
    secret                         = var.backend_secret_production
    sentry_dsn                     = var.backend_sentry_dsn_production
    plain_request_signing_secret   = var.backend_plain_request_signing_secret_production
    plain_token                    = var.backend_plain_token_production
    plain_chat_secret              = var.backend_plain_chat_secret_production
    jwks                           = var.backend_jwks_production
    app_review_email               = var.backend_app_review_email
    app_review_otp_code            = var.backend_app_review_otp_code
    chargeback_stop_webhook_secret = var.backend_chargebackstop_webhook_secret_production
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

  prometheus_config = {
    url      = var.prometheus_remote_write_url
    username = var.prometheus_remote_write_username
    password = var.prometheus_remote_write_password
    interval = var.prometheus_remote_write_interval
  }


  depends_on = [render_registry_credential.ghcr, render_project.polar, render_postgres.db, render_redis.redis]
}

# =============================================================================
# Cloudflare DNS
# =============================================================================

import {
  to = cloudflare_dns_record.api
  id = "22bcd1b07ec25452aab472486bc8df94/4207c475d8046532273c9ebec88fb55e"
}

import {
  to = cloudflare_dns_record.backoffice
  id = "22bcd1b07ec25452aab472486bc8df94/26980a2206bce3385e7567ce64174c37"
}

import {
  to = cloudflare_dns_record.worker
  id = "22bcd1b07ec25452aab472486bc8df94/52370ab4a0fbc82b3dd10bdd340682d7"
}

resource "cloudflare_dns_record" "api" {
  zone_id = "22bcd1b07ec25452aab472486bc8df94"
  name    = "api.polar.sh"
  type    = "CNAME"
  content = replace(module.production.api_service_url, "https://", "")
  proxied = false
  ttl     = 1
}

resource "cloudflare_dns_record" "backoffice" {
  zone_id = "22bcd1b07ec25452aab472486bc8df94"
  name    = "backoffice.polar.sh"
  type    = "CNAME"
  content = replace(module.production.api_service_url, "https://", "")
  proxied = false
  ttl     = 1
}

resource "cloudflare_dns_record" "worker" {
  zone_id = "22bcd1b07ec25452aab472486bc8df94"
  name    = "worker.polar.sh"
  type    = "CNAME"
  content = replace(module.production.worker_urls["worker"], "https://", "")
  proxied = true
  ttl     = 1
}
