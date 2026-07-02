data "aws_iam_policy" "permission_boundary" {
  name = "PolarPermissionBoundary"
}

module "secrets_kms" {
  source = "../modules/render_secrets_kms"

  environment              = "production"
  render_owner_id          = "tea-ch0f74hjvhtkjjvvhnr0"
  render_environment_id    = render_project.polar.environments["Production"].id
  permissions_boundary_arn = data.aws_iam_policy.permission_boundary.arn
}
