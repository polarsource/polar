# Bootstrap Sandbox variables

data "tfe_project" "sandbox" {
  name         = "sandbox"
  organization = "polar-sh"
}

resource "tfe_variable_set" "sandbox" {
  name              = "Sandbox Settings"
  description       = "Variables specific to the sandbox environment"
  organization      = "polar-sh"
  parent_project_id = data.tfe_project.sandbox.id
}

resource "tfe_variable" "google_client_id_sandbox" {
  key             = "google_client_id_sandbox"
  category        = "terraform"
  description     = "Google Client ID for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "google_client_secret_sandbox" {
  key             = "google_client_secret_sandbox"
  category        = "terraform"
  description     = "Google Client Secret for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "google_service_account_json_sandbox" {
  key             = "google_service_account_json"
  category        = "terraform"
  description     = "Google service account JSON key for fetching the organization review AUP for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "openai_api_key_sandbox" {
  key             = "openai_api_key_sandbox"
  category        = "terraform"
  description     = "OpenAI API Key for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "pydantic_ai_gateway_api_key_sandbox" {
  key             = "pydantic_ai_gateway_api_key_sandbox"
  category        = "terraform"
  description     = "Pydantic AI Gateway API Key for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "backend_current_jwk_kid_sandbox" {
  key             = "backend_current_jwk_kid_sandbox"
  category        = "terraform"
  description     = "Current JWK KID for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "backend_discord_bot_token_sandbox" {
  key             = "backend_discord_bot_token_sandbox"
  category        = "terraform"
  description     = "Discord Bot Token for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "backend_discord_client_id_sandbox" {
  key             = "backend_discord_client_id_sandbox"
  category        = "terraform"
  description     = "Discord Client ID for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "backend_discord_client_secret_sandbox" {
  key             = "backend_discord_client_secret_sandbox"
  category        = "terraform"
  description     = "Discord Client Secret for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "backend_discord_proxy_url_sandbox" {
  key             = "backend_discord_proxy_url"
  category        = "terraform"
  description     = "Discord Proxy URL for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "backend_resend_api_key_sandbox" {
  key             = "backend_resend_api_key_sandbox"
  category        = "terraform"
  description     = "Resend API Key for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "backend_resend_webhook_secret_sandbox" {
  key             = "backend_resend_webhook_secret"
  category        = "terraform"
  description     = "Resend Webhook Secret for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "backend_logo_dev_publishable_key_sandbox" {
  key             = "backend_logo_dev_publishable_key_sandbox"
  category        = "terraform"
  description     = "Logo.dev Publishable Key for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "backend_secret_sandbox" {
  key             = "backend_secret_sandbox"
  category        = "terraform"
  description     = "Backend Secret for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "backend_sentry_dsn_sandbox" {
  key             = "backend_sentry_dsn_sandbox"
  category        = "terraform"
  description     = "Sentry DSN for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "backend_jwks_sandbox" {
  key             = "backend_jwks_sandbox"
  category        = "terraform"
  description     = "Backend JWKS content for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "lambda_worker_tailscale_token_sandbox" {
  key             = "lambda_worker_tailscale_token"
  category        = "terraform"
  description     = "Tailscale auth token for sandbox Lambda workers"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "aws_access_key_id_sandbox" {
  key             = "aws_access_key_id_sandbox"
  category        = "terraform"
  description     = "AWS Access Key ID for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "aws_secret_access_key_sandbox" {
  key             = "aws_secret_access_key_sandbox"
  category        = "terraform"
  description     = "AWS Secret Access Key for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "s3_files_download_salt_sandbox" {
  key             = "s3_files_download_salt_sandbox"
  category        = "terraform"
  description     = "S3 Files Download Salt for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "s3_files_download_secret_sandbox" {
  key             = "s3_files_download_secret_sandbox"
  category        = "terraform"
  description     = "S3 Files Download Secret for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "github_client_id_sandbox" {
  key             = "github_client_id_sandbox"
  category        = "terraform"
  description     = "GitHub Client ID for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "github_client_secret_sandbox" {
  key             = "github_client_secret_sandbox"
  category        = "terraform"
  description     = "GitHub Client Secret for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "github_repository_benefits_app_identifier_sandbox" {
  key             = "github_repository_benefits_app_identifier_sandbox"
  category        = "terraform"
  description     = "GitHub Repository Benefits App Identifier for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "github_repository_benefits_app_namespace_sandbox" {
  key             = "github_repository_benefits_app_namespace_sandbox"
  category        = "terraform"
  description     = "GitHub Repository Benefits App Namespace for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "github_repository_benefits_app_private_key_sandbox" {
  key             = "github_repository_benefits_app_private_key_sandbox"
  category        = "terraform"
  description     = "GitHub Repository Benefits App Private Key for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "github_repository_benefits_client_id_sandbox" {
  key             = "github_repository_benefits_client_id_sandbox"
  category        = "terraform"
  description     = "GitHub Repository Benefits Client ID for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "github_repository_benefits_client_secret_sandbox" {
  key             = "github_repository_benefits_client_secret_sandbox"
  category        = "terraform"
  description     = "GitHub Repository Benefits Client Secret for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "stripe_connect_webhook_secret_sandbox" {
  key             = "stripe_connect_webhook_secret_sandbox"
  category        = "terraform"
  description     = "Stripe Connect Webhook Secret for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "stripe_secret_key_sandbox" {
  key             = "stripe_secret_key_sandbox"
  category        = "terraform"
  description     = "Stripe Secret Key for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "stripe_publishable_key_sandbox" {
  key             = "stripe_publishable_key_sandbox"
  category        = "terraform"
  description     = "Stripe Publishable Key for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "stripe_webhook_secret_sandbox" {
  key             = "stripe_webhook_secret_sandbox"
  category        = "terraform"
  description     = "Stripe Webhook Secret for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "stripe_account_risk_webhook_secret_sandbox" {
  key             = "stripe_account_risk_webhook_secret_sandbox"
  category        = "terraform"
  description     = "Stripe Account Risk Webhook Secret for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "numeral_api_key_sandbox" {
  key             = "numeral_api_key_sandbox"
  category        = "terraform"
  description     = "Numeral API Key for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "polar_access_token_sandbox" {
  key             = "polar_access_token"
  category        = "terraform"
  description     = "Polar API access token"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "polar_webhook_secret_sandbox" {
  key             = "polar_webhook_secret"
  category        = "terraform"
  description     = "Polar webhook secret"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "polar_organization_id_sandbox" {
  key             = "polar_organization_id"
  category        = "terraform"
  description     = "Polar organization ID"
  variable_set_id = tfe_variable_set.sandbox.id

  lifecycle {
    ignore_changes = [value]
  }
}

resource "tfe_variable" "polar_free_product_id_sandbox" {
  key             = "polar_free_product_id"
  category        = "terraform"
  description     = "Polar free-tier product ID"
  variable_set_id = tfe_variable_set.sandbox.id

  lifecycle {
    ignore_changes = [value]
  }
}

resource "tfe_variable" "polar_scale_product_id_sandbox" {
  key             = "polar_scale_product_id"
  category        = "terraform"
  description     = "Polar Scale-tier product ID for sandbox"
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "tinybird_api_token_sandbox" {
  key             = "tinybird_api_token"
  category        = "terraform"
  description     = "Tinybird API Token for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "tinybird_workspace_sandbox" {
  key             = "tinybird_workspace"
  category        = "terraform"
  description     = "Tinybird Workspace for sandbox"
  variable_set_id = tfe_variable_set.sandbox.id

  lifecycle {
    ignore_changes = [value]
  }
}

resource "tfe_variable" "tinybird_clickhouse_username_sandbox" {
  key             = "tinybird_clickhouse_username"
  category        = "terraform"
  description     = "Tinybird ClickHouse Username for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "tinybird_clickhouse_token_sandbox" {
  key             = "tinybird_clickhouse_token"
  category        = "terraform"
  description     = "Tinybird ClickHouse Token for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "tinybird_read_token_sandbox" {
  key             = "tinybird_read_token"
  category        = "terraform"
  description     = "Tinybird Read Token for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "customer_portal_url_overrides_sandbox" {
  key             = "customer_portal_url_overrides"
  category        = "terraform"
  description     = "JSON object mapping organization IDs to custom customer portal URLs for sandbox"
  sensitive       = false
  value           = "{}"
  variable_set_id = tfe_variable_set.sandbox.id

  lifecycle {
    ignore_changes = [value]
  }
}

resource "tfe_variable" "plain_default_tier_external_id_sandbox" {
  key             = "plain_default_tier_external_id"
  category        = "terraform"
  description     = "Default Plain tier external ID used as a fallback for the polar-self support benefit for sandbox"
  sensitive       = false
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "firecrawl_api_key_sandbox" {
  key             = "firecrawl_api_key"
  category        = "terraform"
  description     = "Firecrawl Cloud API key for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

# Vercel frontend
resource "tfe_variable" "vercel_stripe_publishable_key_sandbox" {
  key             = "stripe_publishable_key"
  category        = "terraform"
  description     = "Stripe publishable key for the Vercel sandbox frontend"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "vercel_stripe_publishable_key_preview_sandbox" {
  key             = "stripe_publishable_key_preview"
  category        = "terraform"
  description     = "Stripe publishable key for Vercel sandbox preview deployments"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "vercel_pydantic_ai_gateway_api_key_sandbox" {
  key             = "pydantic_ai_gateway_api_key"
  category        = "terraform"
  description     = "Pydantic AI Gateway API key for the Vercel sandbox frontend"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "vercel_gram_api_key_sandbox" {
  key             = "gram_api_key"
  category        = "terraform"
  description     = "Gram API key for the Vercel sandbox frontend"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "vercel_mintlify_assistant_api_key_sandbox" {
  key             = "mintlify_assistant_api_key"
  category        = "terraform"
  description     = "Mintlify assistant API key for the Vercel sandbox frontend"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "vercel_mcp_oauth2_client_id_sandbox" {
  key             = "mcp_oauth2_client_id"
  category        = "terraform"
  description     = "MCP OAuth2 client ID for the Vercel sandbox frontend"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "vercel_mcp_oauth2_client_secret_sandbox" {
  key             = "mcp_oauth2_client_secret"
  category        = "terraform"
  description     = "MCP OAuth2 client secret for the Vercel sandbox frontend"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "vercel_sentry_auth_token_sandbox" {
  key             = "sentry_auth_token"
  category        = "terraform"
  description     = "Sentry auth token for the Vercel sandbox frontend build"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "vercel_polar_preview_access_token_sandbox" {
  key             = "polar_preview_access_token"
  category        = "terraform"
  description     = "Polar preview access token for the Vercel sandbox frontend"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "vercel_next_public_sentry_dsn_sandbox" {
  key             = "next_public_sentry_dsn"
  category        = "terraform"
  description     = "Sentry DSN for the Vercel sandbox frontend"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "vercel_next_public_posthog_token_sandbox" {
  key             = "next_public_posthog_token"
  category        = "terraform"
  description     = "PostHog token for the Vercel sandbox frontend"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "vercel_next_public_apple_domain_association_sandbox" {
  key             = "next_public_apple_domain_association"
  category        = "terraform"
  description     = "Apple Pay domain association for the Vercel sandbox frontend"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "vercel_next_public_stripe_payment_method_configuration_sandbox" {
  key             = "next_public_stripe_payment_method_configuration"
  category        = "terraform"
  description     = "Stripe payment method configuration ID for the Vercel sandbox frontend"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "worker_sqs_actors_sandbox" {
  key             = "worker_sqs_actors"
  category        = "terraform"
  description     = "JSON array of Dramatiq actor names routed to the SQS execution engine for sandbox"
  sensitive       = false
  value           = "[\"dummy\"]"
  variable_set_id = tfe_variable_set.sandbox.id

  lifecycle {
    ignore_changes = [value]
  }
}

resource "tfe_variable" "stripe_app_client_id_sandbox" {
  key             = "stripe_app_client_id"
  category        = "terraform"
  description     = "Stripe App OAuth client ID for sandbox"
  sensitive       = false
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "stripe_app_client_link_id_sandbox" {
  key             = "stripe_app_client_link_id"
  category        = "terraform"
  description     = "Stripe App OAuth client link ID for sandbox"
  sensitive       = false
  variable_set_id = tfe_variable_set.sandbox.id
}

resource "tfe_variable" "turnstile_secret_sandbox" {
  key             = "turnstile_secret"
  category        = "terraform"
  description     = "Cloudflare Turnstile secret for sandbox"
  sensitive       = true
  variable_set_id = tfe_variable_set.sandbox.id
}
