
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
# Sandbox Redis Instance
# =============================================================================

resource "render_redis" "redis_sandbox" {
  environment_id    = data.tfe_outputs.production.values.sandbox_environment_id
  name              = "redis-sandbox"
  plan              = "standard"
  region            = "ohio"
  max_memory_policy = "noeviction"

  # Empty IP allow list means only private network connections
  ip_allow_list = []

  depends_on = [render_registry_credential.ghcr]
}

# =============================================================================
# Locals
# =============================================================================

locals {
  # Database connection info (derived from postgres resource)
  # db_host          = render_postgres.db.id
  db_internal_host = data.render_postgres.db.id
  db_external_host = nonsensitive(regex("@([^/:]+)", data.render_postgres.db.connection_info.external_connection_string)[0])
  db_port          = "5432"
  # db_name          = data.render_postgres.db.database_name
  db_user     = data.render_postgres.db.database_user
  db_password = data.render_postgres.db.connection_info.password

  # Read replica connection info
  read_replica = [for r in data.render_postgres.db.read_replicas : r if r.name == "polar-read"][0]

  # Redis connection info
  redis_host = render_redis.redis_sandbox.id
  redis_port = "6379"

  # Production Redis connection info - for the drain worker
  production_redis_host = data.render_redis.redis.id
  production_redis_port = "6379"
}

# =============================================================================
# Sandbox
# =============================================================================

import {
  to = module.sandbox.cloudflare_dns_record.resend_dkim
  id = "22bcd1b07ec25452aab472486bc8df94/18ef1ec6c3bae11c97624278b1dc0436"
}

import {
  to = module.sandbox.cloudflare_dns_record.resend_spf_mx
  id = "22bcd1b07ec25452aab472486bc8df94/d63d2cb0fe67c06b91baec8ed9f9546b"
}

