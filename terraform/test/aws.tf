module "lambda_worker_ecr" {
  count  = local.test_enabled ? 1 : 0
  source = "../modules/ecr_repository"

  name = "polar-test-lambda-worker"
}

data "aws_iam_policy" "permission_boundary" {
  name = "PolarPermissionBoundary"
}

module "secrets_kms" {
  count  = local.test_enabled ? 1 : 0
  source = "../modules/render_secrets_kms"

  environment              = "test"
  render_owner_id          = "tea-ch0f74hjvhtkjjvvhnr0"
  render_environment_id    = local.environment_id
  permissions_boundary_arn = data.aws_iam_policy.permission_boundary.arn
}
