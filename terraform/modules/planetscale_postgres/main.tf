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
