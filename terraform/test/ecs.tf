module "ecs_cluster" {
  count  = local.test_enabled ? 1 : 0
  source = "../modules/ecs_cluster"

  environment = "test"
}
