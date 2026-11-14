variable "events_services" {
  description = "Rust event ingestion services (events/), keyed by name"
  type = map(object({
    image_url          = optional(string, "ghcr.io/polarsource/polar-events")
    plan               = optional(string, "standard")
    custom_domains     = optional(list(object({ name = string })), [])
    database_pool_size = optional(string, "10")
    autoscaling = object({
      min               = number
      max               = number
      cpu_percentage    = optional(number, 55)
      memory_percentage = optional(number, 85)
    })
  }))
  default = {}
}

resource "render_web_service" "events" {
  for_each = var.events_services

  environment_id    = var.render_environment_id
  name              = each.key
  plan              = each.value.plan
  region            = "ohio"
  health_check_path = "/healthz"

  runtime_source = {
    image = {
      image_url              = split("@", each.value.image_url)[0]
      registry_credential_id = var.registry_credential_id
      tag                    = "latest"
    }
  }

  lifecycle {
    ignore_changes = [runtime_source.image]
  }

  autoscaling = {
    enabled = true
    min     = each.value.autoscaling.min
    max     = each.value.autoscaling.max
    criteria = {
      cpu = {
        enabled    = true
        percentage = each.value.autoscaling.cpu_percentage
      }
      memory = {
        enabled    = true
        percentage = each.value.autoscaling.memory_percentage
      }
    }
  }

  custom_domains = length(each.value.custom_domains) > 0 ? each.value.custom_domains : null

  env_vars = {
    FORWARDED_ALLOW_IPS      = { value = var.api_service_config.forwarded_allow_ips }
    POLAR_DATABASE_POOL_SIZE = { value = each.value.database_pool_size }
  }
}

locals {
  events_ids = [for e in render_web_service.events : e.id]
}

output "events_service_urls" {
  description = "Map of events service names to their URLs"
  value       = { for name, events in render_web_service.events : name => events.url }
}
