data "tfe_workspace_ids" "all" {
  names        = ["*"]
  organization = "polar-sh"
}

data "tfe_variables" "workspaces" {
  for_each = data.tfe_workspace_ids.all.ids

  workspace_id = each.value
}

locals {
  oidc_workspace_variables = {
    for environment, workspace in local.terraform_cloud_aws_workspaces :
    workspace.workspace => [
      tfe_variable.tfc_aws_provider_auth[environment].key,
      tfe_variable.tfc_aws_run_role_arn[environment].key,
    ]
  }

  # Variables set straight on a workspace, outside any variable set. Everything
  # else reaches a workspace through a set, which `tfe_variable_set` covers.
  declared_workspace_variables = {
    polar = [
      tfe_variable.backend_chargebackstop_webhook_secret_production.key,
      tfe_variable.redis_private_link_host_production.key,
    ]
    sandbox = [tfe_variable.redis_private_link_host_sandbox.key]
    test    = [tfe_variable.redis_private_link_host_test.key]
  }

  workspace_variable_drift = {
    for workspace, workspace_variables in data.tfe_variables.workspaces :
    workspace => setsubtract(
      [for variable in workspace_variables.variables : variable.name],
      concat(
        lookup(local.oidc_workspace_variables, workspace, []),
        lookup(local.declared_workspace_variables, workspace, []),
      ),
    )
  }

  unmanaged_workspace_variables = {
    for workspace, names in local.workspace_variable_drift :
    workspace => names if length(names) > 0
  }
}

# A variable nobody declares is a credential nobody watches. The allowed keys
# are read off the resources, so renaming one propagates here.
check "workspace_variables_are_declared" {
  assert {
    condition = length(local.unmanaged_workspace_variables) == 0
    error_message = join(" ", [
      "Variables set on a workspace that no tfe_variable resource declares:",
      jsonencode(local.unmanaged_workspace_variables),
      "Declare them here, or delete them in Terraform Cloud — and revoke the",
      "credential at the vendor first, deleting the variable revokes nothing.",
    ])
  }
}
