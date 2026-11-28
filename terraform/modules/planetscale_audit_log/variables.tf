variable "name" {
  description = "Name of the Lambda function and its IAM role."
  type        = string
}

variable "organization" {
  description = "PlanetScale organization slug."
  type        = string
}

variable "token" {
  description = "PlanetScale service token with read_audit_logs."
  type        = string
  sensitive   = true
}

variable "bucket_name" {
  description = "S3 bucket, owned by the security account, the audit log entries are written to."
  type        = string
}

variable "permissions_boundary_arn" {
  description = "Permissions boundary attached to the Lambda IAM role."
  type        = string
}
