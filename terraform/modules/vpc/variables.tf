variable "name" {
  description = "Name prefix applied to the VPC and its resources."
  type        = string
}

variable "cidr_block" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "secondary_cidr_block" {
  description = "Optional secondary CIDR block, with parallel private subnets in each availability zone."
  type        = string
  default     = null
}

variable "primary_private_subnets_enabled" {
  description = "Set to false to delete the primary-CIDR private subnets once workloads have moved to the secondary ones."
  type        = bool
  default     = true
}

variable "availability_zones" {
  description = "Availability zones for the public and private subnets. The first hosts the NAT gateway."
  type        = list(string)

  validation {
    condition     = length(var.availability_zones) > 0
    error_message = "availability_zones must contain at least one availability zone."
  }
}

variable "eip_allocation_id" {
  description = "Allocation ID of the Elastic IP attached to the NAT gateway."
  type        = string
}

variable "tags" {
  description = "Tags applied to all created resources."
  type        = map(string)
  default     = {}
}