import {
  to = module.sandbox.cloudflare_dns_record.resend_spf_txt
  id = "22bcd1b07ec25452aab472486bc8df94/eb6326cb55c1a417eacc2f984c9ecf88"
}

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

  resend_domain = {
    zone_id         = "22bcd1b07ec25452aab472486bc8df94"
    dkim_public_key = "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCx8TPulpiuGKqifNLwJchDkpDbZK0R25boNFoztUf8nNT+4h3jzZL6pE3sJ2oSbqOZ4Jfr+4R7E9uXsmSQf5WJcXJOLjVhd8HJOQIdjn9WtJGxzplXs5f1iWFBBsTK7jOkDPVnWOovYBDa2fRypKGdHsSvi0kDZ5sV89/y/1QZlQIDAQAB"
    spf_policy      = "\"v=spf1 include:amazonses.com -all\""
  }

  api_service_config = {
    allowed_hosts          = "[\"sandbox.polar.sh\"]"
    cors_origins           = "[\"https://sandbox.polar.sh\", \"https://github.com\", \"https://docs.polar.sh\"]"
    custom_domains         = [{ name = "sandbox-api.polar.sh" }]
    web_concurrency        = "2"
    forwarded_allow_ips    = "*"
    database_pool_size     = "10"
    postgres_database      = "polar_sandbox"
    postgres_read_database = "polar_sandbox"
    redis_db               = "1"
    plan                   = "pro"
  }

  workers = {
    worker-sandbox = {
      start_command      = "uv run dramatiq polar.worker.run -p 4 -t 8 -f polar.worker.scheduler:start --queues high_priority medium_priority low_priority"
      dramatiq_prom_port = "10000"
    }
    worker-sandbox-webhook = {
      start_command      = "uv run dramatiq polar.worker.run -p 1 -t 16 --queues webhooks"
      dramatiq_prom_port = "10001"
      database_pool_size = "16"
    }
    worker-sandbox-tinybird = {
      start_command      = "uv run dramatiq polar.worker.run_without_db -p 1 -t 16 --queues tinybird"
      dramatiq_prom_port = "10002"
    }
    worker-sandbox-invoices-receipts = {
      start_command      = "uv run dramatiq polar.worker.run -p 1 -t 3 --queues invoices_and_receipts"
      plan               = "standard"
      dramatiq_prom_port = "10003"
    }

    # Temporary drain worker - listens to ALL queues on production Redis
    # This allows draining in-flight tasks from the current shared Redis
    worker-sandbox-drain = {
      start_command      = "uv run dramatiq polar.worker.run -p 2 -t 4 --queues high_priority medium_priority low_priority webhooks tinybird invoices_and_receipts"
      dramatiq_prom_port = "10004"
      plan               = "standard"
      redis_host         = local.production_redis_host
      redis_port         = local.production_redis_port
      redis_db           = "1"
    }
  }

  google_secrets = {
    client_id     = var.google_client_id_sandbox
    client_secret = var.google_client_secret_sandbox
  }

  openai_secrets = {
    api_key = var.openai_api_key_sandbox
  }

  pydantic_ai_gateway_secrets = {
    api_key = var.pydantic_ai_gateway_api_key_sandbox
  }

  backend_config = {
    base_url                             = "https://sandbox-api.polar.sh"
    user_session_cookie_domain           = "polar.sh"
    user_session_cookie_key              = "polar_sandbox_session"
    authentication_session_cookie_domain = "polar.sh"
    oauth2_session_state_cookie_domain   = "polar.sh"
    debug                                = "0"
    email_sender                         = "resend"
    email_from_name                      = "[SANDBOX] Polar"
    email_from_domain                    = "notifications.sandbox.polar.sh"
    frontend_base_url                    = "https://sandbox.polar.sh"
    checkout_base_url                    = "https://sandbox-api.polar.sh/v1/checkout-links/{client_secret}/redirect"
    jwks_path                            = "/etc/secrets/jwks.json"
    log_level                            = "INFO"
    testing                              = "0"
    auth_cookie_domain                   = "polar.sh"
    auth_cookie_key                      = "polar_sandbox_session"
    tax_processors                       = "[\"numeral\",\"stripe\"]"
    tax_record_processor                 = "numeral"
    customer_portal_url_overrides        = var.customer_portal_url_overrides
    plain_default_tier_external_id       = var.plain_default_tier_external_id
  }

  backend_secrets = {
    stripe_publishable_key   = var.stripe_publishable_key_sandbox
    current_jwk_kid          = var.backend_current_jwk_kid_sandbox
    discord_bot_token        = var.backend_discord_bot_token_sandbox
    discord_client_id        = var.backend_discord_client_id_sandbox
    discord_client_secret    = var.backend_discord_client_secret_sandbox
    discord_proxy_url        = var.backend_discord_proxy_url
    resend_api_key           = var.backend_resend_api_key_sandbox
    resend_webhook_secret    = var.backend_resend_webhook_secret
    firecrawl_api_key        = var.firecrawl_api_key
    logo_dev_publishable_key = var.backend_logo_dev_publishable_key_sandbox
    secret                   = var.backend_secret_sandbox
    sentry_dsn               = var.backend_sentry_dsn_sandbox
    jwks                     = var.backend_jwks_sandbox
    numeral_api_key          = var.numeral_api_key_sandbox
  }

  aws_s3_config = {
    region                        = "us-east-2"
    signature_version             = "v4"
    files_presign_ttl             = "3600"
    files_public_bucket_name      = "polar-public-sandbox-files"
    customer_invoices_bucket_name = "polar-sandbox-customer-invoices"
    customer_receipts_bucket_name = "polar-sandbox-customer-receipts"
    payout_invoices_bucket_name   = "polar-sandbox-payout-invoices"
    logs_bucket_name              = "polar-sandbox-logs"
  }

  aws_s3_secrets = {
    access_key_id         = var.aws_access_key_id_sandbox
    secret_access_key     = var.aws_secret_access_key_sandbox
    files_download_salt   = var.s3_files_download_salt_sandbox
    files_download_secret = var.s3_files_download_secret_sandbox
  }

  aws_kms_config = {
    key_id   = module.secrets_kms.key_arn
    role_arn = module.secrets_kms.role_arn
  }

  worker_sqs_config = {
    enabled               = "true"
    actors                = var.worker_sqs_actors
    queue_prefix          = "polar-sandbox-tasks"
    aws_access_key_id     = aws_iam_access_key.tasks_producer.id
    aws_secret_access_key = aws_iam_access_key.tasks_producer.secret
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
    token = var.logfire_token
  }

  prometheus_config = {
    url      = var.grafana_cloud_prometheus_url
    username = var.grafana_cloud_prometheus_username
    password = var.grafana_cloud_prometheus_password
  }

  memory_profile_config = {
    s3_bucket_name = "polar-sandbox-logs"
  }

  polar_self_config = {
    access_token     = var.polar_access_token
    webhook_secret   = var.polar_webhook_secret
    organization_id  = var.polar_organization_id
    free_product_id  = var.polar_free_product_id
    scale_product_id = var.polar_scale_product_id
    api_url          = "https://sandbox-api.polar.sh"
  }

  tinybird_config = {
    api_url             = "https://api.us-east.aws.tinybird.co"
    clickhouse_url      = "https://clickhouse.us-east.aws.tinybird.co"
    api_token           = var.tinybird_api_token
    read_token          = var.tinybird_read_token
    clickhouse_username = var.tinybird_clickhouse_username
    clickhouse_token    = var.tinybird_clickhouse_token
    workspace           = var.tinybird_workspace
  }

  depends_on = [render_registry_credential.ghcr, data.render_postgres.db, data.render_redis.redis, render_redis.redis_sandbox]
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
  proxied = true
  ttl     = 1
}
