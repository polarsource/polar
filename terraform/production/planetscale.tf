import {
  to = module.planetscale.planetscale_postgres_dedicated_read_replica.this["analytics"]
  id = jsonencode({
    organization = var.planetscale_organization
    database     = "polar-production"
    branch       = "main"
    name         = "analytics"
  })
}

module "planetscale" {
  source = "../modules/planetscale_postgres"

  organization      = var.planetscale_organization
  database          = "polar-production"
  app_database_name = "polar_production"
  app_role_name     = "polar_production"
  region            = "aws-us-east-2"
  cluster_size      = "M8_640_AWS_ARM_D_METAL_1875"

  dedicated_read_replicas = {
    analytics = {
      cluster_size = "PS_640_AWS_ARM"
    }
  }

  bouncers = {
    app = {
      parameters = {
        pgbouncer = {
          default_pool_size      = "200"
          max_client_conn        = "1000"
          track_extra_parameters = "IntervalStyle,statement_timeout"
        }
      }
    }
    read = {
      target = "replica"
      parameters = {
        pgbouncer = {
          default_pool_size      = "50"
          max_client_conn        = "200"
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
    read_user     = module.planetscale.bouncer_usernames["read"]
    read_password = var.planetscale_app_password
    sslmode       = "verify-full"
    sslrootcert   = "/etc/ssl/certs/ca-certificates.crt"
  }
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

module "planetscale_metrics" {
  source = "../modules/planetscale_metrics"

  environment              = "production"
  organization             = var.planetscale_organization
  database                 = "polar-production"
  token                    = var.planetscale_metrics_token
  cluster_arn              = module.ecs_cluster.cluster_arn
  vpc_id                   = module.vpc.vpc_id
  subnet_ids               = module.vpc.private_subnet_ids
  permissions_boundary_arn = data.aws_iam_policy.permission_boundary.arn

  prometheus = {
    url      = var.grafana_cloud_prometheus_url
    username = var.grafana_cloud_prometheus_username
    password = var.grafana_cloud_prometheus_password
  }
}
