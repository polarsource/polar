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
      parameters = { pgbouncer = { default_pool_size = "12" } }
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
