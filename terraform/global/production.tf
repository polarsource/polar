# Bootstrap Production variables

data "tfe_project" "production" {
  name         = "Production"
  organization = "polar-sh"
}

resource "tfe_variable_set" "production" {
  name              = "Production Settings"
  description       = "Variables specific to the production environment"
  organization      = "polar-sh"
  parent_project_id = data.tfe_project.production.id
}

resource "tfe_variable" "google_client_id_production" {
  key             = "google_client_id_production"
  category        = "terraform"
  description     = "Google Client ID for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "google_client_secret_production" {
  key             = "google_client_secret_production"
  category        = "terraform"
  description     = "Google Client Secret for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "openai_api_key_production" {
  key             = "openai_api_key_production"
  category        = "terraform"
  description     = "OpenAI API Key for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "pydantic_ai_gateway_api_key_production" {
  key             = "pydantic_ai_gateway_api_key_production"
  category        = "terraform"
  description     = "Pydantic AI Gateway API Key for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "backend_current_jwk_kid_production" {
  key             = "backend_current_jwk_kid_production"
  category        = "terraform"
  description     = "Current JWK KID for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "backend_discord_bot_token_production" {
  key             = "backend_discord_bot_token_production"
  category        = "terraform"
  description     = "Discord Bot Token for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "backend_discord_client_id_production" {
  key             = "backend_discord_client_id_production"
  category        = "terraform"
  description     = "Discord Client ID for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "backend_discord_client_secret_production" {
  key             = "backend_discord_client_secret_production"
  category        = "terraform"
  description     = "Discord Client Secret for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "backend_discord_proxy_url_production" {
  key             = "backend_discord_proxy_url"
  category        = "terraform"
  description     = "Discord Proxy URL for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "backend_discord_webhook_url_production" {
  key             = "backend_discord_webhook_url_production"
  category        = "terraform"
  description     = "Discord Webhook URL for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "backend_posthog_project_api_key_production" {
  key             = "backend_posthog_project_api_key_production"
  category        = "terraform"
  description     = "PostHog Project API Key for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "backend_resend_api_key_production" {
  key             = "backend_resend_api_key_production"
  category        = "terraform"
  description     = "Resend API Key for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "backend_resend_webhook_secret_production" {
  key             = "backend_resend_webhook_secret"
  category        = "terraform"
  description     = "Resend Webhook Secret for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "backend_logo_dev_publishable_key_production" {
  key             = "backend_logo_dev_publishable_key_production"
  category        = "terraform"
  description     = "Logo.dev Publishable Key for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "backend_secret_production" {
  key             = "backend_secret_production"
  category        = "terraform"
  description     = "Backend Secret for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "backend_sentry_dsn_production" {
  key             = "backend_sentry_dsn_production"
  category        = "terraform"
  description     = "Sentry DSN for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "backend_plain_request_signing_secret_production" {
  key             = "backend_plain_request_signing_secret_production"
  category        = "terraform"
  description     = "Plain Request Signing Secret for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "backend_plain_token_production" {
  key             = "backend_plain_token_production"
  category        = "terraform"
  description     = "Plain Token for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "backend_plain_chat_secret_production" {
  key             = "backend_plain_chat_secret_production"
  category        = "terraform"
  description     = "Plain Chat Secret for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "backend_jwks_production" {
  key             = "backend_jwks_production"
  category        = "terraform"
  description     = "Backend JWKS content for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "aws_access_key_id_production" {
  key             = "aws_access_key_id_production"
  category        = "terraform"
  description     = "AWS Access Key ID for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "aws_secret_access_key_production" {
  key             = "aws_secret_access_key_production"
  category        = "terraform"
  description     = "AWS Secret Access Key for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "s3_files_download_salt_production" {
  key             = "s3_files_download_salt_production"
  category        = "terraform"
  description     = "S3 Files Download Salt for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "s3_files_download_secret_production" {
  key             = "s3_files_download_secret_production"
  category        = "terraform"
  description     = "S3 Files Download Secret for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "github_client_id_production" {
  key             = "github_client_id_production"
  category        = "terraform"
  description     = "GitHub Client ID for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "github_client_secret_production" {
  key             = "github_client_secret_production"
  category        = "terraform"
  description     = "GitHub Client Secret for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "github_repository_benefits_app_identifier_production" {
  key             = "github_repository_benefits_app_identifier_production"
  category        = "terraform"
  description     = "GitHub Repository Benefits App Identifier for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "github_repository_benefits_app_namespace_production" {
  key             = "github_repository_benefits_app_namespace_production"
  category        = "terraform"
  description     = "GitHub Repository Benefits App Namespace for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "github_repository_benefits_app_private_key_production" {
  key             = "github_repository_benefits_app_private_key_production"
  category        = "terraform"
  description     = "GitHub Repository Benefits App Private Key for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "github_repository_benefits_client_id_production" {
  key             = "github_repository_benefits_client_id_production"
  category        = "terraform"
  description     = "GitHub Repository Benefits Client ID for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "github_repository_benefits_client_secret_production" {
  key             = "github_repository_benefits_client_secret_production"
  category        = "terraform"
  description     = "GitHub Repository Benefits Client Secret for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "stripe_connect_webhook_secret_production" {
  key             = "stripe_connect_webhook_secret_production"
  category        = "terraform"
  description     = "Stripe Connect Webhook Secret for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "stripe_secret_key_production" {
  key             = "stripe_secret_key_production"
  category        = "terraform"
  description     = "Stripe Secret Key for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "stripe_publishable_key_production" {
  key             = "stripe_publishable_key_production"
  category        = "terraform"
  description     = "Stripe Publishable Key for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "stripe_webhook_secret_production" {
  key             = "stripe_webhook_secret_production"
  category        = "terraform"
  description     = "Stripe Webhook Secret for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}



resource "tfe_variable" "backend_app_review_email" {
  key             = "backend_app_review_email"
  category        = "terraform"
  description     = "App review email for app store review login bypass"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "backend_app_review_otp_code" {
  key             = "backend_app_review_otp_code"
  category        = "terraform"
  description     = "App review OTP code for app store review login bypass"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "numeral_api_key_production" {
  key             = "numeral_api_key_production"
  category        = "terraform"
  description     = "Numeral API Key for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "tinybird_api_token_production" {
  key             = "tinybird_api_token"
  category        = "terraform"
  description     = "Tinybird API Token for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "tinybird_workspace_production" {
  key             = "tinybird_workspace"
  category        = "terraform"
  description     = "Tinybird Workspace for production"
  variable_set_id = tfe_variable_set.production.id

  lifecycle {
    ignore_changes = [value]
  }
}

resource "tfe_variable" "tinybird_clickhouse_username_production" {
  key             = "tinybird_clickhouse_username"
  category        = "terraform"
  description     = "Tinybird ClickHouse Username for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "tinybird_clickhouse_token_production" {
  key             = "tinybird_clickhouse_token"
  category        = "terraform"
  description     = "Tinybird ClickHouse Token for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "tinybird_read_token_production" {
  key             = "tinybird_read_token"
  category        = "terraform"
  description     = "Tinybird Read Token for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "polar_access_token_production" {
  key             = "polar_access_token"
  category        = "terraform"
  description     = "Polar API access token"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "polar_webhook_secret_production" {
  key             = "polar_webhook_secret"
  category        = "terraform"
  description     = "Polar webhook secret"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "polar_organization_id_production" {
  key             = "polar_organization_id"
  category        = "terraform"
  description     = "Polar organization ID"
  variable_set_id = tfe_variable_set.production.id

  lifecycle {
    ignore_changes = [value]
  }
}

resource "tfe_variable" "polar_free_product_id_production" {
  key             = "polar_free_product_id"
  category        = "terraform"
  description     = "Polar free-tier product ID"
  variable_set_id = tfe_variable_set.production.id

  lifecycle {
    ignore_changes = [value]
  }
}

resource "tfe_variable" "polar_scale_product_id_production" {
  key             = "polar_scale_product_id"
  category        = "terraform"
  description     = "Polar Scale-tier product ID for production"
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "customer_portal_url_overrides_production" {
  key             = "customer_portal_url_overrides"
  category        = "terraform"
  description     = "JSON object mapping organization IDs to custom customer portal URLs for production"
  sensitive       = false
  value           = "{}"
  variable_set_id = tfe_variable_set.production.id

  lifecycle {
    ignore_changes = [value]
  }
}

resource "tfe_variable" "tailscale_authkey_production" {
  key             = "tailscale_authkey"
  category        = "terraform"
  description     = "Tailscale auth key for the subnet router"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "tailscale_advertise_routes_production" {
  key             = "tailscale_advertise_routes"
  category        = "terraform"
  description     = "IP routes that should go via Tailscale for production"
  sensitive       = false
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "plain_default_tier_external_id_production" {
  key             = "plain_default_tier_external_id"
  category        = "terraform"
  description     = "Default Plain tier external ID used as a fallback for the polar-self support benefit for production"
  sensitive       = false
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "firecrawl_api_key_production" {
  key             = "firecrawl_api_key"
  category        = "terraform"
  description     = "Firecrawl Cloud API key for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

# Vercel frontend
resource "tfe_variable" "vercel_stripe_publishable_key_production" {
  key             = "stripe_publishable_key"
  category        = "terraform"
  description     = "Stripe publishable key for the Vercel production frontend"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "vercel_pydantic_ai_gateway_api_key_production" {
  key             = "pydantic_ai_gateway_api_key"
  category        = "terraform"
  description     = "Pydantic AI Gateway API key for the Vercel production frontend"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "vercel_gram_api_key_production" {
  key             = "gram_api_key"
  category        = "terraform"
  description     = "Gram API key for the Vercel production frontend"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "vercel_mintlify_assistant_api_key_production" {
  key             = "mintlify_assistant_api_key"
  category        = "terraform"
  description     = "Mintlify assistant API key for the Vercel production frontend"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "vercel_attio_api_key_production" {
  key             = "attio_api_key"
  category        = "terraform"
  description     = "Attio API key for the Vercel production frontend"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "vercel_attio_startup_list_id_production" {
  key             = "attio_startup_list_id"
  category        = "terraform"
  description     = "Attio startup list ID for the Vercel production frontend"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "vercel_mcp_oauth2_client_id_production" {
  key             = "mcp_oauth2_client_id"
  category        = "terraform"
  description     = "MCP OAuth2 client ID for the Vercel production frontend"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "vercel_mcp_oauth2_client_secret_production" {
  key             = "mcp_oauth2_client_secret"
  category        = "terraform"
  description     = "MCP OAuth2 client secret for the Vercel production frontend"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "vercel_sentry_auth_token_production" {
  key             = "sentry_auth_token"
  category        = "terraform"
  description     = "Sentry auth token for the Vercel production frontend build"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "vercel_polar_preview_access_token_production" {
  key             = "polar_preview_access_token"
  category        = "terraform"
  description     = "Polar preview access token for the Vercel production frontend"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "vercel_next_public_sentry_dsn_production" {
  key             = "next_public_sentry_dsn"
  category        = "terraform"
  description     = "Sentry DSN for the Vercel production frontend"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "vercel_next_public_posthog_token_production" {
  key             = "next_public_posthog_token"
  category        = "terraform"
  description     = "PostHog token for the Vercel production frontend"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "vercel_next_public_apple_domain_association_production" {
  key             = "next_public_apple_domain_association"
  category        = "terraform"
  description     = "Apple Pay domain association for the Vercel production frontend"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "vercel_next_public_stripe_payment_method_configuration_production" {
  key             = "next_public_stripe_payment_method_configuration"
  category        = "terraform"
  description     = "Stripe payment method configuration ID for the Vercel production frontend"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}
