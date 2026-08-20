resource "tfe_variable_set" "credentials" {
  name         = "Shared Credentials"
  description  = "Provider credentials shared by every workspace"
  organization = "polar-sh"
  global       = true
}

resource "tfe_variable" "cloudflare_api_token" {
  key             = "CLOUDFLARE_API_TOKEN"
  category        = "env"
  description     = "Cloudflare API token for handling domain configuration"
  sensitive       = true
  variable_set_id = tfe_variable_set.credentials.id
}
