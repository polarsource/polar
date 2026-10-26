locals {
  parameters = merge(var.parameters, {
    pgconf = merge({ shared_preload_libraries = "pg_stat_statements" }, lookup(var.parameters, "pgconf", {}))
  })
}

resource "planetscale_postgres_branch" "this" {
  organization       = var.organization
  database           = var.database
  name               = var.branch
  region             = var.region
  cluster_size       = var.cluster_size
  major_version      = var.major_version
  parameters         = local.parameters
  deletion_protected = var.deletion_protected
}

resource "planetscale_postgres_redacted_branch_role" "app" {
  organization    = var.organization
  database        = var.database
  branch          = planetscale_postgres_branch.this.name
  name            = var.app_role_name
  inherited_roles = []
  successor       = "postgres"
}

resource "planetscale_postgres_bouncer" "this" {
  for_each = var.bouncers

  organization      = var.organization
  database          = var.database
  branch            = planetscale_postgres_branch.this.name
  name              = each.key
  target            = each.value.target
  bouncer_size      = each.value.size
  replicas_per_cell = each.value.replicas_per_cell
  parameters        = each.value.parameters
}
