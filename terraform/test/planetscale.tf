module "planetscale" {
  source = "../modules/planetscale_postgres"

  organization       = var.planetscale_organization
  database           = "polar-test"
  app_database_name  = "polar_test"
  app_role_name      = "polar_test"
  region             = "aws-us-east-2"
  cluster_size       = "PS_10_AWS_ARM"
  deletion_protected = false

  storage = {
    storage_iops            = 3000
    storage_throughput_mibs = 125
    storage_autoscaling     = true
  }

  parameters = {
    pgconf = {
      max_connections = "50"
    }
    pgbouncer = {
      track_extra_parameters = "IntervalStyle,statement_timeout"
    }
  }
}

locals {
  planetscale_postgres_config = {
    host          = module.planetscale.host
    port          = "6432"
    user          = module.planetscale.app_role_username
    password      = var.planetscale_app_password
    read_host     = module.planetscale.host
    read_port     = "6432"
    read_user     = module.planetscale.app_role_username
    read_password = var.planetscale_app_password
    sslmode       = "verify-full"
    sslrootcert   = "/etc/ssl/certs/ca-certificates.crt"
  }
}

module "planetscale_private_link" {
  count  = local.test_enabled ? 1 : 0
  source = "../modules/planetscale_private_link"

  name                      = "polar-test-planetscale"
  vpc_id                    = module.vpc[0].vpc_id
  subnet_ids                = module.vpc[0].secondary_private_subnet_ids
  service_name              = module.planetscale.private_connection_service_name
  client_security_group_ids = [module.ec2_tailscale[0].security_group_id]

  tags = {
    Environment = "test"
    Service     = "planetscale"
  }
}

resource "cloudflare_dns_record" "planetscale_private_link" {
  count = local.test_enabled ? length(module.vpc[0].secondary_private_subnet_ids) : 0

  zone_id = "22bcd1b07ec25452aab472486bc8df94"
  name    = "db.internal.test.polar.sh"
  type    = "A"
  content = module.planetscale_private_link[0].ip_addresses[count.index]
  proxied = false
  ttl     = 300
}
