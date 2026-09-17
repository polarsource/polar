locals {
  sso_instance_arn      = local.production_legacy_sso_instance_arn
  sso_identity_store_id = local.production_legacy_sso_identity_store_id

  staff_target_accounts = {
    management = local.management_account.id
    production = local.workload_accounts.production.id
    sandbox    = local.workload_accounts.sandbox.id
    test       = local.workload_accounts.test.id
    identity   = local.identity_account.id
    security   = local.security_account.id
  }

  staff_default_accounts = setsubtract(keys(local.staff_target_accounts), ["identity", "security"])

  identity_center_groups = {
    awsadmins    = { display_name = "AWS Access" }
    awsengineers = { display_name = "AWS Engineers" }
    engineering  = { display_name = "Engineering" }
    awsaccess    = { display_name = "AWS Read Only Access" }
    finance      = { display_name = "Finance" }
    executive    = { display_name = "Executive" }
  }

  access_tiers = {
    finance = {
      base_name          = "PolarFinance"
      description        = "Read-only billing and cost information."
      managed_policy_arn = "arn:aws:iam::aws:policy/AWSBillingReadOnlyAccess"
      extra_policy_arns  = []
      boundary           = false
      groups             = ["finance", "executive"]
      accounts           = ["management"]
    }
    admin = {
      base_name          = "PolarAdmin"
      description        = "Unrestricted administrator access."
      managed_policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
      extra_policy_arns  = []
      boundary           = false
      groups             = ["awsadmins"]
      accounts           = keys(local.staff_target_accounts)
    }
    engineering = {
      base_name          = "PolarEngineering"
      description        = "Power-user access (no IAM/Organizations management) confined by the Polar permission boundary."
      managed_policy_arn = "arn:aws:iam::aws:policy/PowerUserAccess"
      extra_policy_arns  = ["arn:aws:iam::aws:policy/IAMReadOnlyAccess"]
      boundary           = true
      groups             = ["awsengineers", "engineering"]
      accounts           = local.staff_default_accounts
    }
    read_only = {
      base_name          = "PolarReadOnly"
      description        = "Read-only access across the account."
      managed_policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
      extra_policy_arns  = []
      boundary           = false
      groups             = ["awsaccess"]
      accounts           = local.staff_default_accounts
    }
  }

  account_permission_sets = merge([
    for tier_key, tier in local.access_tiers : {
      for account_key in tier.accounts :
      "${tier_key}-${account_key}" => {
        name               = "${tier.base_name}${title(account_key)}"
        description        = tier.description
        managed_policy_arn = tier.managed_policy_arn
        extra_policy_arns  = tier.extra_policy_arns
        boundary           = tier.boundary
        groups             = tier.groups
        account_id         = local.staff_target_accounts[account_key]
      }
    }
  ]...)

  extra_permission_set_policies = merge([
    for key, permission_set in local.account_permission_sets : {
      for policy_arn in permission_set.extra_policy_arns :
      "${key}-${basename(policy_arn)}" => {
        permission_set     = key
        managed_policy_arn = policy_arn
      }
    }
  ]...)

  boundary_permission_sets = {
    for key, permission_set in local.account_permission_sets :
    key => permission_set if permission_set.boundary
  }

  identity_store_groups_by_name = {
    for group in data.aws_identitystore_groups.all.groups :
    group.display_name => group.group_id
  }

  staff_group_ids = {
    for key, group in local.identity_center_groups :
    key => lookup(local.identity_store_groups_by_name, group.display_name, null)
  }

  account_permission_set_assignments = merge([
    for key, permission_set in local.account_permission_sets : {
      for group in permission_set.groups :
      "${key}-${group}" => {
        permission_set = key
        account_id     = permission_set.account_id
        group          = group
      } if local.staff_group_ids[group] != null
    }
  ]...)
}

data "aws_identitystore_groups" "all" {
  identity_store_id = local.sso_identity_store_id
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

resource "aws_ssoadmin_managed_policy_attachment" "account_extra" {
  for_each = local.extra_permission_set_policies

  instance_arn       = local.sso_instance_arn
  managed_policy_arn = each.value.managed_policy_arn
  permission_set_arn = aws_ssoadmin_permission_set.account[each.value.permission_set].arn
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
  principal_id       = local.staff_group_ids[each.value.group]
  principal_type     = "GROUP"
  target_id          = each.value.account_id
  target_type        = "AWS_ACCOUNT"

  depends_on = [
    aws_ssoadmin_managed_policy_attachment.account,
    aws_ssoadmin_managed_policy_attachment.account_extra,
    aws_ssoadmin_permissions_boundary_attachment.account,
    module.permission_boundary_management,
    module.permission_boundary_production,
    module.permission_boundary_sandbox,
    module.permission_boundary_test,
  ]
}
