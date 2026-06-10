variable "queue_name" {
  description = "Full task SQS queue name. The producer addresses this queue by name, so the caller must match it."
  type        = string
}

variable "function_name" {
  description = "Lambda function name. Also bases the role, policy and log group names."
  type        = string
}

variable "image_uri" {
  description = "Container image URI the task Lambda runs."
  type        = string
}

variable "timeout_seconds" {
  description = "Lambda function timeout. Must stay below the queue visibility timeout."
  type        = number
  default     = 120
}

variable "memory_size" {
  description = "Lambda memory in MB."
  type        = number
  default     = 512
}

variable "reserved_concurrency" {
  description = "null leaves the function unreserved (-1). Bounds warm containers, and therefore DB connections."
  type        = number
  default     = 5
}

variable "max_retries" {
  description = "DLQ redrive maxReceiveCount is min(max_retries + 1, 5)."
  type        = number
  default     = 4
}

variable "batch_size" {
  description = "SQS event source mapping batch size."
  type        = number
  default     = 1
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

variable "secret_environment_variables" {
  description = "Secret environment variables for the task Lambda."
  type        = map(string)
  default     = {}
  sensitive   = true
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
