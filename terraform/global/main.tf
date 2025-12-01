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
