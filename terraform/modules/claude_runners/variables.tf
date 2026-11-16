variable "environment" {
  description = "Environment name."
  type        = string

  validation {
    condition     = contains(["production", "sandbox", "test"], var.environment)
    error_message = "Must be either \"production\", \"sandbox\" or \"test\"."
  }
}

variable "cluster_arn" {
  description = "ECS cluster that runs the orchestrator and the session tasks."
  type        = string
}

variable "vpc_id" {
  description = "VPC dedicated to Claude sessions. Must have no peering or private links to other environments."
  type        = string
}

variable "subnet_ids" {
  description = "Private subnets, with NAT egress, for the orchestrator and session tasks."
  type        = list(string)
}

variable "image" {
  description = "Runner image built from infra/claude-runner."
  type        = string
}

variable "repository_credentials_arn" {
  description = "Secrets Manager secret holding {\"username\", \"password\"} for pulling the image from GHCR."
  type        = string
}

variable "environment_secret" {
  description = "Claude self-hosted environment secret. Stays on the orchestrator; session tasks only get single-use work orders."
  type        = string
  sensitive   = true
}

variable "tailscale_oauth_client_id" {
  description = "Tailscale OAuth client with Auth Keys write permission for tailscale_session_tag."
  type        = string
}

variable "tailscale_oauth_client_secret" {
  description = "Secret of tailscale_oauth_client_id."
  type        = string
  sensitive   = true
}

variable "tailscale_session_tag" {
  description = "Tag applied to each session's ephemeral tailnet node. The tailnet policy should let it reach only the Speakeasy gateway."
  type        = string
  default     = "tag:claude-session"
}

variable "speakeasy_gateway_url" {
  description = "HTTPS URL of the Speakeasy MCP gateway on the tailnet. Leave empty to start sessions without it."
  type        = string
  default     = ""

  validation {
    condition     = var.speakeasy_gateway_url == "" || can(regex("^https://[^/:]+(/.*)?$", var.speakeasy_gateway_url))
    error_message = "Must be an https:// URL on the default port, or empty."
  }
}

variable "session_cpu" {
  description = "Fargate CPU units for one session task, sidecars included."
  type        = number
  default     = 4096
}

variable "session_memory" {
  description = "Fargate memory in MiB for one session task, sidecars included."
  type        = number
  default     = 16384
}

variable "session_ephemeral_storage_gib" {
  description = "Task disk in GiB (21–200). Holds the checkout, node_modules, the uv venv and the databases."
  type        = number
  default     = 100
}

variable "capacity_provider" {
  description = "FARGATE, or FARGATE_SPOT to trade interruptions (the session resumes on a new task) for cost."
  type        = string
  default     = "FARGATE"

  validation {
    condition     = contains(["FARGATE", "FARGATE_SPOT"], var.capacity_provider)
    error_message = "Must be FARGATE or FARGATE_SPOT."
  }
}

variable "min_idle" {
  description = "Pre-warmed standby runners kept ready by the orchestrator. Each one is a running task you pay for."
  type        = number
  default     = 0
}

variable "release_idle_session_min" {
  description = "Minutes a session may sit idle before its task is released. It resumes on a fresh task at the next message."
  type        = number
  default     = 30
}

variable "kill_session_after_min" {
  description = "Hard ceiling on one task's lifetime, in minutes."
  type        = number
  default     = 480
}

variable "permissions_boundary_arn" {
  description = "Permissions boundary for every IAM role created here."
  type        = string
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days."
  type        = number
  default     = 14
}

variable "tags" {
  description = "Tags applied to created resources."
  type        = map(string)
  default     = {}
}
