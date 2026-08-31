
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

  db_external_host = nonsensitive(regex("@([^/:]+)", render_postgres.db.connection_info.external_connection_string)[0])

  # Read replica connection info
  read_replica = [for r in render_postgres.db.read_replicas : r if r.name == "polar-read"][0]

  # Redis connection info
  redis_host = var.redis_private_link_host
  redis_port = "6379"

  # Forwarded allow IPs: Cloudflare ranges + Render proxy
  render_proxy_cidr   = "10.0.0.0/8"
  forwarded_allow_ips = "${module.cloudflare_ips.all_ranges},${local.render_proxy_cidr}"
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
  plan           = "pro_64gb"
  region         = "ohio"
  version        = "15"
  disk_size_gb   = 750

  high_availability_enabled = false

  read_replicas = [
    { name = "polar-read" },
    { name = "polar-replica" }
  ]

  lifecycle {
    prevent_destroy = true
    ignore_changes = [
      ip_allow_list,
      disk_size_gb,
      database_name,
    ]
  }

  depends_on = [render_registry_credential.ghcr, render_project.polar]
}

import {
  to = render_postgres.db
  id = "dpg-d8m0n4poagis73du7gr0-a"
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
# Cloudflare IP Ranges
# =============================================================================

module "cloudflare_ips" {
  source = "../modules/cloudflare_ips"
}

# =============================================================================
# Production
# =============================================================================

import {
  to = module.production.cloudflare_dns_record.resend_dkim
  id = "22bcd1b07ec25452aab472486bc8df94/85d90083fadec2175e748e87bdb6a8c1"
}

import {
  to = module.production.cloudflare_dns_record.resend_spf_mx
  id = "22bcd1b07ec25452aab472486bc8df94/a5c3c3ada2aa12ce91543ab2b2da619e"
}

import {
  to = module.production.cloudflare_dns_record.resend_spf_txt
  id = "22bcd1b07ec25452aab472486bc8df94/00c7b9e60ec890ff5b6f55dff6fa57cb"
}

module "production" {
  source = "../modules/render_service"

  environment            = "production"
  render_environment_id  = render_project.polar.environments["Production"].id
  registry_credential_id = render_registry_credential.ghcr.id

  api_service_config = {
    postgres_database      = "polar_cpit_p9lf"
    postgres_read_database = "polar_cpit_p9lf"
    allowed_hosts          = "[\"polar.sh\", \"backoffice.polar.sh\"]"
    cors_origins           = "[\"https://polar.sh\", \"https://github.com\", \"https://docs.polar.sh\"]"
    custom_domains         = [{ name = "api.polar.sh" }, { name = "api-alt.polar.sh" }, { name = "buy.polar.sh" }, { name = "backoffice.polar.sh" }]
    plan                   = "pro_plus"
    web_concurrency        = "6"
    forwarded_allow_ips    = local.forwarded_allow_ips
    redis_db               = "1"
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

  resend_domain = {
    zone_id         = "22bcd1b07ec25452aab472486bc8df94"
    dkim_public_key = "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCqT9xW1l4M3o9tgdDcKBrQ3s+WFLwrVkGppzoq1GP36o+TPHFVXMJvMRa+RSokTXRAlxu2hR00WHj7vKVJUhDaqbtZDm0wUhgYleuiXB6pxa13g+/dMyrI9L/bM1BLDa3TOJBwxbB7JTNAyyJ6Q+FcHsGA1b/5B+HPQE+TCpDZUwIDAQAB"
    spf_policy      = "\"v=spf1 include:amazonses.com -all\""
  }

  workers = {
    "scheduler" = {
      start_command      = "uv run python -m polar.worker.scheduler"
      plan               = "standard"
      dramatiq_prom_port = "10000"
    }
    "worker" = {
      start_command      = "uv run dramatiq polar.worker.run -p 2 -t 8 --queues low_priority"
      custom_domains     = [{ name = "worker.polar.sh" }]
      dramatiq_prom_port = "10000"
    }
    "worker-medium-priority" = {
      start_command      = "uv run dramatiq polar.worker.run -p 2 -t 4 --queues medium_priority"
      dramatiq_prom_port = "10001"
    }
    "worker-high-priority" = {
      start_command      = "uv run dramatiq polar.worker.run -p 2 -t 4 --queues high_priority"
      dramatiq_prom_port = "10001"
    }
    "worker-webhook" = {
      start_command      = "uv run dramatiq polar.worker.run -p 1 -t 16 --queues webhooks"
      dramatiq_prom_port = "10001"
      database_pool_size = "16"
    }
    worker-tinybird = {
      start_command      = "uv run dramatiq polar.worker.run_without_db -p 4 -t 32 --queues tinybird"
      dramatiq_prom_port = "10002"
    }
    worker-drain = {
      start_command      = "uv run dramatiq polar.worker.run -p 2 -t 8"
      dramatiq_prom_port = "10004"
      redis_host         = render_redis.redis.id
      redis_port         = "6379"
      redis_db           = "0"
    }
    worker-invoices-receipts = {
      start_command      = "uv run dramatiq polar.worker.run -p 1 -t 3 --queues invoices_and_receipts"
      plan               = "standard"
      dramatiq_prom_port = "10003"
    }
  }

  environment_groups = module.backend_environment.environment_groups
  backend_jwks       = local.backend_secrets.jwks
  email_from_domain  = local.backend_config.email_from_domain

  memory_profile_config = {
    s3_bucket_name = "polar-production-logs"
  }

  depends_on = [render_registry_credential.ghcr, render_project.polar, render_postgres.db, render_redis.redis]
}

# =============================================================================
# PgBouncer
# =============================================================================

module "pgbouncer" {
  source = "../modules/pgbouncer"

  environment            = "production"
  render_environment_id  = render_project.polar.environments["Production"].id
  registry_credential_id = render_registry_credential.ghcr.id

  database = {
    host     = local.db_internal_host
    port     = local.db_port
    user     = local.db_user
    password = local.db_password
  }

  pool_config = {
    max_client_conn   = "5000"
    default_pool_size = "50"
    reserve_pool_size = "10"
  }

  depends_on = [render_registry_credential.ghcr, render_project.polar, render_postgres.db]
}

locals {
  pgbouncer_read_pool_configs = {
    "polar-read" = {
      max_client_conn   = "5000"
      default_pool_size = "50"
      reserve_pool_size = "10"
    }
    "polar-replica" = {
      max_client_conn   = "1000"
      default_pool_size = "20"
      reserve_pool_size = "0"
    }
  }
}

module "pgbouncer_read" {
  source   = "../modules/pgbouncer"
  for_each = { for replica in render_postgres.db.read_replicas : replica.name => replica }

  name                   = "pgbouncer-${trimprefix(each.key, "polar-")}"
  environment            = "production"
  render_environment_id  = render_project.polar.environments["Production"].id
  registry_credential_id = render_registry_credential.ghcr.id

  database = {
    host     = each.value.id
    port     = local.db_port
    user     = local.db_user
    password = local.db_password
  }

  pool_config = local.pgbouncer_read_pool_configs[each.key]

  depends_on = [render_registry_credential.ghcr, render_project.polar, render_postgres.db]
}

# =============================================================================
# Tailscale Subnet Router
# =============================================================================

module "tailscale_router" {
  source = "../modules/tailscale_router"

  environment            = "production"
  render_environment_id  = render_project.polar.environments["Production"].id
  registry_credential_id = render_registry_credential.ghcr.id
  tailscale_authkey      = var.tailscale_authkey
  advertise_routes       = var.tailscale_advertise_routes
  advertise_exit_node    = true

  depends_on = [render_registry_credential.ghcr, render_project.polar]
}

# =============================================================================
# Cloudflare DNS
# =============================================================================

import {
  to = cloudflare_dns_record.buy
  id = "22bcd1b07ec25452aab472486bc8df94/119002474ca374ebb18bbe1c7a6a55b5"
}

resource "cloudflare_dns_record" "api" {
  zone_id = "22bcd1b07ec25452aab472486bc8df94"
  name    = "api.polar.sh"
  type    = "CNAME"
  content = replace(module.production.api_service_url, "https://", "")
  proxied = true
  ttl     = 1
}

resource "cloudflare_dns_record" "api_alt" {
  zone_id = "22bcd1b07ec25452aab472486bc8df94"
  name    = "api-alt.polar.sh"
  type    = "CNAME"
  content = replace(module.production.api_service_url, "https://", "")
  proxied = false
  ttl     = 1
}

resource "cloudflare_dns_record" "buy" {
  zone_id = "22bcd1b07ec25452aab472486bc8df94"
  name    = "buy.polar.sh"
  type    = "CNAME"
  content = replace(module.production.api_service_url, "https://", "")
  proxied = true
  ttl     = 1
}

resource "cloudflare_dns_record" "backoffice" {
  zone_id = "22bcd1b07ec25452aab472486bc8df94"
  name    = "backoffice.polar.sh"
  type    = "CNAME"
  content = replace(module.production.api_service_url, "https://", "")
  proxied = true
  ttl     = 1
}

resource "cloudflare_dns_record" "worker" {
  zone_id = "22bcd1b07ec25452aab472486bc8df94"
  name    = "worker.polar.sh"
  type    = "CNAME"
  content = replace(module.production.worker_urls["worker"], "https://", "")
  proxied = false
  ttl     = 1
}
