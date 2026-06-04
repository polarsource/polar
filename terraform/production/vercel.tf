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

# --- Environment variable imports (adopt existing live vars) ---

import {
  to = module.vercel.vercel_project_environment_variable.this[0]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/4fa4BxjEIMLAzdAB"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[1]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/RAkt1FIv0NmFl3tV"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[2]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/C6AC2gG7GQeVlEBK"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[3]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/rSctw1DqAONjbFcp"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[4]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/Q8qmYYtiDxZ0XeFu"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[5]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/fMQsWonzffWywYou"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[6]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/9aMlLbvnxFONTZjQ"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[7]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/Fi0d7hBf3MgqV5f5"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[8]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/T78XUk6k1RxsVAgp"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[9]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/XdIaiZQuQITJfMvm"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[10]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/VdgyFQpcfsJ11VyO"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[11]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/gdG9LSJCBNIoAJQL"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[12]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/fDeTkyRntb0qTDlr"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[13]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/xrtpOhmYjci2Yywf"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[14]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/hHa1TNpephFGUWdk"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[15]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/3aJkKDlgmlIBvc2u"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[16]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/zKj3hvAneqD0QWJ3"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[17]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/vlRUnZhfuUitZdqX"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[18]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/U7awREzqtaL0WXP4"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[19]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/LVoLuF0txPBChAfT"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[20]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/6EwGF0i9P2PV4Fgv"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[21]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/zDrfJwGSuOqLSIxW"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[22]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/CpBwceFCfbsOZb0g"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[23]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/S77KmCrcYXOBecOA"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[24]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/X77SHKqLaZgGeHYe"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[25]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/UisYIh5lqPYpbxou"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[26]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/SOQHMFDvQttmegNI"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[27]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/r5lc9GtOAiiZyKMP"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[28]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/vpC4Vhp3JYeIermm"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[29]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/LzwwhyHXXTYcPN9w"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[30]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/5xVCEd1JYmQeyVCA"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[31]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/6E07M1Zs6ZallJFb"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[32]
  id = "prj_9YDPCLXAX2w3RJqbXV7F1c3cZi9F/cOVlRr8hf2lAd94n"
}
