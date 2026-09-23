# =============================================================================
# Vercel — Production frontend (polar.sh)
# =============================================================================
#
# Terraform manages only the env vars declared below;
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

# --- Cloudflare DNS records (adopt existing live records) ---

import {
  to = module.vercel.cloudflare_dns_record.this["polar.sh"]
  id = "22bcd1b07ec25452aab472486bc8df94/8b0ceddb75258af3fa49fd7846655535"
}

import {
  to = module.vercel.cloudflare_dns_record.this["www.polar.sh"]
  id = "22bcd1b07ec25452aab472486bc8df94/1ab226a5a0bb731e56a95fb994eeb51f"
}

import {
  to = module.vercel.cloudflare_dns_record.this["dashboard.polar.sh"]
  id = "22bcd1b07ec25452aab472486bc8df94/ff92f83787a1c170bd97c43107ca233f"
}

import {
  to = module.vercel.cloudflare_dns_record.this["blog.polar.sh"]
  id = "22bcd1b07ec25452aab472486bc8df94/68e8b181600e850ab36dfcb9ebf414b0"
}

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
  from = module.vercel.vercel_project_environment_variable.this[15]
  to   = module.vercel.vercel_project_environment_variable.this["PYDANTIC_AI_GATEWAY_API_KEY/preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[16]
  to   = module.vercel.vercel_project_environment_variable.this["MINTLIFY_ASSISTANT_API_KEY/preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[17]
  to   = module.vercel.vercel_project_environment_variable.this["GRAM_API_KEY/preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[18]
  to   = module.vercel.vercel_project_environment_variable.this["SENTRY_AUTH_TOKEN/preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[19]
  to   = module.vercel.vercel_project_environment_variable.this["POLAR_PREVIEW_ACCESS_TOKEN/preview"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[20]
  to   = module.vercel.vercel_project_environment_variable.this["NEXT_PUBLIC_FRONTEND_BASE_URL/production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[21]
  to   = module.vercel.vercel_project_environment_variable.this["NEXT_PUBLIC_SANDBOX_FRONTEND_BASE_URL/development,preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[22]
  to   = module.vercel.vercel_project_environment_variable.this["NEXT_PUBLIC_PRODUCT_LINK_BASE_URL/production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[23]
  to   = module.vercel.vercel_project_environment_variable.this["NEXT_PUBLIC_POSTHOG_HOST/development,preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[24]
  to   = module.vercel.vercel_project_environment_variable.this["NEXT_PUBLIC_SENTRY_ENABLED/development,preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[25]
  to   = module.vercel.vercel_project_environment_variable.this["NEXT_PUBLIC_GOOGLE_ANALYTICS_ID/development,preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[26]
  to   = module.vercel.vercel_project_environment_variable.this["NEXT_PUBLIC_GITHUB_INSTALLATION_URL/development,preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[27]
  to   = module.vercel.vercel_project_environment_variable.this["NEXT_PUBLIC_STRIPE_KEY/development,preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[28]
  to   = module.vercel.vercel_project_environment_variable.this["MCP_OAUTH2_CLIENT_ID/preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[29]
  to   = module.vercel.vercel_project_environment_variable.this["MCP_OAUTH2_CLIENT_SECRET/preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[30]
  to   = module.vercel.vercel_project_environment_variable.this["ATTIO_API_KEY/preview,production"]
}

moved {
  from = module.vercel.vercel_project_environment_variable.this[31]
  to   = module.vercel.vercel_project_environment_variable.this["ATTIO_STARTUP_LIST_ID/preview,production"]
}
