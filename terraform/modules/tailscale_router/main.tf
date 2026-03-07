resource "render_web_service" "tailscale_router" {
  environment_id    = var.render_environment_id
  name              = "tailscale-router-${var.environment}"
  plan              = var.plan
  region            = "ohio"
  health_check_path = "/"
  num_instances     = 1

  runtime_source = {
    image = {
      image_url              = var.image_url
      tag                    = var.image_tag
      registry_credential_id = var.registry_credential_id
    }
  }

  env_vars = {
    TAILSCALE_AUTHKEY   = { value = var.tailscale_authkey }
    ADVERTISE_ROUTES    = { value = var.advertise_routes }
    TAILSCALE_VERSION   = { value = var.tailscale_version }
    RENDER_SERVICE_NAME = { value = "tailscale-router-${var.environment}" }
  }

  # TODO: add a persistent disk for Tailscale state to avoid re-auth on deploys
  # Render TF provider may support this via a render_disk resource
}
