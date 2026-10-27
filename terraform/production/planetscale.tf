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
  }
}
