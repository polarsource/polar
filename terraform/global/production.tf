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

resource "tfe_variable" "backend_discord_webhook_url_production" {
  key             = "backend_discord_webhook_url_production"
  category        = "terraform"
  description     = "Discord Webhook URL for production"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "backend_loops_api_key_production" {
  key             = "backend_loops_api_key_production"
  category        = "terraform"
  description     = "Loops API Key for production"
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

resource "tfe_variable" "logfire_token_server" {
  key             = "logfire_token_server"
  category        = "terraform"
  description     = "Logfire Token for server"
  sensitive       = true
  variable_set_id = tfe_variable_set.production.id
}

resource "tfe_variable" "logfire_token_worker" {
  key             = "logfire_token_worker"
  category        = "terraform"
  description     = "Logfire Token for worker"
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
