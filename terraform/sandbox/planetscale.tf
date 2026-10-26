module "planetscale" {
  source = "../modules/planetscale_postgres"

  organization      = var.planetscale_organization
  database          = "polar-sandbox"
  app_database_name = "polar_sandbox"
  app_role_name     = "polar_sandbox"
  region            = "aws-us-east-2"
  cluster_size      = "PS_80_AWS_ARM"

  bouncers = {
    primary = {
      parameters = { pgbouncer = { default_pool_size = "12" } }
    }
  }
}

module "planetscale_migration" {
  source = "../modules/planetscale_migration"

  name                     = "polar-sandbox-planetscale-migration"
  subnet_id                = module.vpc.secondary_private_subnet_ids[0]
  instance_type            = "c7i.xlarge"
  volume_size              = 500
  volume_iops              = 3000
  permissions_boundary_arn = data.aws_iam_policy.permission_boundary.arn

  tags = {
    Environment = "sandbox"
    Service     = "planetscale-migration"
  }

  depends_on = [module.vpc]
}
