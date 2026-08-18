variable "environment" {
  description = "Environment name"
  type        = string

  validation {
    condition     = contains(["production", "sandbox", "test"], var.environment)
    error_message = "Must be either \"production\", \"sandbox\" or \"test\"."
  }
}

variable "vpc_id" {
  description = "VPC the service runs in."
  type        = string
}

variable "subnet_ids" {
  description = "Subnets the tasks run in."
  type        = list(string)
}

variable "cluster_arn" {
  description = "ECS cluster the service runs in."
  type        = string
}

variable "namespace" {
  description = "Cloud Map private DNS namespace the service registers in."
  type = object({
    id   = string
    name = string
  })
}

variable "client_security_group_ids" {
  description = "Security groups allowed to connect on port 5432."
  type        = list(string)
}

variable "permissions_boundary_arn" {
  description = "Permissions boundary for the task execution role."
  type        = string
}

variable "repository_credentials_arn" {
  description = "Secrets Manager secret with GHCR pull credentials."
  type        = string
}

variable "image" {
  description = "PgBouncer container image."
  type        = string
  default     = "ghcr.io/polarsource/polar-pgbouncer:latest"
}

variable "database" {
  description = "Postgres endpoint PgBouncer proxies to."
  type = object({
    host     = string
    port     = string
    user     = string
    password = string
  })
  sensitive = true
}
