locals {
  identity_account = {
    name = "identity"
    id   = "986542260309"
  }
}

resource "aws_organizations_organizational_unit" "security" {
  name      = "Security"
  parent_id = local.root_id
}

resource "aws_organizations_account" "identity" {
  name              = local.identity_account.name
  email             = var.identity_account_email
  parent_id         = aws_organizations_organizational_unit.security.id
  close_on_deletion = false

  tags = {
    purpose = "identity"
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_organizations_delegated_administrator" "identity_center" {
  account_id        = aws_organizations_account.identity.id
  service_principal = "sso.amazonaws.com"
}

import {
  to = aws_organizations_account.identity
  id = "986542260309"
}
