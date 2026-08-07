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

variable "cpu" {
  description = "Task CPU units."
  type        = number
  default     = 256
}

variable "memory" {
  description = "Task memory in MiB."
  type        = number
  default     = 512
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

variable "permissions_boundary_arn" {
  description = "Permissions boundary for the execution role."
  type        = string
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days."
  type        = number
  default     = 30
}
