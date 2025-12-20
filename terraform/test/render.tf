
# =============================================================================
# Registry Credential
# =============================================================================

import {
  to = render_registry_credential.ghcr
  id = "rgc-d4jjclili9vc738h3eu0"
}

resource "render_registry_credential" "ghcr" {
  name       = "Registry Credentials for GHCR"
  registry   = "GITHUB"
  username   = var.ghcr_username
  auth_token = var.ghcr_auth_token
}

# =============================================================================
# Locals
# =============================================================================

data "tfe_outputs" "production" {
  organization = "polar-sh"
  workspace    = "polar"
}

locals {
  environment_id = data.tfe_outputs.production.values.test_environment_id
}

# =============================================================================
# PostgreSQL Database
# =============================================================================

resource "render_postgres" "db" {
  environment_id = local.environment_id
  name           = "db-test"
  database_name  = "polar_cpit"
  database_user  = "polar_cpit_user"
  plan           = "pro_16gb"
  region         = "ohio"
  version        = "15"
  disk_size_gb   = 100

  high_availability_enabled = true

  read_replicas = [
    { name = "polar-read-test" },
  ]

  lifecycle {
    ignore_changes = [
      ip_allow_list,
    ]
  }

  depends_on = [render_registry_credential.ghcr]
}

resource "render_redis" "redis" {
  environment_id    = local.environment_id
  name              = "redis-test"
  plan              = "standard"
  region            = "ohio"
  max_memory_policy = "noeviction"

  # Empty IP allow list means only private network connections
  ip_allow_list = []

  depends_on = [render_registry_credential.ghcr]
}

# =============================================================================
# Test
# =============================================================================
locals {
  # Database connection info (derived from postgres resource)
  db_internal_host = render_postgres.db.id
  db_port          = "5432"
  db_user          = render_postgres.db.database_user
  db_password      = render_postgres.db.connection_info.password

  # Extract actual database name from internal connection string
  # Render appends a suffix to database_name, so we parse it from the connection string
  # Format: postgresql://user:pass@host/dbname
  db_name = regex("[^/]+$", render_postgres.db.connection_info.internal_connection_string)

  # Read replica connection info
  read_replica = [for r in render_postgres.db.read_replicas : r if r.name == "polar-read-test"][0]

  # Redis connection info
  redis_host = render_redis.redis.id
  redis_port = "6379"
}

module "test" {
  source = "../modules/render_service"

  environment            = "test"
  render_environment_id  = local.environment_id
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
    allowed_hosts          = "[\"test.polar.sh\"]"
    cors_origins           = "[\"https://test.polar.sh\", \"https://github.com\", \"https://docs.polar.sh\"]"
    custom_domains         = [{ name = "test-api.polar.sh" }]
    web_concurrency        = "2"
    forwarded_allow_ips    = "*"
    database_pool_size     = "20"
    postgres_database      = local.db_name
    postgres_read_database = local.db_name
    redis_db               = "0"
  }

  workers = {
    worker-test = {
      start_command      = "uv run dramatiq -p 2 -t 4 -f polar.worker.scheduler:start polar.worker.run"
      tag                = "latest"
      dramatiq_prom_port = "10000"
    }
  }

  google_secrets = {
    client_id     = var.google_client_id
    client_secret = var.google_client_secret
  }

  openai_secrets = {
    api_key = var.openai_api_key
  }

  backend_config = {
    environment                          = "test"
    base_url                             = "https://test-api.polar.sh"
    user_session_cookie_domain           = "polar.sh"
    user_session_cookie_key              = "polar_test_session"
    debug                                = "0"
    email_sender                         = "logger"
    email_from_name                      = "[TEST] Polar"
    email_from_domain                    = "notifications.test.polar.sh"
    frontend_base_url                    = "https://test.polar.sh"
    checkout_base_url                    = "https://test-api.polar.sh/v1/checkout-links/{client_secret}/redirect"
    jwks_path                            = "/etc/secrets/jwks.json"
    log_level                            = "INFO"
    testing                              = "0"
    organizations_billing_engine_default = "1"
    auth_cookie_domain                   = "test.polar.sh"
    invoices_additional_info             = "[support@polar.sh](mailto:support@polar.sh)\nVAT: EU372061545"
  }

  backend_secrets = {
    stripe_publishable_key   = var.stripe_publishable_key
    current_jwk_kid          = var.backend_current_jwk_kid
    discord_bot_token        = var.backend_discord_bot_token
    discord_client_id        = var.backend_discord_client_id
    discord_client_secret    = var.backend_discord_client_secret
    resend_api_key           = var.backend_resend_api_key
    logo_dev_publishable_key = var.backend_logo_dev_publishable_key
    secret                   = var.backend_secret
    sentry_dsn               = var.backend_sentry_dsn
    jwks                     = var.backend_jwks
  }

  aws_s3_config = {
    region                        = "us-east-2"
    signature_version             = "v4"
    files_presign_ttl             = "600"
    files_public_bucket_name      = "polar-public-files"
    customer_invoices_bucket_name = "polar-test-customer-invoices"
    payout_invoices_bucket_name   = "polar-test-payout-invoices"
  }

  aws_s3_secrets = {
    access_key_id         = var.aws_access_key_id
    secret_access_key     = var.aws_secret_access_key
    files_download_salt   = var.s3_files_download_salt
    files_download_secret = var.s3_files_download_secret
  }

  github_secrets = {
    client_id                           = var.github_client_id
    client_secret                       = var.github_client_secret
    repository_benefits_app_identifier  = var.github_repository_benefits_app_identifier
    repository_benefits_app_namespace   = var.github_repository_benefits_app_namespace
    repository_benefits_app_private_key = var.github_repository_benefits_app_private_key
    repository_benefits_client_id       = var.github_repository_benefits_client_id
    repository_benefits_client_secret   = var.github_repository_benefits_client_secret
  }

  stripe_secrets = {
    connect_webhook_secret = var.stripe_connect_webhook_secret
    secret_key             = var.stripe_secret_key
    webhook_secret         = var.stripe_webhook_secret
  }

  logfire_config = {
    server_project_name = "test"
    worker_project_name = "test-worker"
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

  depends_on = [render_registry_credential.ghcr, render_postgres.db, render_redis.redis]
}

# =============================================================================
# Cloudflare DNS
# =============================================================================

resource "cloudflare_dns_record" "test_api" {
  zone_id = "22bcd1b07ec25452aab472486bc8df94"
  name    = "test-api.polar.sh"
  type    = "CNAME"
  content = replace(module.test.api_service_url, "https://", "")
  proxied = false
  ttl     = 1
}
