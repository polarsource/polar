locals {
  sso_instance_arn      = local.production_legacy_sso_instance_arn
  sso_identity_store_id = local.production_legacy_sso_identity_store_id

  staff_target_accounts = {
    management = local.management_account.id
    production = local.workload_accounts.production.id
    sandbox    = local.workload_accounts.sandbox.id
    test       = local.workload_accounts.test.id
  }

  identity_center_groups = {
    awsadmins    = { display_name = "awsadmins@polar.sh" }
    awsengineers = { display_name = "awsengineers@polar.sh" }
    engineering  = { display_name = "engineering@polar.sh" }
    awsaccess    = { display_name = "awsaccess@polar.sh" }
  }

  access_tiers = {
    admin = {
      base_name          = "PolarAdmin"
      description        = "Unrestricted administrator access."
      managed_policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
      boundary           = false
      groups             = ["awsadmins"]
    }
    engineering = {
      base_name          = "PolarEngineering"
      description        = "Power-user access (no IAM/Organizations management) confined by the Polar permission boundary."
      managed_policy_arn = "arn:aws:iam::aws:policy/PowerUserAccess"
      boundary           = true
      groups             = ["awsengineers", "engineering"]
    }
    read_only = {
      base_name          = "PolarReadOnly"
      description        = "Read-only access across the account."
      managed_policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
      boundary           = false
      groups             = ["awsaccess"]
    }
  }

  account_permission_sets = merge([
    for tier_key, tier in local.access_tiers : {
      for account_key, account_id in local.staff_target_accounts :
      "${tier_key}-${account_key}" => {
        name               = "${tier.base_name}${title(account_key)}"
        description        = tier.description
        managed_policy_arn = tier.managed_policy_arn
        boundary           = tier.boundary
        groups             = tier.groups
        account_id         = account_id
      }
    }
  ]...)

  boundary_permission_sets = {
    for key, permission_set in local.account_permission_sets :
    key => permission_set if permission_set.boundary
  }

  account_permission_set_assignments = merge([
    for key, permission_set in local.account_permission_sets : {
      for group in permission_set.groups :
      "${key}-${group}" => {
        permission_set = key
        account_id     = permission_set.account_id
        group          = group
      }
    }
  ]...)
}

resource "aws_identitystore_group" "staff" {
  for_each = local.identity_center_groups

  identity_store_id = local.sso_identity_store_id
  display_name      = each.value.display_name
}

resource "aws_ssoadmin_permission_set" "account" {
  for_each = local.account_permission_sets

  name             = each.value.name
  description      = each.value.description
  instance_arn     = local.sso_instance_arn
  session_duration = "PT8H"
}

resource "aws_ssoadmin_managed_policy_attachment" "account" {
  for_each = local.account_permission_sets

  instance_arn       = local.sso_instance_arn
  managed_policy_arn = each.value.managed_policy_arn
  permission_set_arn = aws_ssoadmin_permission_set.account[each.key].arn
}

resource "aws_ssoadmin_permissions_boundary_attachment" "account" {
  for_each = local.boundary_permission_sets

  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.account[each.key].arn

  permissions_boundary {
    customer_managed_policy_reference {
      name = module.permission_boundary_management.policy_name
      path = "/"
    }
  }

  depends_on = [
    module.permission_boundary_management,
    module.permission_boundary_production,
    module.permission_boundary_sandbox,
    module.permission_boundary_test,
  ]
}

resource "aws_ssoadmin_account_assignment" "account" {
  for_each = local.account_permission_set_assignments

  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.account[each.value.permission_set].arn
  principal_id       = aws_identitystore_group.staff[each.value.group].group_id
  principal_type     = "GROUP"
  target_id          = each.value.account_id
  target_type        = "AWS_ACCOUNT"

  depends_on = [
    aws_ssoadmin_managed_policy_attachment.account,
    aws_ssoadmin_permissions_boundary_attachment.account,
    module.permission_boundary_management,
    module.permission_boundary_production,
    module.permission_boundary_sandbox,
    module.permission_boundary_test,
  ]
}
