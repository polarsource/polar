variable "name" {
  description = "Resource name prefix. Must start with polar- to be passable under the permission boundary."
  type        = string

  validation {
    condition     = can(regex("^polar-[a-z0-9-]+$", var.name))
    error_message = "name must start with polar- and contain only lowercase letters, digits, or hyphens."
  }
}

variable "subnet_id" {
  description = "Private subnet with NAT egress. Allowlist the NAT IP on the source database."
  type        = string
}

variable "instance_type" {
  description = "c7i.xlarge for <100GB, c7i.2xlarge for 100-500GB, c7i.4xlarge for >500GB."
  type        = string
  default     = "c7i.xlarge"
}

variable "volume_size" {
  description = "io2 root volume size in GB."
  type        = number
  default     = 500

  validation {
    condition     = contains([500, 1000, 3000, 6000, 12000], var.volume_size)
    error_message = "volume_size must be one of: 500, 1000, 3000, 6000, 12000."
  }
}

variable "volume_iops" {
  description = "io2 provisioned IOPS. Defaults to a value scaled to volume_size."
  type        = number
  default     = null
}

variable "permissions_boundary_arn" {
  description = "Permissions boundary for the instance role."
  type        = string
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
