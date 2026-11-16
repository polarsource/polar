# Claude Code self-hosted runners: one Fargate task per cloud session.
# See infra/claude-runner/README.md for the setup outside Terraform.

variable "claude_runners_enabled" {
  description = "Create the Claude self-hosted runner pilot."
  type        = bool
  default     = false
}

variable "claude_runner_image_tag" {
  description = "Tag of ghcr.io/polarsource/polar-claude-runner to run."
  type        = string
  default     = "latest"
}

variable "claude_runner_environment_secret" {
  description = "Secret of the sandbox self-hosted environment in claude.ai admin settings"
  type        = string
  sensitive   = true
  default     = ""
}

variable "claude_runner_tailscale_oauth_client_id" {
  description = "Tailscale OAuth client with Auth Keys write permission for tag:claude-session"
  type        = string
  default     = ""
}

variable "claude_runner_tailscale_oauth_client_secret" {
  description = "Secret of claude_runner_tailscale_oauth_client_id"
  type        = string
  sensitive   = true
  default     = ""
}

variable "claude_runner_ghcr_username" {
  description = "GitHub user whose token pulls the runner image from GHCR"
  type        = string
  default     = ""
}

variable "claude_runner_ghcr_token" {
  description = "GitHub token with read:packages for the runner image"
  type        = string
  sensitive   = true
  default     = ""
}

variable "speakeasy_gateway_url" {
  description = "HTTPS URL of the Speakeasy MCP gateway on the tailnet"
  type        = string
  default     = ""
}

locals {
  claude_runners_count = var.claude_runners_enabled ? 1 : 0
  claude_runners_tags = {
    Environment = "sandbox"
    Service     = "claude-runners"
  }
}

# A VPC of its own, with no peering or private links, so sessions cannot reach
# sandbox databases, Redis or the tailnet subnet router's routes.
module "claude_runners_egress_ip" {
  count  = local.claude_runners_count
  source = "../modules/static_egress_ip"

  name = "polar-sandbox-claude-runners-egress"
  tags = local.claude_runners_tags
}

module "claude_runners_vpc" {
  count  = local.claude_runners_count
  source = "../modules/vpc"

  name               = "polar-sandbox-claude-runners"
  cidr_block         = "10.30.0.0/16"
  availability_zones = ["us-east-2a", "us-east-2b", "us-east-2c"]
  eip_allocation_id  = module.claude_runners_egress_ip[0].allocation_id
  tags               = local.claude_runners_tags
}

resource "aws_secretsmanager_secret" "claude_runner_ghcr" {
  count = local.claude_runners_count
  name  = "polar-sandbox-claude-runner-ghcr"
  tags  = local.claude_runners_tags
}

resource "aws_secretsmanager_secret_version" "claude_runner_ghcr" {
  count     = local.claude_runners_count
  secret_id = aws_secretsmanager_secret.claude_runner_ghcr[0].id
  secret_string = jsonencode({
    username = var.claude_runner_ghcr_username
    password = var.claude_runner_ghcr_token
  })
}

module "claude_runners" {
  count  = local.claude_runners_count
  source = "../modules/claude_runners"

  environment                   = "sandbox"
  cluster_arn                   = module.ecs_cluster.cluster_arn
  vpc_id                        = module.claude_runners_vpc[0].vpc_id
  subnet_ids                    = module.claude_runners_vpc[0].private_subnet_ids
  image                         = "ghcr.io/polarsource/polar-claude-runner:${var.claude_runner_image_tag}"
  repository_credentials_arn    = aws_secretsmanager_secret.claude_runner_ghcr[0].arn
  environment_secret            = var.claude_runner_environment_secret
  tailscale_oauth_client_id     = var.claude_runner_tailscale_oauth_client_id
  tailscale_oauth_client_secret = var.claude_runner_tailscale_oauth_client_secret
  speakeasy_gateway_url         = var.speakeasy_gateway_url
  permissions_boundary_arn      = data.aws_iam_policy.permission_boundary.arn
  tags                          = local.claude_runners_tags

  depends_on = [aws_secretsmanager_secret_version.claude_runner_ghcr]
}
