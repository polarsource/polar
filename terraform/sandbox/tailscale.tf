resource "aws_secretsmanager_secret" "ec2_tailscale" {
  name = "polar-sandbox-ec2-tailscale"

  tags = {
    Environment = "sandbox"
    Service     = "tailscale-router"
  }
}

resource "aws_secretsmanager_secret_version" "ec2_tailscale" {
  secret_id     = aws_secretsmanager_secret.ec2_tailscale.id
  secret_string = var.ec2_tailscale_authkey
}

module "ec2_tailscale" {
  source = "../modules/ec2_tailscale"

  name                          = "polar-sandbox-aws-router"
  subnet_id                     = module.vpc.secondary_private_subnet_ids[0]
  advertise_routes              = module.vpc.secondary_private_subnet_cidr_blocks
  tailscale_auth_key_secret_arn = aws_secretsmanager_secret.ec2_tailscale.arn
  permissions_boundary_arn      = data.aws_iam_policy.permission_boundary.arn

  tags = {
    Environment = "sandbox"
    Service     = "tailscale-router"
  }

  depends_on = [module.vpc, aws_secretsmanager_secret_version.ec2_tailscale]
}
