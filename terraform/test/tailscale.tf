resource "aws_secretsmanager_secret" "ec2_tailscale" {
  count = local.test_enabled ? 1 : 0

  name = "polar-test-ec2-tailscale"

  tags = {
    Environment = "test"
    Service     = "tailscale-router"
  }

  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "ec2_tailscale" {
  count = local.test_enabled ? 1 : 0

  secret_id     = aws_secretsmanager_secret.ec2_tailscale[0].id
  secret_string = var.ec2_tailscale_authkey
}

module "ec2_tailscale" {
  count  = local.test_enabled ? 1 : 0
  source = "../modules/ec2_tailscale"

  name                          = "polar-test-aws-router"
  subnet_id                     = module.vpc[0].secondary_private_subnet_ids[0]
  advertise_routes              = module.vpc[0].secondary_private_subnet_cidr_blocks
  tailscale_auth_key_secret_arn = aws_secretsmanager_secret.ec2_tailscale[0].arn
  permissions_boundary_arn      = data.aws_iam_policy.permission_boundary.arn

  tags = {
    Environment = "test"
    Service     = "tailscale-router"
  }

  depends_on = [module.vpc, aws_secretsmanager_secret_version.ec2_tailscale]
}
