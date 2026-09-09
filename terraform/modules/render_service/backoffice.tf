variable "private_backoffice" {
  description = "Optional private replica using the existing admin sessions."
  type = object({
    hostname             = string
    auth_key             = string
    cloudflare_api_token = string
    tags                 = optional(string, "tag:backoffice")
    plan                 = optional(string, "standard")
  })
  sensitive = true
  default   = null
}

resource "render_private_service" "backoffice" {
  count          = nonsensitive(var.private_backoffice != null) ? 1 : 0
  environment_id = var.render_environment_id
  name           = "backoffice-private${local.env_suffix}"
  plan           = var.private_backoffice.plan
  region         = "ohio"
  num_instances  = 1
  start_command  = "/bin/bash /app/server/scripts/run_private_backoffice.sh"

  runtime_source = {
    image = {
      image_url              = split("@", var.api_service_config.image_url)[0]
      registry_credential_id = var.registry_credential_id
      tag                    = "latest"
    }
  }

  disk = {
    name       = "backoffice-state"
    mount_path = "/var/lib/backoffice"
    size_gb    = 1
  }

  secret_files = {
    "tailscale-serve.json" = {
      content = jsonencode({
        TCP = {
          "443" = {
            TCPForward = "127.0.0.1:8443"
          }
        }
      })
    }
    "Caddyfile" = {
      content = <<-CADDYFILE
        {
          admin off
          persist_config off
          default_bind 127.0.0.1
          https_port 8443
          auto_https disable_redirects
          acme_ca {$BACKOFFICE_ACME_CA:https://acme-v02.api.letsencrypt.org/directory}
          storage file_system {$BACKOFFICE_STATE_DIR:/var/lib/backoffice}/caddy
          servers {
            protocols h1 h2
          }
        }

        https://{$POLAR_BACKOFFICE_HOST} {
          tls {
            dns cloudflare {env.CLOUDFLARE_API_TOKEN}
          }
          reverse_proxy 127.0.0.1:10000 {
            header_up Host {$POLAR_BACKOFFICE_HOST}
          }
        }

        http://:10001 {
          bind 0.0.0.0
          handle /healthz {
            reverse_proxy 127.0.0.1:10000 {
              header_up Host localhost
            }
          }
          handle {
            respond 404
          }
        }
      CADDYFILE
    }
  }

  env_vars = {
    SERVICE_NAME             = { value = "backoffice-private${local.env_suffix}" }
    PORT                     = { value = "10001" }
    POLAR_BACKOFFICE_HOST    = { value = var.private_backoffice.hostname }
    POLAR_ALLOWED_HOSTS      = { value = jsonencode(distinct(concat(jsondecode(var.api_service_config.allowed_hosts), [var.private_backoffice.hostname]))) }
    POLAR_CORS_ORIGINS       = { value = var.api_service_config.cors_origins }
    POLAR_DATABASE_POOL_SIZE = { value = "5" }
    TS_AUTHKEY               = { value = var.private_backoffice.auth_key }
    TS_HOSTNAME              = { value = "polar-backoffice-${var.environment}" }
    TS_STATE_DIR             = { value = "/var/lib/backoffice/tailscale" }
    TS_USERSPACE             = { value = "true" }
    TS_ACCEPT_DNS            = { value = "false" }
    TS_EXTRA_ARGS            = { value = "--advertise-tags=${var.private_backoffice.tags} --accept-routes=false" }
    TS_SERVE_CONFIG          = { value = "/etc/secrets/tailscale-serve.json" }
    TS_ENABLE_HEALTH_CHECK   = { value = "true" }
    TS_LOCAL_ADDR_PORT       = { value = "127.0.0.1:9002" }
    CLOUDFLARE_API_TOKEN     = { value = var.private_backoffice.cloudflare_api_token }
  }

  lifecycle {
    ignore_changes = [runtime_source.image]
  }
}

output "private_backoffice_service_id" {
  description = "The ID of the private backoffice service."
  value       = one(render_private_service.backoffice[*].id)
}
