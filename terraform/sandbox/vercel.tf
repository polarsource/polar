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
    { key = "NEXT_PUBLIC_STRIPE_KEY", value = var.stripe_publishable_key_preview, target = ["preview"], sensitive = true },
    { key = "MCP_OAUTH2_CLIENT_ID", value = var.mcp_oauth2_client_id, target = ["production", "preview", "development"] },
    { key = "MCP_OAUTH2_CLIENT_SECRET", value = var.mcp_oauth2_client_secret, target = ["production", "preview", "development"] },
  ]
}

# --- Environment variable imports (adopt existing live vars) ---

import {
  to = module.vercel.vercel_project_environment_variable.this[0]
  id = "prj_HjPbSesm9rpLRPaK6bLOwVqQzQBD/w1NY4uqMF9RRJEQ4"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[1]
  id = "prj_HjPbSesm9rpLRPaK6bLOwVqQzQBD/28dvcKhgCADC0p13"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[2]
  id = "prj_HjPbSesm9rpLRPaK6bLOwVqQzQBD/4dyzp0AbpAz6c9K3"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[3]
  id = "prj_HjPbSesm9rpLRPaK6bLOwVqQzQBD/IdczbgDwiRTC2v6f"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[4]
  id = "prj_HjPbSesm9rpLRPaK6bLOwVqQzQBD/5mCAPYOHrZNEsXty"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[5]
  id = "prj_HjPbSesm9rpLRPaK6bLOwVqQzQBD/FySW8EWdhQzpyzKA"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[6]
  id = "prj_HjPbSesm9rpLRPaK6bLOwVqQzQBD/QAYtBfaZlKB4pTin"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[7]
  id = "prj_HjPbSesm9rpLRPaK6bLOwVqQzQBD/L4qbynrJFIyufUiH"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[8]
  id = "prj_HjPbSesm9rpLRPaK6bLOwVqQzQBD/bytc5jFrDw9ssXxt"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[9]
  id = "prj_HjPbSesm9rpLRPaK6bLOwVqQzQBD/VobDmxSUtP7adFLt"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[10]
  id = "prj_HjPbSesm9rpLRPaK6bLOwVqQzQBD/X3X8orv1KleBBo0r"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[11]
  id = "prj_HjPbSesm9rpLRPaK6bLOwVqQzQBD/vJhzDLNxPKJsd2Wp"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[12]
  id = "prj_HjPbSesm9rpLRPaK6bLOwVqQzQBD/iTAa5iIkwA9YODNZ"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[13]
  id = "prj_HjPbSesm9rpLRPaK6bLOwVqQzQBD/dbGdko2sXT89XX5Z"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[14]
  id = "prj_HjPbSesm9rpLRPaK6bLOwVqQzQBD/OBCQHn3zEiJO3IAs"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[15]
  id = "prj_HjPbSesm9rpLRPaK6bLOwVqQzQBD/EgQjfzlTK2qIKGHB"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[16]
  id = "prj_HjPbSesm9rpLRPaK6bLOwVqQzQBD/97nfHHz8Yp3jyhDP"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[17]
  id = "prj_HjPbSesm9rpLRPaK6bLOwVqQzQBD/lXOEP3o9Ba2vywVe"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[18]
  id = "prj_HjPbSesm9rpLRPaK6bLOwVqQzQBD/226bArwHf6cBkwQL"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[19]
  id = "prj_HjPbSesm9rpLRPaK6bLOwVqQzQBD/G8Hea1UtAUeyc7Op"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[20]
  id = "prj_HjPbSesm9rpLRPaK6bLOwVqQzQBD/GGmDCMw1PtlON5aO"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[21]
  id = "prj_HjPbSesm9rpLRPaK6bLOwVqQzQBD/AsZo1f5xvFesGTii"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[22]
  id = "prj_HjPbSesm9rpLRPaK6bLOwVqQzQBD/Y1MhbDdlM5AGmqQA"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[23]
  id = "prj_HjPbSesm9rpLRPaK6bLOwVqQzQBD/EC3UsI3H59QtadgB"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[24]
  id = "prj_HjPbSesm9rpLRPaK6bLOwVqQzQBD/TNVIdwsxp2x4uY0y"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[25]
  id = "prj_HjPbSesm9rpLRPaK6bLOwVqQzQBD/H3gjIuSxXosjhMAM"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[26]
  id = "prj_HjPbSesm9rpLRPaK6bLOwVqQzQBD/5EOd7Pn9ATsN2xg0"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[27]
  id = "prj_HjPbSesm9rpLRPaK6bLOwVqQzQBD/YxzqIpIRgF8vwtd2"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[28]
  id = "prj_HjPbSesm9rpLRPaK6bLOwVqQzQBD/2zLQorUoqHKTSpF9"
}

import {
  to = module.vercel.vercel_project_environment_variable.this[29]
  id = "prj_HjPbSesm9rpLRPaK6bLOwVqQzQBD/pKASdBbGCc9aMPFW"
}
