# Bootstrap test variables

data "tfe_project" "test" {
  name         = "test"
  organization = "polar-sh"
}

resource "tfe_variable_set" "test" {
  name              = "Test Settings"
  description       = "Variables specific to the test environment"
  organization      = "polar-sh"
  parent_project_id = data.tfe_project.test.id
}

resource "tfe_variable" "google_client_id_test" {
  key             = "google_client_id"
  category        = "terraform"
  description     = "Google Client ID for test"
  sensitive       = true
  variable_set_id = tfe_variable_set.test.id
}

resource "tfe_variable" "google_client_secret_test" {
  key             = "google_client_secret"
  category        = "terraform"
  description     = "Google Client Secret for test"
  sensitive       = true
  variable_set_id = tfe_variable_set.test.id
}

resource "tfe_variable" "openai_api_key_test" {
  key             = "openai_api_key"
  category        = "terraform"
  description     = "OpenAI API Key for test"
  sensitive       = true
  variable_set_id = tfe_variable_set.test.id
}

resource "tfe_variable" "backend_current_jwk_kid_test" {
  key             = "backend_current_jwk_kid"
  category        = "terraform"
  description     = "Current JWK KID for test"
  sensitive       = true
  variable_set_id = tfe_variable_set.test.id
}

resource "tfe_variable" "backend_discord_bot_token_test" {
  key             = "backend_discord_bot_token"
  category        = "terraform"
  description     = "Discord Bot Token for test"
  sensitive       = true
  variable_set_id = tfe_variable_set.test.id
}

resource "tfe_variable" "backend_discord_client_id_test" {
  key             = "backend_discord_client_id"
  category        = "terraform"
  description     = "Discord Client ID for test"
  sensitive       = true
  variable_set_id = tfe_variable_set.test.id
}

resource "tfe_variable" "backend_discord_client_secret_test" {
  key             = "backend_discord_client_secret"
  category        = "terraform"
  description     = "Discord Client Secret for test"
  sensitive       = true
  variable_set_id = tfe_variable_set.test.id
}

resource "tfe_variable" "backend_resend_api_key_test" {
  key             = "backend_resend_api_key"
  category        = "terraform"
  description     = "Resend API Key for test"
  sensitive       = true
  variable_set_id = tfe_variable_set.test.id
}

resource "tfe_variable" "backend_logo_dev_publishable_key_test" {
  key             = "backend_logo_dev_publishable_key"
  category        = "terraform"
  description     = "Logo.dev Publishable Key for test"
  sensitive       = true
  variable_set_id = tfe_variable_set.test.id
}

resource "tfe_variable" "backend_secret_test" {
  key             = "backend_secret"
  category        = "terraform"
  description     = "Backend Secret for test"
  sensitive       = true
  variable_set_id = tfe_variable_set.test.id
}

resource "tfe_variable" "backend_sentry_dsn_test" {
  key             = "backend_sentry_dsn"
  category        = "terraform"
  description     = "Sentry DSN for test"
  sensitive       = true
  variable_set_id = tfe_variable_set.test.id
}

resource "tfe_variable" "backend_jwks_test" {
  key             = "backend_jwks"
  category        = "terraform"
  description     = "Backend JWKS content for test"
  sensitive       = true
  variable_set_id = tfe_variable_set.test.id
}

resource "tfe_variable" "aws_access_key_id_test" {
  key             = "aws_access_key_id"
  category        = "terraform"
  description     = "AWS Access Key ID for test"
  sensitive       = true
  variable_set_id = tfe_variable_set.test.id
}

resource "tfe_variable" "aws_secret_access_key_test" {
  key             = "aws_secret_access_key"
  category        = "terraform"
  description     = "AWS Secret Access Key for test"
  sensitive       = true
  variable_set_id = tfe_variable_set.test.id
}

