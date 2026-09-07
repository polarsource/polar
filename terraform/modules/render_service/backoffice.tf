variable "private_backoffice" {
  description = "Private backoffice on Tailscale; null leaves public access unchanged."
  type = object({
    url             = string
    oauth_client_id = string
    auth_key        = string
    tags            = optional(string, "tag:backoffice")
    plan            = optional(string, "standard")
  })
  sensitive = true
  default   = null
}

variable "public_backoffice_enabled" {
  description = "Mount the backoffice on the public API service."
  type        = bool
  default     = true
}

resource "render_env_group" "backoffice" {
  environment_id = var.render_environment_id
  name           = "backoffice-${var.environment}"
  env_vars = merge(
    {
      POLAR_BACKOFFICE_MODE = { value = var.public_backoffice_enabled ? "public" : "disabled" }
    },
    var.private_backoffice == null ? {} : {
      POLAR_BACKOFFICE_PRIVATE_URL     = { value = var.private_backoffice.url }
      POLAR_BACKOFFICE_OAUTH_CLIENT_ID = { value = var.private_backoffice.oauth_client_id }
    },
  )
}

resource "render_env_group_link" "backoffice" {
  env_group_id = render_env_group.backoffice.id
  service_ids  = local.all_service_ids
}

resource "render_background_worker" "backoffice" {
  count          = nonsensitive(var.private_backoffice != null) ? 1 : 0
  environment_id = var.render_environment_id
  name           = "backoffice${local.env_suffix}"
  plan           = var.private_backoffice.plan
  region         = "ohio"
  num_instances  = 1
  start_command  = "bash dev/run-backoffice"

  runtime_source = {
    image = {
      image_url              = split("@", var.api_service_config.image_url)[0]
      registry_credential_id = var.registry_credential_id
      tag                    = "latest"
    }
  }

  disk = {
    name       = "tailscale-state"
    mount_path = "/var/lib/tailscale"
    size_gb    = 1
  }

  env_vars = {
    SERVICE_NAME             = { value = "backoffice${local.env_suffix}" }
    POLAR_BACKOFFICE_MODE    = { value = "private" }
    POLAR_DATABASE_POOL_SIZE = { value = "5" }
    TAILSCALE_AUTHKEY        = { value = var.private_backoffice.auth_key }
    TAILSCALE_TAGS           = { value = var.private_backoffice.tags }
  }

  lifecycle {
    ignore_changes = [runtime_source.image]
  }
}

output "backoffice_service_id" {
  description = "Set as RENDER_BACKOFFICE_SERVICE_ID in the GitHub deployment environment."
  value       = one(render_background_worker.backoffice[*].id)
}
