module "planetscale" {
  source = "../modules/planetscale_postgres"

  organization      = var.planetscale_organization
  database          = "polar-sandbox"
  app_database_name = "polar_sandbox"
  app_role_name     = "polar_sandbox"
  region            = "aws-us-east-2"
  cluster_size      = "PS_80_AWS_ARM"

  bouncers = {
    app = {
      parameters = {
        pgbouncer = {
          default_pool_size      = "12"
          track_extra_parameters = "IntervalStyle,statement_timeout"
        }
      }
    }
  }
}

locals {
  planetscale_postgres_config = {
    host          = module.planetscale.host
    port          = "6432"
    user          = module.planetscale.bouncer_usernames["app"]
    password      = var.planetscale_app_password
    read_host     = module.planetscale.host
    read_port     = "6432"
    read_user     = module.planetscale.bouncer_usernames["app"]
    read_password = var.planetscale_app_password
    sslmode       = "verify-full"
    sslrootcert   = "/etc/ssl/certs/ca-certificates.crt"
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