resource "tfe_variable" "s3_files_download_salt_test" {
  key             = "s3_files_download_salt"
  category        = "terraform"
  description     = "S3 Files Download Salt for test"
  sensitive       = true
  variable_set_id = tfe_variable_set.test.id
}

resource "tfe_variable" "s3_files_download_secret_test" {
  key             = "s3_files_download_secret"
  category        = "terraform"
  description     = "S3 Files Download Secret for test"
  sensitive       = true
  variable_set_id = tfe_variable_set.test.id
}

resource "tfe_variable" "github_client_id_test" {
  key             = "github_client_id"
  category        = "terraform"
  description     = "GitHub Client ID for test"
  sensitive       = true
  variable_set_id = tfe_variable_set.test.id
}

resource "tfe_variable" "github_client_secret_test" {
  key             = "github_client_secret"
  category        = "terraform"
  description     = "GitHub Client Secret for test"
  sensitive       = true
  variable_set_id = tfe_variable_set.test.id
}

resource "tfe_variable" "github_repository_benefits_app_identifier_test" {
  key             = "github_repository_benefits_app_identifier"
  category        = "terraform"
  description     = "GitHub Repository Benefits App Identifier for test"
  sensitive       = true
  variable_set_id = tfe_variable_set.test.id
}

resource "tfe_variable" "github_repository_benefits_app_namespace_test" {
  key             = "github_repository_benefits_app_namespace"
  category        = "terraform"
  description     = "GitHub Repository Benefits App Namespace for test"
  sensitive       = true
  variable_set_id = tfe_variable_set.test.id
}

resource "tfe_variable" "github_repository_benefits_app_private_key_test" {
  key             = "github_repository_benefits_app_private_key"
  category        = "terraform"
  description     = "GitHub Repository Benefits App Private Key for test"
  sensitive       = true
  variable_set_id = tfe_variable_set.test.id
}

resource "tfe_variable" "github_repository_benefits_client_id_test" {
  key             = "github_repository_benefits_client_id"
  category        = "terraform"
  description     = "GitHub Repository Benefits Client ID for test"
  sensitive       = true
  variable_set_id = tfe_variable_set.test.id
}

resource "tfe_variable" "github_repository_benefits_client_secret_test" {
  key             = "github_repository_benefits_client_secret"
  category        = "terraform"
  description     = "GitHub Repository Benefits Client Secret for test"
  sensitive       = true
  variable_set_id = tfe_variable_set.test.id
}

resource "tfe_variable" "stripe_connect_webhook_secret_test" {
  key             = "stripe_connect_webhook_secret"
  category        = "terraform"
  description     = "Stripe Connect Webhook Secret for test"
  sensitive       = true
  variable_set_id = tfe_variable_set.test.id
}

resource "tfe_variable" "stripe_secret_key_test" {
  key             = "stripe_secret_key"
  category        = "terraform"
  description     = "Stripe Secret Key for test"
  sensitive       = true
  variable_set_id = tfe_variable_set.test.id
}

resource "tfe_variable" "stripe_publishable_key_test" {
  key             = "stripe_publishable_key"
  category        = "terraform"
  description     = "Stripe Publishable Key for test"
  sensitive       = true
  variable_set_id = tfe_variable_set.test.id
}

resource "tfe_variable" "stripe_webhook_secret_test" {
  key             = "stripe_webhook_secret"
  category        = "terraform"
  description     = "Stripe Webhook Secret for test"
  sensitive       = true
  variable_set_id = tfe_variable_set.test.id
}

resource "tfe_variable" "logfire_token_server_test" {
  key             = "logfire_token_server"
  category        = "terraform"
  description     = "Logfire Token for server"
  sensitive       = true
  variable_set_id = tfe_variable_set.test.id
}

resource "tfe_variable" "logfire_token_worker_test" {
  key             = "logfire_token_worker"
  category        = "terraform"
  description     = "Logfire Token for worker"
  sensitive       = true
  variable_set_id = tfe_variable_set.test.id
}
