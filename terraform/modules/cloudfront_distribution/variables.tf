variable "name" {
  description = "Identifier used for naming resources"
  type        = string
}

variable "domain" {
  description = "Custom domain for the distribution (e.g. assets.polar.sh)"
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for DNS record creation"
  type        = string
}

variable "s3_bucket_id" {
  description = "ID of the S3 bucket to use as origin"
  type        = string
}

variable "s3_bucket_regional_domain_name" {
  description = "Regional domain name of the S3 bucket"
  type        = string
}

variable "s3_bucket_arn" {
  description = "ARN of the S3 bucket (for future OAC bucket policy)"
  type        = string
}

variable "price_class" {
  description = "CloudFront price class"
  type        = string
  default     = "PriceClass_100"
}

variable "lambda_function_associations" {
  description = "Lambda@Edge function associations for the default cache behavior"
  type = list(object({
    event_type   = string
    lambda_arn   = string
    include_body = optional(bool, false)
  }))
  default = []

  validation {
    condition = alltrue([
      for assoc in var.lambda_function_associations :
      contains(["viewer-request", "viewer-response", "origin-request", "origin-response"], assoc.event_type)
    ])
    error_message = "event_type must be one of: viewer-request, viewer-response, origin-request, origin-response"
  }
}
