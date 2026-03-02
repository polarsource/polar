variable "lambda_artifacts_bucket_arn" {
  description = "ARN of the Lambda artifacts S3 bucket"
  type        = string
}

variable "lambda_function_arns" {
  description = "ARNs of Lambda functions to manage"
  type        = list(string)
}


