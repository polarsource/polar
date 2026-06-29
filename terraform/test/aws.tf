module "lambda_worker_ecr" {
  count  = local.test_enabled ? 1 : 0
  source = "../modules/ecr_repository"

  name = "polar-test-lambda-worker"
}
