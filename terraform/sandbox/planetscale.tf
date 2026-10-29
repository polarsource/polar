module "planetscale" {
  source = "../modules/planetscale_postgres"

  organization      = var.planetscale_organization
  database          = "polar-sandbox"
  app_database_name = "polar_sandbox"
  app_role_name     = "polar_sandbox"
  region            = "aws-us-east-2"
  cluster_size      = "PS_80_AWS_ARM"

  parameters = {
    pgbouncer = {
      default_pool_size = "35"
    }
  }

  bouncers = {
    app = {
      parameters = {
        pgbouncer = {
          default_pool_size      = "12"
          track_extra_parameters = "IntervalStyle,statement_timeout"
        }
      }
    }
    read = {
      target = "replica"
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

module "planetscale_private_link" {
  source = "../modules/planetscale_private_link"

  name                      = "polar-sandbox-planetscale"
  vpc_id                    = module.vpc.vpc_id
  subnet_ids                = module.vpc.secondary_private_subnet_ids
  service_name              = module.planetscale.private_connection_service_name
  client_security_group_ids = [module.ec2_tailscale.security_group_id]

  tags = {
    Environment = "sandbox"
    Service     = "planetscale"
  }
}

resource "cloudflare_dns_record" "planetscale_private_link" {
  count = length(module.vpc.secondary_private_subnet_ids)

  zone_id = "22bcd1b07ec25452aab472486bc8df94"
  name    = "db.internal.sandbox.polar.sh"
  type    = "A"
  content = module.planetscale_private_link.ip_addresses[count.index]
  proxied = false
  ttl     = 300
}
