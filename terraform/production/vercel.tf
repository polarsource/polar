# =============================================================================
# Vercel — Production frontend (polar.sh)
# =============================================================================
#
# vercel_project_environment_variables manages only the keys declared below;
# other env vars on the live project are left untouched.

import {
  to = module.vercel.vercel_project.this
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F"
}

import {
  to = module.vercel.vercel_project_domain.this["polar.sh"]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/polar.sh"
}

import {
  to = module.vercel.vercel_project_domain.this["dashboard.polar.sh"]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/dashboard.polar.sh"
}

import {
  to = module.vercel.vercel_project_domain.this["blog.polar.sh"]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/blog.polar.sh"
}

import {
  to = module.vercel.vercel_project_domain.this["www.polar.sh"]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/www.polar.sh"
}

import {
  to = module.vercel.vercel_project_domain.this["polar.new"]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/polar.new"
}

import {
  to = module.vercel.vercel_project_domain.this["www.polar.new"]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/www.polar.new"
}

module "vercel" {
  source = "../modules/vercel"

  name     = "polar"
  git_repo = "polarsource/polar"

  domains = [
    { name = "polar.sh" },
    { name = "www.polar.sh", redirect = "polar.sh", redirect_status_code = 308 },
    { name = "dashboard.polar.sh" },
    { name = "blog.polar.sh" },
    { name = "polar.new" },
    { name = "www.polar.new", redirect = "polar.new", redirect_status_code = 308 },
  ]

  config = {
    next_public_api_url                             = "https://api.polar.sh"
    next_public_backoffice_url                      = "https://backoffice.polar.sh"
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
    polar_openapi_schema_url                        = "https://api.polar.sh/openapi.json"
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
    { key = "NEXT_PUBLIC_PRODUCT_LINK_BASE_URL", value = "", target = ["production"] },
    { key = "NEXT_PUBLIC_POSTHOG_HOST", value = "https://polar.sh/ingest" },
    { key = "NEXT_PUBLIC_SENTRY_ENABLED", value = "true" },
    { key = "NEXT_PUBLIC_GOOGLE_ANALYTICS_ID", value = "G-MBYW1QZFHE" },
    { key = "NEXT_PUBLIC_GITHUB_INSTALLATION_URL", value = "https://github.com/apps/polar-sh/installations/new" },
    { key = "NEXT_PUBLIC_STRIPE_KEY", value = var.stripe_publishable_key, sensitive = true },
    { key = "MCP_OAUTH2_CLIENT_ID", value = var.mcp_oauth2_client_id, target = ["production", "preview"], sensitive = true },
    { key = "MCP_OAUTH2_CLIENT_SECRET", value = var.mcp_oauth2_client_secret, target = ["production", "preview"], sensitive = true },
    { key = "ATTIO_API_KEY", value = var.attio_api_key, target = ["production", "preview"], sensitive = true },
    { key = "ATTIO_STARTUP_LIST_ID", value = var.attio_startup_list_id, target = ["production", "preview"], sensitive = true },
  ]
}
