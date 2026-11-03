module "planetscale" {
  source = "../modules/planetscale_postgres"

  organization      = var.planetscale_organization
  database          = "polar-production"
  app_database_name = "polar_production"
  app_role_name     = "polar_production"
  region            = "aws-us-east-2"
  cluster_size      = "M8_640_AWS_ARM_D_METAL_1875"

  bouncers = {
    app = {
      parameters = {
        pgbouncer = {
          track_extra_parameters = "IntervalStyle,statement_timeout"
        }
      }
    }
    read = {
      target = "replica"
      parameters = {
        pgbouncer = {
          track_extra_parameters = "IntervalStyle,statement_timeout"
        }
      }
    }
  }
}

module "planetscale_migration" {
  source = "../modules/planetscale_migration"

  name                     = "polar-production-planetscale-migration"
  subnet_id                = module.vpc.private_subnet_ids[0]
  instance_type            = "c7i.4xlarge"
  volume_size              = 1000
  permissions_boundary_arn = data.aws_iam_policy.permission_boundary.arn

  tags = {
    Environment = "production"
    Service     = "planetscale-migration"
  }

  depends_on = [module.vpc]
}

module "planetscale_private_link" {
  source = "../modules/planetscale_private_link"

  name                      = "polar-production-planetscale"
  vpc_id                    = module.vpc.vpc_id
  subnet_ids                = module.vpc.private_subnet_ids
  service_name              = module.planetscale.private_connection_service_name
  client_security_group_ids = [module.ec2_tailscale.security_group_id]

  tags = {
    Environment = "production"
    Service     = "planetscale"
  }
}

resource "cloudflare_dns_record" "planetscale_private_link" {
  count = length(module.vpc.private_subnet_ids)

  zone_id = "22bcd1b07ec25452aab472486bc8df94"
  name    = "db.internal.polar.sh"
  type    = "A"
  content = module.planetscale_private_link.ip_addresses[count.index]
  proxied = false
  ttl     = 300
}
