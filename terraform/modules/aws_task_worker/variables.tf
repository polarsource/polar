variable "environment" {
  description = "Environment name used in the Lambda function name."
  type        = string

  validation {
    condition     = contains(["test", "sandbox", "production"], var.environment)
    error_message = "Environment must be one of: test, sandbox, production."
  }
}

variable "name" {
  description = "Short worker profile name used in the Lambda function name: polar-{environment}-worker-{name}."
  type        = string

  validation {
    condition     = can(regex("^[a-zA-Z0-9-_]+$", var.name))
    error_message = "Name must contain only letters, numbers, hyphens, and underscores."
  }

  validation {
    condition     = length("polar-production-worker-${var.name}") <= 64
    error_message = "Name is too long. polar-production-worker-{name} must be 64 characters or fewer."
  }
}

variable "queue_name" {
  description = "Full worker profile SQS queue name. The producer addresses this queue by name, so the caller must match it."
  type        = string
}

variable "queue_prefix" {
  description = "Shared prefix of all task queues in this environment. Grants the worker SendMessage on every sibling queue for cross-queue sub-enqueues; the pattern also matches sibling DLQs, which is accepted."
  type        = string
}

variable "image_uri" {
  description = "Container image URI the worker Lambda runs."
  type        = string
}

variable "image_command" {
  description = "Container image CMD override the worker Lambda runs."
  type        = list(string)
  default     = ["polar.worker.aws_lambda.handler"]
}

variable "timeout_seconds" {
  description = "Lambda function timeout. Must stay below the queue visibility timeout."
  type        = number
  default     = 120
}

variable "memory_size" {
  description = "Lambda memory in MB."
  type        = number
  default     = 2048
}

variable "reserved_concurrency" {
  description = "null leaves the function unreserved (-1). Bounds warm containers, and therefore DB connections."
  type        = number
  default     = 5
}

variable "max_retries" {
  description = "DLQ redrive maxReceiveCount is max_retries + 1. Backoffs past 12h are rescheduled via EventBridge Scheduler, which resets the SQS receive count, so this only bounds the in-queue retry climb before the handoff."
  type        = number
  default     = 20
  nullable    = false
}

variable "enabled" {
  description = "Event source mapping toggle. false provisions the worker dormant."
  type        = bool
  default     = true
}

variable "subnet_ids" {
  description = "Empty runs the Lambda outside a VPC."
  type        = list(string)
  default     = []
}

variable "security_group_ids" {
  description = "Lambda VPC security groups. Used only when subnet_ids is set."
  type        = list(string)
  default     = []
}

variable "environment_variables" {
  description = "Non-secret environment variables for the task Lambda."
  type        = map(string)
  default     = {}
}

variable "secrets_arn" {
  description = "Secrets Manager secret holding a JSON map of env vars, exported by the image bootstrap at cold start."
  type        = string
  default     = null
}

variable "secrets_version_id" {
  description = "Version ID of the secret. Exposed as an env var so rotations replace warm Lambda environments."
  type        = string
  default     = null
}

variable "kms_key_arn" {
  description = "KMS key the app uses for envelope encryption of stored secrets."
  type        = string
  default     = null
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days."
  type        = number
  default     = 14
}

variable "tags" {
  description = "Tags applied to all created resources."
  type        = map(string)
  default     = {}
}

variable "permissions_boundary_arn" {
  description = "Optional permissions boundary ARN to attach to the Lambda IAM role."
  type        = string
  default     = null
}
