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

resource "tfe_variable" "openai_api_key_sandbox" {
  key             = "openai_api_key_sandbox"
  category        = "terraform"
  description     = "OpenAI API Key for sandbox"
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

resource "tfe_variable" "backend_resend_api_key_sandbox" {
  key             = "backend_resend_api_key_sandbox"
  category        = "terraform"
  description     = "Resend API Key for sandbox"
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
