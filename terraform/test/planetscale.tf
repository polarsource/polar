module "planetscale" {
  source = "../modules/planetscale_postgres"

  organization       = var.planetscale_organization
  database           = "polar-test"
  app_role_name      = "polar_test"
  region             = "aws-us-east-2"
  cluster_size       = "PS_10_AWS_ARM"
  deletion_protected = false
}
