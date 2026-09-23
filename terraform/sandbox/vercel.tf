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

import {
  to = module.vercel.cloudflare_dns_record.this["sandbox.polar.sh"]
  id = "22bcd1b07ec25452aab472486bc8df94/9e0564c9263d6d626b96bf6bed6e216f"
}

module "vercel" {
  source = "../modules/vercel"

  name     = "polar-sandbox"
  git_repo = "polarsource/polar"

  preview_deployments_disabled = true

  domains = [
    {
      name = "sandbox.polar.sh"
      dns = {
        zone_id = "22bcd1b07ec25452aab472486bc8df94"
        content = "50b537f2e43aa1b6.vercel-dns-016.com"
      }
    },
  ]

  config = {
    next_public_api_url                             = "https://sandbox-api.polar.sh"
    next_public_backoffice_url                      = "https://${local.private_backoffice_hostname}"
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
    { key = "NEXT_PUBLIC_STRIPE_KEY", value = var.stripe_publishable_key_preview, target = ["preview"], sensitive = true },
    { key = "MCP_OAUTH2_CLIENT_ID", value = var.mcp_oauth2_client_id, target = ["production", "preview", "development"] },
    { key = "MCP_OAUTH2_CLIENT_SECRET", value = var.mcp_oauth2_client_secret, target = ["production", "preview", "development"] },
  ]
}

# Adopt the positional state entries under their identity. Remove once
# applied.
moved {
  from = module.vercel.vercel_project_environment_variable.this[0]
  to   = module.vercel.vercel_project_environment_variable.this["SENTRY_ORG/preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[1]
  to   = module.vercel.vercel_project_environment_variable.this["SENTRY_PROJECT/preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[2]
  to   = module.vercel.vercel_project_environment_variable.this["NEXT_PUBLIC_API_URL/development,preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[3]
  to   = module.vercel.vercel_project_environment_variable.this["NEXT_PUBLIC_BACKOFFICE_URL/development,preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[4]
  to   = module.vercel.vercel_project_environment_variable.this["NEXT_PUBLIC_SENTRY_DSN/development,preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[5]
  to   = module.vercel.vercel_project_environment_variable.this["NEXT_PUBLIC_POSTHOG_TOKEN/development,preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[6]
  to   = module.vercel.vercel_project_environment_variable.this["NEXT_PUBLIC_APPLE_DOMAIN_ASSOCIATION/development,preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[7]
  to   = module.vercel.vercel_project_environment_variable.this["NEXT_PUBLIC_CHECKOUT_EMBED_SCRIPT_SRC/development,preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[8]
  to   = module.vercel.vercel_project_environment_variable.this["NEXT_PUBLIC_STRIPE_PAYMENT_METHOD_CONFIGURATION/development,preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[9]
  to   = module.vercel.vercel_project_environment_variable.this["S3_PUBLIC_IMAGES_BUCKET_PROTOCOL/development,preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[10]
  to   = module.vercel.vercel_project_environment_variable.this["S3_PUBLIC_IMAGES_BUCKET_HOSTNAME/development,preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[11]
  to   = module.vercel.vercel_project_environment_variable.this["S3_PUBLIC_IMAGES_BUCKET_PATHNAME/development,preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[12]
  to   = module.vercel.vercel_project_environment_variable.this["S3_UPLOAD_ORIGINS/development,preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[13]
  to   = module.vercel.vercel_project_environment_variable.this["POLAR_CHECKOUT_EMBED_SCRIPT_ALLOWED_ORIGINS/development,preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[14]
  to   = module.vercel.vercel_project_environment_variable.this["ENABLE_EXPERIMENTAL_COREPACK/development,preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[17]
  to   = module.vercel.vercel_project_environment_variable.this["MINTLIFY_ASSISTANT_API_KEY/preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[18]
  to   = module.vercel.vercel_project_environment_variable.this["GRAM_API_KEY/preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[19]
  to   = module.vercel.vercel_project_environment_variable.this["POLAR_PREVIEW_ACCESS_TOKEN/preview"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[20]
  to   = module.vercel.vercel_project_environment_variable.this["NEXT_PUBLIC_FRONTEND_BASE_URL/development,preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[21]
  to   = module.vercel.vercel_project_environment_variable.this["NEXT_PUBLIC_ENVIRONMENT/development,preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[22]
  to   = module.vercel.vercel_project_environment_variable.this["POLAR_AUTH_COOKIE_KEY/development,preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[23]
  to   = module.vercel.vercel_project_environment_variable.this["NEXT_PUBLIC_PRODUCT_LINK_BASE_URL/development,preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[24]
  to   = module.vercel.vercel_project_environment_variable.this["POLAR_PREVIEW_BACKEND_HOST/preview"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[26]
  to   = module.vercel.vercel_project_environment_variable.this["NEXT_PUBLIC_STRIPE_KEY/development,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[27]
  to   = module.vercel.vercel_project_environment_variable.this["MCP_OAUTH2_CLIENT_ID/development,preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[28]
  to   = module.vercel.vercel_project_environment_variable.this["MCP_OAUTH2_CLIENT_SECRET/development,preview,production"]
}
