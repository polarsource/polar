# Polar Vercel project setup
#
# One Vercel project per environment (production, sandbox), its custom domains
# and its environment variables. Env vars are managed via the dedicated
# vercel_project_environment_variable resources, so the project's inline
# `environment` is intentionally left unmanaged (see lifecycle below).

resource "vercel_project" "this" {
  name      = var.name
  framework = var.framework

  root_directory  = var.root_directory
  build_command   = var.build_command
  install_command = var.install_command
  ignore_command  = var.ignore_command

  build_machine_type         = var.build_machine_type
  resource_config            = var.resource_config
  enable_preview_feedback    = var.enable_preview_feedback
  enable_production_feedback = var.enable_production_feedback
  git_provider_options       = var.git_provider_options

  git_repository = {
    type              = "github"
    repo              = var.git_repo
    production_branch = var.production_branch
  }

  lifecycle {
    # Environment variables are owned by vercel_project_environment_variable resources.
    ignore_changes = [environment]
  }
}

locals {
  # Identical across all environments (same key, value and target everywhere).
  shared_environment_variables = [
    { key = "SENTRY_ORG", value = "polar-sh", target = ["production", "preview"] },
    { key = "SENTRY_PROJECT", value = "dashboard", target = ["production", "preview"] },
  ]

  # Non-secret config present in every environment, applied to all targets.
  config_environment_variables = [
    { key = "NEXT_PUBLIC_API_URL", value = var.config.next_public_api_url },
    { key = "NEXT_PUBLIC_BACKOFFICE_URL", value = var.config.next_public_backoffice_url },
    { key = "NEXT_PUBLIC_SENTRY_DSN", value = var.config.next_public_sentry_dsn },
    { key = "NEXT_PUBLIC_POSTHOG_TOKEN", value = var.config.next_public_posthog_token },
    { key = "NEXT_PUBLIC_APPLE_DOMAIN_ASSOCIATION", value = var.config.next_public_apple_domain_association },
    { key = "NEXT_PUBLIC_CHECKOUT_EMBED_SCRIPT_SRC", value = var.config.next_public_checkout_embed_script_src },
    { key = "NEXT_PUBLIC_STRIPE_PAYMENT_METHOD_CONFIGURATION", value = var.config.next_public_stripe_payment_method_configuration },
    { key = "S3_PUBLIC_IMAGES_BUCKET_PROTOCOL", value = var.config.s3_public_images_bucket_protocol },
    { key = "S3_PUBLIC_IMAGES_BUCKET_HOSTNAME", value = var.config.s3_public_images_bucket_hostname },
    { key = "S3_PUBLIC_IMAGES_BUCKET_PORT", value = var.config.s3_public_images_bucket_port },
    { key = "S3_PUBLIC_IMAGES_BUCKET_PATHNAME", value = var.config.s3_public_images_bucket_pathname },
    { key = "S3_UPLOAD_ORIGINS", value = var.config.s3_upload_origins },
    { key = "POLAR_CHECKOUT_EMBED_SCRIPT_ALLOWED_ORIGINS", value = var.config.polar_checkout_embed_script_allowed_origins },
    { key = "POLAR_OPENAPI_SCHEMA_URL", value = var.config.polar_openapi_schema_url },
    { key = "ENABLE_EXPERIMENTAL_COREPACK", value = var.config.enable_experimental_corepack },
  ]

  # Secrets present in every environment.
  secret_environment_variables = [
    { key = "PYDANTIC_AI_GATEWAY_API_KEY", value = var.secrets.pydantic_ai_gateway_api_key, target = ["production", "preview"], sensitive = true },
    { key = "MINTLIFY_ASSISTANT_API_KEY", value = var.secrets.mintlify_assistant_api_key, target = ["production", "preview"], sensitive = true },
    { key = "GRAM_API_KEY", value = var.secrets.gram_api_key, target = ["production", "preview"], sensitive = false },
    { key = "SENTRY_AUTH_TOKEN", value = var.secrets.sentry_auth_token, target = ["production", "preview"], sensitive = false },
    { key = "POLAR_PREVIEW_ACCESS_TOKEN", value = var.secrets.polar_preview_access_token, target = ["preview"], sensitive = true },
  ]

  managed_environment_variables = concat(
    [for env in local.shared_environment_variables : {
      key       = env.key
      value     = env.value
      target    = toset(env.target)
      sensitive = false
    }],
    [for env in local.config_environment_variables : {
      key       = env.key
      value     = env.value
      target    = toset(["production", "preview", "development"])
      sensitive = false
    }],
    [for env in local.secret_environment_variables : {
      key       = env.key
      value     = env.value
      target    = toset(env.target)
      sensitive = env.sensitive
    }],
    [for env in var.environment_variables : {
      key       = env.key
      value     = env.value
      target    = env.target
      sensitive = env.sensitive
    }],
  )

  environment_variables = [for env in local.managed_environment_variables : env if env.value != null]
}

resource "vercel_project_environment_variable" "this" {
  count = length(local.environment_variables)

  project_id = vercel_project.this.id
  key        = local.environment_variables[count.index].key
  value      = local.environment_variables[count.index].value
  target     = local.environment_variables[count.index].target
  sensitive  = local.environment_variables[count.index].sensitive
}

resource "vercel_project_domain" "this" {
  for_each = { for domain in var.domains : domain.name => domain }

  project_id           = vercel_project.this.id
  domain               = each.value.name
  redirect             = each.value.redirect
  redirect_status_code = each.value.redirect_status_code
  git_branch           = each.value.git_branch
}

# Cloudflare record pointing the hostname at Vercel, for domains that opt in
# via `dns`. Apex domains use an A record; subdomains a CNAME to the project's
# Vercel DNS target.
resource "cloudflare_dns_record" "this" {
  for_each = { for domain in var.domains : domain.name => domain if domain.dns != null }

  zone_id = each.value.dns.zone_id
  name    = each.value.name
  type    = each.value.dns.type
  content = each.value.dns.content
  proxied = each.value.dns.proxied
  ttl     = each.value.dns.ttl
}
