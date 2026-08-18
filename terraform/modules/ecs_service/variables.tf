variable "environment" {
  description = "Environment name"
  type        = string

  validation {
    condition     = contains(["production", "sandbox", "test"], var.environment)
    error_message = "Must be either \"production\", \"sandbox\" or \"test\"."
  }
}

variable "name" {
  description = "Short service name, combined into polar-{environment}-{name}."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.name))
    error_message = "Must contain only lowercase letters, digits and hyphens."
  }
}

variable "cluster_arn" {
  description = "ECS cluster the service runs in."
  type        = string
}

variable "image" {
  description = "Container image."
  type        = string
}

variable "command" {
  description = "Container command override."
  type        = list(string)
  default     = null
}

variable "profile" {
  description = "Preconfigured task size: tiny (256/512), small (512/1024), medium (1024/2048) or big (2048/4096). Mutually exclusive with cpu/memory."
  type        = string
  default     = null

  validation {
    condition     = var.profile == null ? true : contains(["tiny", "small", "medium", "big"], var.profile)
    error_message = "Must be either \"tiny\", \"small\", \"medium\" or \"big\"."
  }
}

variable "cpu" {
  description = "Task CPU units, set together with memory when profile is unset."
  type        = number
  default     = null
}

variable "memory" {
  description = "Task memory in MiB, set together with cpu when profile is unset."
  type        = number
  default     = null
}

variable "desired_count" {
  description = "Number of tasks to run."
  type        = number
  default     = 1
}

variable "container_port" {
  description = "Container port to expose, if any."
  type        = number
  default     = null
}

variable "environment_variables" {
  description = "Environment variables for the container."
  type        = map(string)
  default     = {}
}

variable "secrets" {
  description = "Environment variables injected from Secrets Manager, as name => secret ARN."
  type        = map(string)
  default     = {}
}

variable "subnet_ids" {
  description = "Subnets the tasks run in."
  type        = list(string)
}

variable "security_group_ids" {
  description = "Security groups attached to the tasks."
  type        = list(string)
}

variable "task_role_arn" {
  description = "IAM role assumed by the running task, if any."
  type        = string
  default     = null
}

variable "service_registry" {
  description = "Cloud Map service the tasks register in, if any. Wrapped in an object so the null-check stays decidable when the ARN is computed."
  type = object({
    arn = string
  })
  default = null
}

variable "repository_credentials" {
  description = "Secrets Manager secret with credentials for a private image registry, if any. Wrapped in an object so the null-check stays decidable when the ARN is computed."
  type = object({
    arn = string
  })
  default = null
}

variable "permissions_boundary_arn" {
  description = "Permissions boundary for the execution role."
  type        = string
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days."
  type        = number
  default     = 30
}

variable "tags" {
  description = "Tags applied to all created resources."
  type        = map(string)
  default     = {}
}
