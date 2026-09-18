resource "vercel_project" "this" {
  name      = var.name
  framework = "services"

  build_machine_type           = var.build_machine_type
  resource_config              = var.resource_config
  preview_deployments_disabled = var.preview_deployments_disabled
  enable_preview_feedback      = var.enable_preview_feedback
  enable_production_feedback   = var.enable_production_feedback

  automatically_expose_system_environment_variables = true

  git_repository = {
    type              = "github"
    repo              = var.git_repo
    production_branch = var.production_branch
  }

  lifecycle {
    ignore_changes = [environment]
  }
}

locals {
  environment_variable_names = nonsensitive(toset(keys(var.environment_variables)))

  integration_ids = {
    neon    = "icfg_biMWLfepTR29FamF2JyDnPzV"
    upstash = "icfg_JGYSjNyO8c1hpzKrjZdZhxUm"
  }
}

resource "vercel_integration_project_access" "this" {
  for_each = local.integration_ids

  integration_id = each.value
  project_id     = vercel_project.this.id
}

resource "vercel_project_environment_variable" "this" {
  for_each = local.environment_variable_names

  project_id = vercel_project.this.id
  key        = coalesce(var.environment_variables[each.key].key, each.key)
  value      = var.environment_variables[each.key].value
  target     = var.environment_variables[each.key].target
  sensitive  = var.environment_variables[each.key].sensitive
}
