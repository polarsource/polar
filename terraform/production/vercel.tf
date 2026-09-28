# =============================================================================
# Vercel — Production frontend (polar.sh)
# =============================================================================
#
# Terraform manages only the env vars declared below;
# other env vars on the live project are left untouched.


module "vercel" {
  source = "../modules/vercel"

  name     = "polar"
  git_repo = "polarsource/polar"

  preview_deployments_disabled = true

  # Production runs functions in cle1 (sandbox uses the module default, iad1).
  resource_config = {
    function_default_regions = ["cle1"]
  }

  domains = [
    {
      name = "polar.sh"
      dns = {
        zone_id = "22bcd1b07ec25452aab472486bc8df94"
        type    = "A"
        content = "216.150.1.1"
        ttl     = 600
      }
    },
    {
      name                 = "www.polar.sh"
      redirect             = "polar.sh"
      redirect_status_code = 308
      dns = {
        zone_id = "22bcd1b07ec25452aab472486bc8df94"
        content = "582a8a8790ca4ebf.vercel-dns-016.com"
        ttl     = 600
      }
    },
    {
      name = "dashboard.polar.sh"
      dns = {
        zone_id = "22bcd1b07ec25452aab472486bc8df94"
        content = "582a8a8790ca4ebf.vercel-dns-016.com"
        ttl     = 600
      }
    },
    {
      name = "blog.polar.sh"
      dns = {
        zone_id = "22bcd1b07ec25452aab472486bc8df94"
        content = "582a8a8790ca4ebf.vercel-dns-016.com"
        ttl     = 600
      }
    },
    # polar.new and www.polar.new live in a separate zone and are managed separately.
    { name = "polar.new" },
    { name = "www.polar.new", redirect = "polar.new", redirect_status_code = 308 },
  ]

  config = {
    next_public_api_url                             = "https://api.polar.sh"
    next_public_backoffice_url                      = "https://${local.private_backoffice_hostname}"
    next_public_sentry_dsn                          = var.next_public_sentry_dsn
    next_public_posthog_token                       = var.next_public_posthog_token
    next_public_apple_domain_association            = var.next_public_apple_domain_association
    next_public_checkout_embed_script_src           = "https://cdn.jsdelivr.net/npm/@polar-sh/checkout@0.1/dist/embed.global.js"
    next_public_stripe_payment_method_configuration = var.next_public_stripe_payment_method_configuration
    s3_public_images_bucket_protocol                = "https"
    s3_public_images_bucket_hostname                = "polar-public-files.s3.amazonaws.com"
    s3_public_images_bucket_port                    = null
    s3_public_images_bucket_pathname                = "/product_media/**"
    s3_upload_origins                               = "https://polar-production-files.s3.amazonaws.com https://polar-public-files.s3.amazonaws.com"
    polar_checkout_embed_script_allowed_origins     = "https://polar.sh,https://sandbox.polar.sh"
    enable_experimental_corepack                    = "1"
  }

  secrets = {
    pydantic_ai_gateway_api_key = var.pydantic_ai_gateway_api_key
    mintlify_assistant_api_key  = var.mintlify_assistant_api_key
    gram_api_key                = var.gram_api_key
    sentry_auth_token           = var.sentry_auth_token
    polar_preview_access_token  = var.polar_preview_access_token
  }

  # Environment-specific or target-varies-by-env.
  environment_variables = [
    { key = "NEXT_PUBLIC_FRONTEND_BASE_URL", value = "https://polar.sh", target = ["production"] },
    { key = "NEXT_PUBLIC_SANDBOX_FRONTEND_BASE_URL", value = "https://sandbox.polar.sh" },
    { key = "NEXT_PUBLIC_PRODUCT_LINK_BASE_URL", value = "https://buy.polar.sh/", target = ["production"] },
    { key = "NEXT_PUBLIC_POSTHOG_HOST", value = "https://polar.sh/ingest" },
    { key = "NEXT_PUBLIC_SENTRY_ENABLED", value = "true" },
    { key = "NEXT_PUBLIC_GOOGLE_ANALYTICS_ID", value = "G-MBYW1QZFHE" },
    { key = "NEXT_PUBLIC_GITHUB_INSTALLATION_URL", value = "https://github.com/apps/polar-sh/installations/new" },
    { key = "NEXT_PUBLIC_STRIPE_KEY", value = var.stripe_publishable_key },
    { key = "MCP_OAUTH2_CLIENT_ID", value = var.mcp_oauth2_client_id, target = ["production", "preview"] },
    { key = "MCP_OAUTH2_CLIENT_SECRET", value = var.mcp_oauth2_client_secret, target = ["production", "preview"] },
    { key = "ATTIO_API_KEY", value = var.attio_api_key, target = ["production", "preview"], sensitive = true },
    { key = "ATTIO_STARTUP_LIST_ID", value = var.attio_startup_list_id, target = ["production", "preview"], sensitive = true },
  ]
}

