variable "function_name" {
  description = "Name of the Lambda function"
  type        = string
}

variable "s3_bucket" {
  description = "S3 bucket containing the deployment package"
  type        = string
}

variable "s3_key" {
  description = "S3 key of the deployment package"
  type        = string
}

variable "s3_object_version" {
  description = "S3 object version of the deployment package"
  type        = string
}

variable "source_bucket_arn" {
  description = "ARN of the S3 bucket the Lambda will read from and write to"
  type        = string
}

variable "memory_size" {
  description = "Memory size in MB"
  type        = number
  default     = 512
}

variable "timeout" {
  description = "Timeout in seconds"
  type        = number
  default     = 30
}
