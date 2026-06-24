provider "aws" {
  region = "us-east-1"
}

data "aws_organizations_organization" "current" {}

locals {
  management_account = {
    id = "975049931254"
  }

  workload_organizational_units = {
    production = {
      name = "Production"
    }
    sandbox = {
      name = "Sandbox"
    }
    test = {
      name = "Test"
    }
  }

  workload_accounts = {
    production = {
      id                  = "538043300756"
      name                = "production"
      email               = var.production_account_email
      organizational_unit = "production"
    }
    sandbox = {
      id                  = "427025827993"
      name                = "sandbox"
      email               = var.sandbox_account_email
      organizational_unit = "sandbox"
    }
    test = {
      id                  = "805865757777"
      name                = "test"
      email               = var.test_account_email
      organizational_unit = "test"
    }
  }

  root_id = data.aws_organizations_organization.current.roots[0].id
}

check "management_account" {
  assert {
    condition     = data.aws_organizations_organization.current.master_account_id == local.management_account.id
    error_message = "Terraform must run from the Polar management account (${local.management_account.id})."
  }
}

resource "aws_organizations_organizational_unit" "workloads" {
  name      = "Workloads"
  parent_id = local.root_id
}

resource "aws_organizations_organizational_unit" "workload" {
  for_each = local.workload_organizational_units

  name      = each.value.name
  parent_id = aws_organizations_organizational_unit.workloads.id
}

resource "aws_organizations_account" "workload" {
  for_each = local.workload_accounts

  name              = each.value.name
  email             = each.value.email
  parent_id         = aws_organizations_organizational_unit.workload[each.value.organizational_unit].id
  close_on_deletion = false

  tags = {
    environment = each.key
  }

  lifecycle {
    prevent_destroy = true
  }
}

import {
  to = aws_organizations_account.workload["production"]
  id = "538043300756"
}

import {
  to = aws_organizations_account.workload["sandbox"]
  id = "427025827993"
}

import {
  to = aws_organizations_account.workload["test"]
  id = "805865757777"
}
