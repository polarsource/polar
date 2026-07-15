locals {
  security_account = {
    name = "security"
    id   = "297245370456"
  }
}

resource "aws_organizations_account" "security" {
  name              = local.security_account.name
  email             = var.security_account_email
  parent_id         = aws_organizations_organizational_unit.security.id
  close_on_deletion = false

  tags = {
    purpose = "security"
  }

  lifecycle {
    prevent_destroy = true
  }
}
