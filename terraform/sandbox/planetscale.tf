module "planetscale" {
  source = "../modules/planetscale_postgres"

  organization      = var.planetscale_organization
  database          = "polar-sandbox"
  app_database_name = "polar_sandbox"
  app_role_name     = "polar_sandbox"
  region            = "aws-us-east-2"
  cluster_size      = "PS_80_AWS_ARM"

  storage = {
    storage_iops            = 6000
    storage_throughput_mibs = 250
  }

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
    host               = module.planetscale.host
    port               = "6432"
    user               = module.planetscale.bouncer_usernames["app"]
    password           = var.planetscale_app_password
    read_host          = module.planetscale.host
    read_port          = "6432"
    read_user          = module.planetscale.bouncer_usernames["read"]
    read_password      = var.planetscale_app_password
    migration_user     = module.planetscale.migrator_role_username
    migration_password = var.planetscale_migrator_password
    sslmode            = "verify-full"
    sslrootcert        = "/etc/ssl/certs/ca-certificates.crt"
  }
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

module "planetscale_metrics" {
  source = "../modules/planetscale_metrics"

  environment              = "sandbox"
  organization             = var.planetscale_organization
  database                 = "polar-sandbox"
  token                    = var.planetscale_metrics_token
  cluster_arn              = module.ecs_cluster.cluster_arn
  vpc_id                   = module.vpc.vpc_id
  subnet_ids               = module.vpc.secondary_private_subnet_ids
  permissions_boundary_arn = data.aws_iam_policy.permission_boundary.arn

  prometheus = {
    url      = var.grafana_cloud_prometheus_url
    username = var.grafana_cloud_prometheus_username
    password = var.grafana_cloud_prometheus_password
  }
}
