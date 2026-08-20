provider "tfe" {
}

resource "tfe_variable_set" "global" {
  name         = "Global Settings"
  description  = "For variables that are used in multiple or all environments"
  organization = "polar-sh"
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

resource "tfe_variable" "grafana_cloud_prometheus_url" {
  key             = "grafana_cloud_prometheus_url"
  category        = "terraform"
  description     = "Grafana Cloud Prometheus base URL (e.g. https://prometheus-prod-XX.grafana.net)"
  sensitive       = true
  variable_set_id = tfe_variable_set.global.id
}

resource "tfe_variable" "grafana_cloud_prometheus_username" {
  key             = "grafana_cloud_prometheus_username"
  category        = "terraform"
  description     = "Grafana Cloud Prometheus username (numeric stack ID)"
  sensitive       = true
  variable_set_id = tfe_variable_set.global.id
}

resource "tfe_variable" "grafana_cloud_prometheus_password" {
  key             = "grafana_cloud_prometheus_password"
  category        = "terraform"
  description     = "Grafana Cloud Prometheus write API key"
  sensitive       = true
  variable_set_id = tfe_variable_set.global.id
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

resource "tfe_variable" "logfire_token" {
  key             = "logfire_token"
  category        = "terraform"
  description     = "Logfire Token"
  sensitive       = true
  variable_set_id = tfe_variable_set.global.id
}
