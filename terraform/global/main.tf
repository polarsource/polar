provider "tfe" {
}

# tflint-ignore: terraform_unused_declarations
variable "apple_client_id" {
  type    = string
  default = null
}

# tflint-ignore: terraform_unused_declarations
variable "apple_team_id" {
  type    = string
  default = null
}

# tflint-ignore: terraform_unused_declarations
variable "apple_key_id" {
  type    = string
  default = null
}

# tflint-ignore: terraform_unused_declarations
variable "apple_key_value" {
  type    = string
  default = null
}

# tflint-ignore: terraform_unused_declarations
variable "ghcr_auth_token" {
  type    = string
  default = null
}

# tflint-ignore: terraform_unused_declarations
variable "ghcr_username" {
  type    = string
  default = null
}

resource "tfe_variable_set" "global" {
  name         = "Global Settings"
  description  = "For variables that are used in multiple or all environments"
  organization = "polar-sh"
  global       = true
}

resource "tfe_variable" "apple_client_id" {
  key             = "apple_client_id"
  category        = "terraform"
  description     = "Apple Client ID"
  sensitive       = true
  variable_set_id = tfe_variable_set.global.id
}

resource "tfe_variable" "apple_team_id" {
  key             = "apple_team_id"
  category        = "terraform"
  description     = "Apple Team ID"
  sensitive       = true
  variable_set_id = tfe_variable_set.global.id
}

resource "tfe_variable" "apple_key_id" {
  key             = "apple_key_id"
  category        = "terraform"
  description     = "Apple Key ID"
  sensitive       = true
  variable_set_id = tfe_variable_set.global.id
}

resource "tfe_variable" "apple_key_value" {
  key             = "apple_key_value"
  category        = "terraform"
  description     = "Apple Key Value"
  sensitive       = true
  variable_set_id = tfe_variable_set.global.id
}

resource "tfe_variable" "ghcr_auth_token" {
  key             = "ghcr_auth_token"
  category        = "terraform"
  description     = "GitHub Container Registry auth token"
  sensitive       = true
  variable_set_id = tfe_variable_set.global.id
}

resource "tfe_variable" "ghcr_username" {
  key             = "ghcr_username"
  category        = "terraform"
  description     = "GitHub username for GHCR authentication"
  sensitive       = true
  variable_set_id = tfe_variable_set.global.id
}

resource "tfe_variable" "render_api_key" {
  key             = "RENDER_API_KEY"
  category        = "env"
  description     = "Render API Key"
  sensitive       = true
  variable_set_id = tfe_variable_set.global.id
}

resource "tfe_variable" "render_owner_id" {
  key             = "RENDER_OWNER_ID"
  value           = "tea-ch0f74hjvhtkjjvvhnr0"
  category        = "env"
  description     = "Render Owner ID"
  variable_set_id = tfe_variable_set.global.id
}

resource "tfe_variable" "tfc_aws_provider_auth" {
  key             = "TFC_AWS_PROVIDER_AUTH"
  value           = "true"
  category        = "env"
  description     = "Enable AWS provider authentication via OIDC"
  variable_set_id = tfe_variable_set.global.id
}

resource "tfe_variable" "tfc_aws_run_role_arn" {
  key             = "TFC_AWS_RUN_ROLE_ARN"
  value           = "arn:aws:iam::975049931254:role/terraform-cloud"
  category        = "env"
  description     = "AWS IAM Role ARN for Terraform Cloud runs"
  variable_set_id = tfe_variable_set.global.id
}

resource "tfe_variable" "prometheus_remote_write_url" {
  key             = "prometheus_remote_write_url"
  category        = "terraform"
  description     = "Prometheus Remote Write URL"
  sensitive       = true
  variable_set_id = tfe_variable_set.global.id
}

resource "tfe_variable" "prometheus_remote_write_username" {
  key             = "prometheus_remote_write_username"
  category        = "terraform"
  description     = "Prometheus Remote Write Username"
  sensitive       = true
  variable_set_id = tfe_variable_set.global.id
}

resource "tfe_variable" "prometheus_remote_write_password" {
  key             = "prometheus_remote_write_password"
  category        = "terraform"
  description     = "Prometheus Remote Write Password"
  sensitive       = true
  variable_set_id = tfe_variable_set.global.id
}

resource "tfe_variable" "prometheus_remote_write_interval" {
  key             = "prometheus_remote_write_interval"
  category        = "terraform"
  description     = "How often to write metrics to Prometheus"
  sensitive       = false
  variable_set_id = tfe_variable_set.global.id
  value           = 60
}

resource "tfe_variable" "cloudflare_api_token" {
  key             = "CLOUDFLARE_API_TOKEN"
  category        = "env"
  description     = "Cloudflare API token for handling domain configuration"
  sensitive       = true
  variable_set_id = tfe_variable_set.global.id
}

resource "tfe_variable" "vercel_api_token" {
  key             = "VERCEL_API_TOKEN"
  category        = "env"
  description     = "Vercel API token"
  sensitive       = true
  variable_set_id = tfe_variable_set.global.id
}
