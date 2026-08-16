resource "vercel_project" "this" {
  name      = var.name
  framework = "services"

  build_machine_type         = var.build_machine_type
  resource_config            = var.resource_config
  enable_preview_feedback    = var.enable_preview_feedback
  enable_production_feedback = var.enable_production_feedback

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
  environment_variable_group_names = nonsensitive(toset(keys(var.environment_variable_groups)))

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

resource "vercel_project_environment_variables" "this" {
  for_each = local.environment_variable_group_names

  project_id = vercel_project.this.id
  variables = [
    for name, variable in var.environment_variable_groups[each.key] : {
      key       = coalesce(variable.key, name)
      value     = variable.value
      target    = variable.target
      sensitive = variable.sensitive
    }
  ]
}
