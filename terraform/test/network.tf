# =============================================================================
# Shared Lambda networking
# =============================================================================

module "egress_ip" {
  count  = local.test_enabled ? 1 : 0
  source = "../modules/static_egress_ip"

  name = "polar-test-egress"
}

module "vpc" {
  count  = local.test_enabled ? 1 : 0
  source = "../modules/vpc"

  name               = "polar-test"
  availability_zones = ["us-east-2a", "us-east-2b", "us-east-2c"]
  eip_allocation_id  = module.egress_ip[0].allocation_id
}

resource "aws_security_group" "lambda" {
  count       = local.test_enabled ? 1 : 0
  name        = "polar-test-lambda"
  description = "Shared egress security group for test Lambdas."
  vpc_id      = module.vpc[0].vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

locals {
  lambda_subnet_ids         = local.test_enabled ? module.vpc[0].private_subnet_ids : []
  lambda_security_group_ids = local.test_enabled ? [aws_security_group.lambda[0].id] : []
}
