module "planetscale" {
  source = "../modules/planetscale_postgres"

  organization  = "polar"
  database      = "polar-test"
  app_role_name = "polar_test"
  region        = "aws-us-east-2"
  cluster_size  = "PS_10_AWS_ARM"
}
