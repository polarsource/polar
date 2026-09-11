resource "aws_secretsmanager_secret" "ec2_tailscale" {
  name = "polar-production-ec2-tailscale"

  tags = {
    Environment = "production"
    Service     = "tailscale-router"
  }
}

resource "aws_secretsmanager_secret_version" "ec2_tailscale" {
  secret_id     = aws_secretsmanager_secret.ec2_tailscale.id
  secret_string = var.ec2_tailscale_authkey
}

module "ec2_tailscale" {
  source = "../modules/ec2_tailscale"

  name                          = "polar-production-aws-router"
  subnet_id                     = module.vpc.private_subnet_ids[0]
  advertise_routes              = module.vpc.private_subnet_cidr_blocks
  tailscale_auth_key_secret_arn = aws_secretsmanager_secret.ec2_tailscale.arn
  permissions_boundary_arn      = data.aws_iam_policy.permission_boundary.arn

  tags = {
    Environment = "production"
    Service     = "tailscale-router"
  }

  depends_on = [module.vpc, aws_secretsmanager_secret_version.ec2_tailscale]
}
