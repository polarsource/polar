resource "tfe_variable" "private_backoffice_test" {
  key             = "private_backoffice"
  category        = "terraform"
  description     = "Private Tailscale backoffice configuration for test"
  hcl             = true
  sensitive       = true
  value           = "null"
  variable_set_id = tfe_variable_set.test.id

  lifecycle {
    ignore_changes = [value]
  }
}

resource "tfe_variable" "public_backoffice_enabled_test" {
  key             = "public_backoffice_enabled"
  category        = "terraform"
  description     = "Keep public backoffice access during the Tailscale rollout"
  hcl             = true
  value           = "true"
  variable_set_id = tfe_variable_set.test.id

  lifecycle {
    ignore_changes = [value]
  }
}
