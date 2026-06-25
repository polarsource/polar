locals {
  terraform_cloud = {
    organization = "polar-sh"
    role_name    = "terraform-cloud"

    workspaces = {
      production = {
        project   = "Production"
        workspace = "polar"
      }
      sandbox = {
        project   = "sandbox"
        workspace = "sandbox"
      }
      test = {
        project   = "test"
        workspace = "test"
      }
    }

    run_role_policy_arns = {
      administrator_access = "arn:aws:iam::aws:policy/AdministratorAccess"
    }
  }
}

provider "aws" {
  alias  = "production"
  region = "us-east-1"

  assume_role {
    role_arn = "arn:aws:iam::${local.workload_accounts.production.id}:role/${var.member_account_bootstrap_role_name}"
  }
}

provider "aws" {
  alias  = "sandbox"
  region = "us-east-1"

  assume_role {
    role_arn = "arn:aws:iam::${local.workload_accounts.sandbox.id}:role/${var.member_account_bootstrap_role_name}"
  }
}

provider "aws" {
  alias  = "test"
  region = "us-east-1"

  assume_role {
    role_arn = "arn:aws:iam::${local.workload_accounts.test.id}:role/${var.member_account_bootstrap_role_name}"
  }
}

module "terraform_cloud_run_role_production" {
  source = "../modules/terraform_cloud_run_role"
  providers = {
    aws = aws.production
  }

  role_name                    = local.terraform_cloud.role_name
  terraform_cloud_organization = local.terraform_cloud.organization
  terraform_cloud_project      = local.terraform_cloud.workspaces.production.project
  terraform_cloud_workspace    = local.terraform_cloud.workspaces.production.workspace
  policy_arns                  = local.terraform_cloud.run_role_policy_arns
}

module "terraform_cloud_run_role_sandbox" {
  source = "../modules/terraform_cloud_run_role"
  providers = {
    aws = aws.sandbox
  }

  role_name                    = local.terraform_cloud.role_name
  terraform_cloud_organization = local.terraform_cloud.organization
  terraform_cloud_project      = local.terraform_cloud.workspaces.sandbox.project
  terraform_cloud_workspace    = local.terraform_cloud.workspaces.sandbox.workspace
  policy_arns                  = local.terraform_cloud.run_role_policy_arns
}

module "terraform_cloud_run_role_test" {
  source = "../modules/terraform_cloud_run_role"
  providers = {
    aws = aws.test
  }

  role_name                    = local.terraform_cloud.role_name
  terraform_cloud_organization = local.terraform_cloud.organization
  terraform_cloud_project      = local.terraform_cloud.workspaces.test.project
  terraform_cloud_workspace    = local.terraform_cloud.workspaces.test.workspace
  policy_arns                  = local.terraform_cloud.run_role_policy_arns
}
