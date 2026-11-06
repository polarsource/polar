
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
  private_backoffice_hostname = "backoffice.polar.sh"

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
# Cloudflare IP Ranges
# =============================================================================

module "cloudflare_ips" {
  source = "../modules/cloudflare_ips"
}

# =============================================================================
# Production
# =============================================================================

module "production" {
  source = "../modules/render_service"

  environment = "production"
  private_backoffice = var.private_backoffice_enabled ? {
    hostname             = local.private_backoffice_hostname
    oauth_client_secret  = var.private_backoffice_tailscale_oauth_client_secret
    cloudflare_api_token = var.private_backoffice_cloudflare_api_token
  } : null
  render_environment_id  = render_project.polar.environments["Production"].id
  registry_credential_id = render_registry_credential.ghcr.id

  api_service_config = {
    postgres_database      = module.planetscale.database_name
    postgres_read_database = module.planetscale.database_name
    pre_deploy_command     = "env POLAR_POSTGRES_USER=${module.planetscale.app_role_username} POLAR_POSTGRES_PORT=5432 uv run task pre_deploy"
    allowed_hosts          = jsonencode(["polar.sh", local.private_backoffice_hostname])
    cors_origins           = "[\"https://polar.sh\", \"https://github.com\", \"https://docs.polar.sh\"]"
    custom_domains         = [{ name = "api.polar.sh" }, { name = "buy.polar.sh" }]
    plan                   = "pro_plus"
    web_concurrency        = "6"
    forwarded_allow_ips    = local.forwarded_allow_ips
    redis_db               = "1"
  }

  postgres_config = local.planetscale_postgres_config

  redis_config = {
    host = local.redis_host
    port = local.redis_port
  }

  resend_domain = {
    zone_id         = "22bcd1b07ec25452aab472486bc8df94"
    dkim_public_key = "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCqT9xW1l4M3o9tgdDcKBrQ3s+WFLwrVkGppzoq1GP36o+TPHFVXMJvMRa+RSokTXRAlxu2hR00WHj7vKVJUhDaqbtZDm0wUhgYleuiXB6pxa13g+/dMyrI9L/bM1BLDa3TOJBwxbB7JTNAyyJ6Q+FcHsGA1b/5B+HPQE+TCpDZUwIDAQAB"
    spf_policy      = "\"v=spf1 include:amazonses.com ~all\""
  }

  workers = {
    "scheduler" = {
      start_command      = "uv run python -m polar.worker.scheduler"
      plan               = "standard"
      custom_domains     = [{ name = "scheduler.polar.sh" }]
      dramatiq_prom_port = "10000"
    }
    "worker" = {
      start_command      = "uv run dramatiq polar.worker.run -p 2 -t 8 --queues low_priority"
      custom_domains     = [{ name = "worker.polar.sh" }]
      dramatiq_prom_port = "10000"
    }
    "worker-medium-priority" = {
      start_command      = "uv run dramatiq polar.worker.run -p 2 -t 4 --queues medium_priority"
      custom_domains     = [{ name = "worker-medium-priority.polar.sh" }]
      dramatiq_prom_port = "10001"
    }
    "worker-high-priority" = {
      start_command      = "uv run dramatiq polar.worker.run -p 2 -t 4 --queues high_priority"
      custom_domains     = [{ name = "worker-high-priority.polar.sh" }]
      dramatiq_prom_port = "10001"
    }
    "worker-webhook" = {
      start_command      = "uv run dramatiq polar.worker.run -p 1 -t 16 --queues webhooks"
      custom_domains     = [{ name = "worker-webhook.polar.sh" }]
      dramatiq_prom_port = "10001"
      database_pool_size = "16"
    }
    worker-tinybird = {
      start_command      = "uv run dramatiq polar.worker.run_without_db -p 4 -t 32 --queues tinybird"
      custom_domains     = [{ name = "worker-tinybird.polar.sh" }]
      dramatiq_prom_port = "10002"
    }
    worker-invoices-receipts = {
      start_command      = "uv run dramatiq polar.worker.run -p 1 -t 3 --queues invoices_and_receipts"
      plan               = "standard"
      custom_domains     = [{ name = "worker-invoices-receipts.polar.sh" }]
      dramatiq_prom_port = "10003"
    }
  }

  environment_groups = module.backend_environment.environment_groups
  email_from_domain  = local.backend_config.email_from_domain

  memory_profile_config = {
    s3_bucket_name = local.diagnostics_bucket_name
  }

  depends_on = [render_registry_credential.ghcr, render_project.polar]
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

resource "cloudflare_dns_record" "api" {
  zone_id = "22bcd1b07ec25452aab472486bc8df94"
  name    = "api.polar.sh"
  type    = "CNAME"
  content = replace(module.production.api_service_url, "https://", "")
  proxied = true
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
  count = var.private_backoffice_enabled && var.private_backoffice_tailscale_ip != "" ? 1 : 0

  zone_id = "22bcd1b07ec25452aab472486bc8df94"
  name    = local.private_backoffice_hostname
  type    = "A"
  content = var.private_backoffice_tailscale_ip
  proxied = false
  ttl     = 300
}

resource "cloudflare_dns_record" "worker" {
  for_each = module.production.worker_urls

  zone_id = "22bcd1b07ec25452aab472486bc8df94"
  name    = "${each.key}.polar.sh"
  type    = "CNAME"
  content = replace(each.value, "https://", "")
  proxied = true
  ttl     = 1
}

output "private_backoffice_service_id" {
  value = module.production.private_backoffice_service_id
}
