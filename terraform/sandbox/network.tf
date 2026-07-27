# =============================================================================
# Shared Lambda networking
# =============================================================================

module "egress_ip" {
  source = "../modules/static_egress_ip"

  name = "polar-sandbox-egress"
}

module "vpc" {
  source = "../modules/vpc"

  name               = "polar-sandbox"
  availability_zones = ["us-east-2a", "us-east-2b", "us-east-2c"]
  eip_allocation_id  = module.egress_ip.allocation_id
}

resource "aws_security_group" "lambda" {
  name        = "polar-sandbox-lambda"
  description = "Shared egress security group for sandbox Lambdas."
  vpc_id      = module.vpc.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

locals {
  lambda_subnet_ids         = module.vpc.private_subnet_ids
  lambda_security_group_ids = [aws_security_group.lambda.id]
}
