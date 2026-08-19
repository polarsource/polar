
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
  test_enabled   = true
}

# =============================================================================
# PostgreSQL Database
# =============================================================================

resource "render_postgres" "db" {
  environment_id = local.environment_id
  name           = "db-test"
  database_name  = "polar_cpit"
  plan           = "pro_4gb"
  region         = "ohio"
  version        = "15"
  disk_size_gb   = 100

  high_availability_enabled = true

  read_replicas = [
    { name = "polar-read-test" },
  ]

  lifecycle {
    prevent_destroy = true
    ignore_changes = [
      ip_allow_list,
      database_name,
    ]
  }

  depends_on = [render_registry_credential.ghcr]
}

resource "render_redis" "redis" {
  count             = local.test_enabled ? 1 : 0
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
# Cloudflare IP Ranges
# =============================================================================

module "cloudflare_ips" {
  source = "../modules/cloudflare_ips"
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

  db_external_host = nonsensitive(regex("@([^/:]+)", render_postgres.db.connection_info.external_connection_string)[0])

  # Extract actual database name from internal connection string
  # Render appends a suffix to database_name, so we parse it from the connection string
  # Format: postgresql://user:pass@host/dbname
  db_name = regex("[^/]+$", render_postgres.db.connection_info.internal_connection_string)

  # Read replica connection info
  read_replica = [for r in render_postgres.db.read_replicas : r if r.name == "polar-read-test"][0]

  # Redis connection info
  redis_host = local.test_enabled ? var.redis_private_link_host : ""
  redis_port = "6379"

  # Forwarded allow IPs: Cloudflare ranges + Render proxy
  render_proxy_cidr   = "10.0.0.0/8"
  forwarded_allow_ips = "${module.cloudflare_ips.all_ranges},${local.render_proxy_cidr}"
}

module "test" {
  count  = local.test_enabled ? 1 : 0
  source = "../modules/render_service"

  environment            = "test"
  render_environment_id  = local.environment_id
  registry_credential_id = render_registry_credential.ghcr.id

  postgres_config = {
    host               = module.pgbouncer[0].host
    port               = module.pgbouncer[0].port
    user               = local.db_user
    password           = local.db_password
    host_fallback      = local.db_internal_host
    port_fallback      = local.db_port
    read_host          = module.pgbouncer_read[0].host
    read_port          = module.pgbouncer_read[0].port
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
    dkim_public_key = "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCsvUiyJlml2c1COR9sPotdXJ9PS+IFyBaJurKwkPQzJwECB3reBiTr7L1TeDuz0FuFfs3fRrdXZwZumF1lmwbAp6Kx+5uua4Px3nRheoHJPtX2KXoY80TIRQhDTXHB/C1K/03m1HgvtlxWq37uUcJHSACSuUw+m+MBQEONqO12qQIDAQAB"
    spf_policy      = "\"v=spf1 include:amazonses.com ~all\""
  }

  api_service_config = {
    allowed_hosts          = "[\"test.polar.sh\"]"
    cors_origins           = "[\"https://test.polar.sh\", \"https://github.com\", \"https://docs.polar.sh\"]"
    custom_domains         = [{ name = "test-api.polar.sh" }]
    web_concurrency        = "2"
    forwarded_allow_ips    = local.forwarded_allow_ips
    database_pool_size     = "10"
    postgres_database      = local.db_name
    postgres_read_database = local.db_name
    redis_db               = "1"
    plan                   = "pro"
  }

  workers = {
    worker-test = {
      start_command      = "uv run dramatiq -p 2 -t 4 -f polar.worker.scheduler:start polar.worker.run"
      dramatiq_prom_port = "10000"
    }
  }

  environment_groups = module.backend_environment[0].environment_groups
  backend_jwks       = local.backend_secrets.jwks
  email_from_domain  = local.backend_config.email_from_domain

  depends_on = [render_registry_credential.ghcr, render_postgres.db, render_redis.redis]
}

# =============================================================================
# PgBouncer
# =============================================================================

module "pgbouncer" {
  count  = local.test_enabled ? 1 : 0
  source = "../modules/pgbouncer"

  environment            = "test"
  render_environment_id  = local.environment_id
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

  depends_on = [render_registry_credential.ghcr, render_postgres.db]
}

module "pgbouncer_read" {
  count  = local.test_enabled ? 1 : 0
  source = "../modules/pgbouncer"

  name                   = "pgbouncer-read"
  environment            = "test"
  render_environment_id  = local.environment_id
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

  depends_on = [render_registry_credential.ghcr, render_postgres.db]
}

# =============================================================================
# Cloudflare DNS
# =============================================================================

resource "cloudflare_dns_record" "test_api" {
  count   = local.test_enabled ? 1 : 0
  zone_id = "22bcd1b07ec25452aab472486bc8df94"
  name    = "test-api.polar.sh"
  type    = "CNAME"
  content = replace(module.test[0].api_service_url, "https://", "")
  proxied = true
  ttl     = 1
}
