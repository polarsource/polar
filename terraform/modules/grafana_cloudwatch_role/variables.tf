variable "name" {
  description = "IAM role name."
  type        = string
}

variable "external_id" {
  description = "sts:ExternalId Grafana Cloud presents when assuming the IAM role."
  type        = string
}

variable "permissions_boundary_arn" {
  description = "Permissions boundary applied to the IAM role."
  type        = string
  default     = null
}

variable "tags" {
  description = "Tags applied to all created resources."
  type        = map(string)
  default     = {}
}
