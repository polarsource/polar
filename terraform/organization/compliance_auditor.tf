locals {
  compliance_auditor = {
    role_name       = "compliance-auditor"
    issuer_url      = "https://api.freda.com/integrations/v1/oidc"
    organization_id = "d5b6a214-e636-42d2-95d0-7819d029fa5e"
  }

  compliance_auditor_subjects = ["*${local.compliance_auditor.organization_id}*"]

  compliance_auditor_member_role_arns = [
    for account_id in [
      local.workload_accounts.production.id,
      local.workload_accounts.sandbox.id,
      local.workload_accounts.test.id,
      local.identity_account.id,
      local.security_account.id,
    ] : "arn:aws:iam::${account_id}:role/${local.compliance_auditor.role_name}"
  ]
}

module "compliance_auditor_management" {
  source = "../modules/compliance_auditor"
  providers = {
    aws = aws
  }

  role_name           = local.compliance_auditor.role_name
  issuer_url          = local.compliance_auditor.issuer_url
  subjects            = local.compliance_auditor_subjects
  assumable_role_arns = local.compliance_auditor_member_role_arns
}

module "compliance_auditor_production" {
  source = "../modules/compliance_auditor"
  providers = {
    aws = aws.production
  }

  role_name                = local.compliance_auditor.role_name
  trusted_role_arn         = module.compliance_auditor_management.role_arn
  permissions_boundary_arn = module.permission_boundary_production.policy_arn
}

module "compliance_auditor_sandbox" {
  source = "../modules/compliance_auditor"
  providers = {
    aws = aws.sandbox
  }

  role_name                = local.compliance_auditor.role_name
  trusted_role_arn         = module.compliance_auditor_management.role_arn
  permissions_boundary_arn = module.permission_boundary_sandbox.policy_arn
}

module "compliance_auditor_test" {
  source = "../modules/compliance_auditor"
  providers = {
    aws = aws.test
  }

  role_name                = local.compliance_auditor.role_name
  trusted_role_arn         = module.compliance_auditor_management.role_arn
  permissions_boundary_arn = module.permission_boundary_test.policy_arn
}

module "compliance_auditor_identity" {
  source = "../modules/compliance_auditor"
  providers = {
    aws = aws.identity
  }

  role_name                = local.compliance_auditor.role_name
  trusted_role_arn         = module.compliance_auditor_management.role_arn
  permissions_boundary_arn = module.permission_boundary_identity.policy_arn
}

module "compliance_auditor_security" {
  source = "../modules/compliance_auditor"
  providers = {
    aws = aws.security
  }

  role_name                = local.compliance_auditor.role_name
  trusted_role_arn         = module.compliance_auditor_management.role_arn
  permissions_boundary_arn = module.permission_boundary_security.policy_arn
}
