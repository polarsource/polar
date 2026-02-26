variable "environment" {
  description = "Environment name"
  type        = string

  validation {
    condition     = contains(["production", "sandbox", "test"], var.environment)
    error_message = "Must be either \"production\", \"sandbox\" or \"test\"."
  }
}

variable "logs_bucket_name" {
  description = "Name of the S3 bucket containing span logs"
  type        = string
}
