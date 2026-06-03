# =============================================================================
# Vercel — Sandbox frontend (sandbox.polar.sh)
# =============================================================================

import {
  to = module.vercel.vercel_project.this
  id = "prj_HjPbSesm9rpLRPaK6bLOwVqQzQBD"
}

import {
  to = module.vercel.vercel_project_domain.this["sandbox.polar.sh"]
  id = "prj_HjPbSesm9rpLRPaK6bLOwVqQzQBD/sandbox.polar.sh"
}

module "vercel" {
  source = "../modules/vercel"

  name     = "polar-sandbox"
  git_repo = "polarsource/polar"

  domains = [
    { name = "sandbox.polar.sh" },
  ]

  config = {
    next_public_api_url                             = "https://sandbox-api.polar.sh"
    next_public_backoffice_url                      = "https://sandbox-api.polar.sh/backoffice"
    next_public_sentry_dsn                          = var.next_public_sentry_dsn
    next_public_posthog_token                       = var.next_public_posthog_token
    next_public_apple_domain_association            = var.next_public_apple_domain_association
    next_public_checkout_embed_script_src           = "https://cdn.jsdelivr.net/npm/@polar-sh/checkout@0.1/dist/embed.global.js"
    next_public_stripe_payment_method_configuration = var.next_public_stripe_payment_method_configuration
    s3_public_images_bucket_protocol                = "https"
    s3_public_images_bucket_hostname                = "polar-public-sandbox-files.s3.amazonaws.com"
    s3_public_images_bucket_port                    = null
    s3_public_images_bucket_pathname                = "/product_media/**"
    s3_upload_origins                               = "https://polar-sandbox-files.s3.amazonaws.com https://polar-public-sandbox-files.s3.amazonaws.com"
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
    { key = "NEXT_PUBLIC_FRONTEND_BASE_URL", value = "https://sandbox.polar.sh" },
    { key = "NEXT_PUBLIC_ENVIRONMENT", value = "sandbox" },
    { key = "POLAR_AUTH_COOKIE_KEY", value = "polar_sandbox_session" },
    { key = "NEXT_PUBLIC_PRODUCT_LINK_BASE_URL", value = "https://sandbox.polar.sh/api/checkout?price=" },
    { key = "POLAR_PREVIEW_BACKEND_HOST", value = "", target = ["preview"] },
    { key = "NEXT_PUBLIC_STRIPE_KEY", value = var.stripe_publishable_key, target = ["production", "development"] },
    { key = "NEXT_PUBLIC_STRIPE_KEY", value = var.stripe_publishable_key_preview, target = ["preview"] },
    { key = "MCP_OAUTH2_CLIENT_ID", value = var.mcp_oauth2_client_id, target = ["production", "preview"], sensitive = true },
    { key = "MCP_OAUTH2_CLIENT_SECRET", value = var.mcp_oauth2_client_secret, target = ["production", "preview"], sensitive = true },
  ]
}
