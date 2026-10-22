resource "planetscale_postgres_branch" "this" {
  organization       = var.organization
  database           = var.database
  name               = var.branch
  region             = var.region
  cluster_size       = var.cluster_size
  major_version      = var.major_version
  parameters         = var.parameters
  deletion_protected = true

  lifecycle {
    prevent_destroy = true
  }
}

resource "planetscale_postgres_redacted_branch_role" "app" {
  organization    = var.organization
  database        = var.database
  branch          = planetscale_postgres_branch.this.name
  name            = var.app_role_name
  inherited_roles = ["postgres"]
}
