variable "mcp_gateway_connector_oauth_client_secret" {
  description = "Tailscale OAuth client secret with Auth Keys write permission for tag:mcp-gateway-connector."
  type        = string
  sensitive   = true
  nullable    = false

  validation {
    condition     = length(trimspace(var.mcp_gateway_connector_oauth_client_secret)) > 0
    error_message = "Set the dedicated Tailscale OAuth client secret before deploying the connector."
  }
}

locals {
  mcp_gateway_connector_name = "polar-mcp-gateway-connector"
  mcp_gateway_connector_tags = {
    Environment = "production"
    Service     = "mcp-gateway-connector"
  }
}

data "aws_ssm_parameter" "mcp_gateway_connector_ami" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

resource "aws_secretsmanager_secret" "mcp_gateway_connector" {
  name = local.mcp_gateway_connector_name
  tags = local.mcp_gateway_connector_tags
}

resource "aws_secretsmanager_secret_version" "mcp_gateway_connector" {
  secret_id     = aws_secretsmanager_secret.mcp_gateway_connector.id
  secret_string = var.mcp_gateway_connector_oauth_client_secret
}

module "mcp_gateway_connector" {
  source = "../modules/ec2_tailscale"

  name                        = local.mcp_gateway_connector_name
  subnet_id                   = module.vpc.public_subnet_id
  instance_type               = "t4g.micro"
  ami_id                      = data.aws_ssm_parameter.mcp_gateway_connector_ami.value
  associate_public_ip_address = true
  advertise_connector         = true
  advertise_tags              = ["tag:mcp-gateway-connector"]
  tailscale_ssh               = false
  tailscale_oauth_secret_arn  = aws_secretsmanager_secret.mcp_gateway_connector.arn
  tailscale_version           = var.tailscale_version
  permissions_boundary_arn    = data.aws_iam_policy.permission_boundary.arn
  tags                        = local.mcp_gateway_connector_tags

  depends_on = [module.vpc, aws_secretsmanager_secret_version.mcp_gateway_connector]
}

module "mcp_gateway_connector_egress_ip" {
  source = "../modules/static_egress_ip"

  name = local.mcp_gateway_connector_name
  tags = local.mcp_gateway_connector_tags
}

resource "aws_eip_association" "mcp_gateway_connector" {
  allocation_id = module.mcp_gateway_connector_egress_ip.allocation_id
  instance_id   = module.mcp_gateway_connector.instance_id
}

output "mcp_gateway_connector_egress_cidr" {
  description = "Dedicated IPv4 CIDR to add to the Speakeasy custom-domain IP allowlist."
  value       = "${module.mcp_gateway_connector_egress_ip.public_ip}/32"
}
