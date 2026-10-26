
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

data "tfe_outputs" "production" {
  organization = "polar-sh"
  workspace    = "polar"
}

locals {
  private_backoffice_hostname = "backoffice.test.polar.sh"
  environment_id              = data.tfe_outputs.production.values.test_environment_id
  test_enabled                = true
}

# =============================================================================
# Redis
# =============================================================================

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

  environment = "test"
  private_backoffice = var.private_backoffice_enabled ? {
    hostname             = local.private_backoffice_hostname
    oauth_client_secret  = var.private_backoffice_tailscale_oauth_client_secret
    cloudflare_api_token = var.private_backoffice_cloudflare_api_token
  } : null
  render_environment_id  = local.environment_id
  registry_credential_id = render_registry_credential.ghcr.id

  postgres_config = local.planetscale_postgres_config

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
    allowed_hosts          = jsonencode(["test.polar.sh", local.private_backoffice_hostname])
    cors_origins           = "[\"https://test.polar.sh\", \"https://github.com\", \"https://docs.polar.sh\"]"
    custom_domains         = [{ name = "test-api.polar.sh" }]
    web_concurrency        = "2"
    forwarded_allow_ips    = local.forwarded_allow_ips
    database_pool_size     = "10"
    postgres_database      = module.planetscale.database_name
    postgres_read_database = module.planetscale.database_name
    pre_deploy_command     = "env POLAR_POSTGRES_PORT=5432 uv run task pre_deploy"
    redis_db               = "1"
    plan                   = "pro"
  }

  workers = {
    worker-test = {
      start_command      = "uv run dramatiq -p 2 -t 4 -f polar.worker.scheduler:start polar.worker.run"
      custom_domains     = [{ name = "worker-test.polar.sh" }]
      dramatiq_prom_port = "10000"
    }
  }

  environment_groups = module.backend_environment[0].environment_groups
  email_from_domain  = local.backend_config.email_from_domain

  depends_on = [render_registry_credential.ghcr, render_redis.redis]
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

resource "cloudflare_dns_record" "worker" {
  for_each = merge(module.test[*].worker_urls...)

  zone_id = "22bcd1b07ec25452aab472486bc8df94"
  name    = "${each.key}.polar.sh"
  type    = "CNAME"
  content = replace(each.value, "https://", "")
  proxied = true
  ttl     = 1
}

resource "cloudflare_dns_record" "private_backoffice" {
  count = local.test_enabled && var.private_backoffice_enabled && var.private_backoffice_tailscale_ip != "" ? 1 : 0

  zone_id = "22bcd1b07ec25452aab472486bc8df94"
  name    = local.private_backoffice_hostname
  type    = "A"
  content = var.private_backoffice_tailscale_ip
  proxied = false
  ttl     = 300
}

output "private_backoffice_service_id" {
  value = one(module.test[*].private_backoffice_service_id)
}
