locals {
  terraform_cloud_aws_run_role_name = "terraform-cloud"

  terraform_cloud_aws_workspaces = {
    organization = {
      account_id = "975049931254"
      workspace  = "organization"
    }
    production = {
      account_id = "538043300756"
      workspace  = "polar"
    }
    sandbox = {
      account_id = "427025827993"
      workspace  = "sandbox"
    }
    test = {
      account_id = "805865757777"
      workspace  = "test"
    }
  }
}

data "tfe_workspace_ids" "aws" {
  organization = "polar-sh"
  names = [
    for workspace in local.terraform_cloud_aws_workspaces :
    workspace.workspace
  ]
}

resource "tfe_variable" "tfc_aws_provider_auth" {
  for_each = local.terraform_cloud_aws_workspaces

  key         = "TFC_AWS_PROVIDER_AUTH"
  value       = "true"
  category    = "env"
  description = "Enable AWS provider authentication via OIDC."
  workspace_id = data.tfe_workspace_ids.aws.ids[
    each.value.workspace
  ]
}

resource "tfe_variable" "tfc_aws_run_role_arn" {
  for_each = local.terraform_cloud_aws_workspaces

  key         = "TFC_AWS_RUN_ROLE_ARN"
  value       = "arn:aws:iam::${each.value.account_id}:role/${local.terraform_cloud_aws_run_role_name}"
  category    = "env"
  description = "AWS IAM role ARN for HCP Terraform runs."
  workspace_id = data.tfe_workspace_ids.aws.ids[
    each.value.workspace
  ]
}
