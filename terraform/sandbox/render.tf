
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
# Sandbox
# =============================================================================

module "sandbox" {
  source = "../modules/render_service"

  environment            = "sandbox"
  render_environment_id  = data.tfe_outputs.production.values.sandbox_environment_id
  registry_credential_id = render_registry_credential.ghcr.id

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

  api_service_config = {
    allowed_hosts          = "[\"sandbox.polar.sh\"]"
    cors_origins           = "[\"https://sandbox.polar.sh\", \"https://github.com\", \"https://docs.polar.sh\"]"
    custom_domains         = [{ name = "sandbox-api.polar.sh" }]
    web_concurrency        = "2"
    forwarded_allow_ips    = "*"
    database_pool_size     = "20"
    postgres_database      = "polar_sandbox"
    postgres_read_database = "polar_sandbox"
    redis_db               = "1"
  }

  workers = {
    worker-sandbox = {
      start_command      = "uv run dramatiq -p 4 -t 8 -f polar.worker.scheduler:start polar.worker.run"
      tag                = "latest"
      dramatiq_prom_port = "10000"
    }
  }

  google_secrets = {
    client_id     = var.google_client_id_sandbox
    client_secret = var.google_client_secret_sandbox
  }

  openai_secrets = {
    api_key = var.openai_api_key_sandbox
  }

  backend_config = {
    base_url                             = "https://sandbox-api.polar.sh"
    user_session_cookie_domain           = "polar.sh"
    user_session_cookie_key              = "polar_sandbox_session"
    debug                                = "0"
    email_sender                         = "resend"
    email_from_name                      = "[SANDBOX] Polar"
    email_from_domain                    = "notifications.sandbox.polar.sh"
    frontend_base_url                    = "https://sandbox.polar.sh"
    checkout_base_url                    = "https://sandbox-api.polar.sh/v1/checkout-links/{client_secret}/redirect"
    jwks_path                            = "/etc/secrets/jwks.json"
    log_level                            = "INFO"
    testing                              = "0"
    organizations_billing_engine_default = "1"
    auth_cookie_domain                   = "polar.sh"
    auth_cookie_key                      = "polar_sandbox_session"
    invoices_additional_info             = ""
  }

  backend_secrets = {
    stripe_publishable_key   = var.stripe_publishable_key_sandbox
    current_jwk_kid          = var.backend_current_jwk_kid_sandbox
    discord_bot_token        = var.backend_discord_bot_token_sandbox
    discord_client_id        = var.backend_discord_client_id_sandbox
    discord_client_secret    = var.backend_discord_client_secret_sandbox
    resend_api_key           = var.backend_resend_api_key_sandbox
    logo_dev_publishable_key = var.backend_logo_dev_publishable_key_sandbox
    secret                   = var.backend_secret_sandbox
    sentry_dsn               = var.backend_sentry_dsn_sandbox
    jwks                     = var.backend_jwks_sandbox
  }

  aws_s3_config = {
    region                        = "us-east-2"
    signature_version             = "v4"
    files_presign_ttl             = "600"
    files_public_bucket_name      = "polar-public-sandbox-files"
    customer_invoices_bucket_name = "polar-sandbox-customer-invoices"
    payout_invoices_bucket_name   = "polar-sandbox-payout-invoices"
  }

  aws_s3_secrets = {
    access_key_id         = var.aws_access_key_id_sandbox
    secret_access_key     = var.aws_secret_access_key_sandbox
    files_download_salt   = var.s3_files_download_salt_sandbox
    files_download_secret = var.s3_files_download_secret_sandbox
  }

  github_secrets = {
    client_id                           = var.github_client_id_sandbox
    client_secret                       = var.github_client_secret_sandbox
    repository_benefits_app_identifier  = var.github_repository_benefits_app_identifier_sandbox
    repository_benefits_app_namespace   = var.github_repository_benefits_app_namespace_sandbox
    repository_benefits_app_private_key = var.github_repository_benefits_app_private_key_sandbox
    repository_benefits_client_id       = var.github_repository_benefits_client_id_sandbox
    repository_benefits_client_secret   = var.github_repository_benefits_client_secret_sandbox
  }

  stripe_secrets = {
    connect_webhook_secret = var.stripe_connect_webhook_secret_sandbox
    secret_key             = var.stripe_secret_key_sandbox
    webhook_secret         = var.stripe_webhook_secret_sandbox
  }

  apple_secrets = {
    client_id = var.apple_client_id
    team_id   = var.apple_team_id
    key_id    = var.apple_key_id
    key_value = var.apple_key_value
  }

  logfire_config = {
    server_project_name = "sandbox"
    worker_project_name = "sandbox-worker"
    server_token        = var.logfire_token_server
    worker_token        = var.logfire_token_worker
  }

  prometheus_config = {
    url      = var.prometheus_remote_write_url
    username = var.prometheus_remote_write_username
    password = var.prometheus_remote_write_password
    interval = var.prometheus_remote_write_interval
  }

  depends_on = [render_registry_credential.ghcr, data.render_postgres.db, data.render_redis.redis]
}

# =============================================================================
# Cloudflare DNS
# =============================================================================
import {
  to = cloudflare_dns_record.api
  id = "22bcd1b07ec25452aab472486bc8df94/f8b90a8fea314be71490f0b4805807cf"
}

resource "cloudflare_dns_record" "api" {
  zone_id = "22bcd1b07ec25452aab472486bc8df94"
  name    = "sandbox-api.polar.sh"
  type    = "CNAME"
  content = replace(module.sandbox.api_service_url, "https://", "")
  proxied = false
  ttl     = 1
}
