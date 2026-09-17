variable "permissions_boundary_arn" {
  description = "Permission boundary for the S3 replication role."
  type        = string
}

variable "uploader_role_arns" {
  description = "Roles in other accounts allowed to upload backups."
  type        = list(string)
  default     = []
}
