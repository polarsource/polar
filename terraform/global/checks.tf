# Variables set straight on a workspace, outside any variable set. Everything
# else reaches a workspace through a set, which `tfe_variable_set` already
# covers.
locals {
  declared_workspace_variables = {
    production = [
      tfe_variable.backend_chargebackstop_webhook_secret_production.key,
      tfe_variable.redis_private_link_host_production.key,
    ]
    sandbox = [tfe_variable.redis_private_link_host_sandbox.key]
    test    = [tfe_variable.redis_private_link_host_test.key]
  }

  workspace_variable_drift = {
    for environment, workspace in local.terraform_cloud_aws_workspaces :
    workspace.workspace => setsubtract(
      [for variable in data.tfe_variables.workspaces[environment].variables : variable.name],
      concat(
        [
          tfe_variable.tfc_aws_provider_auth[environment].key,
          tfe_variable.tfc_aws_run_role_arn[environment].key,
        ],
        lookup(local.declared_workspace_variables, environment, []),
      ),
    )
  }

  unmanaged_workspace_variables = {
    for workspace, names in local.workspace_variable_drift :
    workspace => names if length(names) > 0
  }
}

data "tfe_variables" "workspaces" {
  for_each = local.terraform_cloud_aws_workspaces

  workspace_id = data.tfe_workspace_ids.aws.ids[each.value.workspace]
}

# A variable nobody declares is a credential nobody watches. Declaring one
# widens the allowed set on its own, so there is no second list to keep.
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
