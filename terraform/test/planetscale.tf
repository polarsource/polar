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
