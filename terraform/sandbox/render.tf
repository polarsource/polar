
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
  redis_host = var.redis_private_link_host
  redis_port = "6379"

  # Forwarded allow IPs: Cloudflare ranges + Render proxy
  render_proxy_cidr   = "10.0.0.0/8"
  forwarded_allow_ips = "${module.cloudflare_ips.all_ranges},${local.render_proxy_cidr}"
}

# =============================================================================
# Cloudflare IP Ranges
# =============================================================================

module "cloudflare_ips" {
  source = "../modules/cloudflare_ips"
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
    host               = module.pgbouncer.host
    port               = module.pgbouncer.port
    user               = local.db_user
    password           = local.db_password
    host_fallback      = local.db_internal_host
    port_fallback      = local.db_port
    read_host          = module.pgbouncer_read.host
    read_port          = module.pgbouncer_read.port
    read_user          = local.db_user
    read_password      = local.db_password
    read_host_fallback = local.read_replica.id
    read_port_fallback = local.db_port
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
    forwarded_allow_ips    = local.forwarded_allow_ips
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
    worker-sandbox-drain = {
      start_command = "uv run dramatiq polar.worker.run -p 2 -t 8"
      redis_host    = render_redis.redis_sandbox.id
      redis_port    = "6379"
      redis_db      = "1"
    }
    worker-sandbox-invoices-receipts = {
      start_command      = "uv run dramatiq polar.worker.run -p 1 -t 3 --queues invoices_and_receipts"
      plan               = "standard"
      dramatiq_prom_port = "10003"
    }
  }

  environment_groups = module.backend_environment.environment_groups
  backend_jwks       = local.backend_secrets.jwks
  email_from_domain  = local.backend_config.email_from_domain

  memory_profile_config = {
    s3_bucket_name = "polar-sandbox-logs"
  }

  depends_on = [render_registry_credential.ghcr, data.render_postgres.db, data.render_redis.redis, render_redis.redis_sandbox]
}

# =============================================================================
# PgBouncer
# =============================================================================

module "pgbouncer" {
  source = "../modules/pgbouncer"

  environment            = "sandbox"
  render_environment_id  = data.tfe_outputs.production.values.sandbox_environment_id
  registry_credential_id = render_registry_credential.ghcr.id

  database = {
    host     = local.db_internal_host
    port     = local.db_port
    user     = local.db_user
    password = local.db_password
  }

  pool_config = {
    max_client_conn   = "1000"
    default_pool_size = "20"
  }

  depends_on = [render_registry_credential.ghcr, data.render_postgres.db]
}

module "pgbouncer_read" {
  source = "../modules/pgbouncer"

  name                   = "pgbouncer-read"
  environment            = "sandbox"
  render_environment_id  = data.tfe_outputs.production.values.sandbox_environment_id
  registry_credential_id = render_registry_credential.ghcr.id

  database = {
    host     = local.read_replica.id
    port     = local.db_port
    user     = local.db_user
    password = local.db_password
  }

  pool_config = {
    max_client_conn   = "1000"
    default_pool_size = "20"
  }

  depends_on = [render_registry_credential.ghcr, data.render_postgres.db]
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
