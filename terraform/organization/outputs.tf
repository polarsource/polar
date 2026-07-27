output "management_account" {
  value = {
    id   = aws_organizations_organization.current.master_account_id
    name = aws_organizations_organization.current.master_account_name
  }
}

output "organizational_units" {
  value = {
    workloads = {
      id   = aws_organizations_organizational_unit.workloads.id
      name = aws_organizations_organizational_unit.workloads.name
    }
    workload_environments = {
      for key, organizational_unit in aws_organizations_organizational_unit.workload :
      key => {
        id   = organizational_unit.id
        name = organizational_unit.name
      }
    }
  }
}

output "workload_accounts" {
  value = {
    for key, account in aws_organizations_account.workload :
    key => {
      id                  = account.id
      name                = account.name
      organizational_unit = local.workload_accounts[key].organizational_unit
    }
  }
}

output "identity_account" {
  value = {
    id   = aws_organizations_account.identity.id
    name = aws_organizations_account.identity.name
  }
}

output "security_account" {
  value = {
    id   = aws_organizations_account.security.id
    name = aws_organizations_account.security.name
  }
}

output "terraform_cloud_run_roles" {
  value = {
    production = module.terraform_cloud_run_role_production.role_arn
    sandbox    = module.terraform_cloud_run_role_sandbox.role_arn
    test       = module.terraform_cloud_run_role_test.role_arn
    identity   = module.terraform_cloud_run_role_identity.role_arn
    security   = module.terraform_cloud_run_role_security.role_arn
  }
}

output "service_control_policies" {
  value = {
    for key, policy in aws_organizations_policy.service_control :
    key => {
      id          = policy.id
      name        = policy.name
      description = policy.description
    }
  }
}
