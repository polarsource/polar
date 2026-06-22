variable "name" {
  description = "Name prefix applied to the VPC and its resources."
  type        = string
}

variable "cidr_block" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones for the private subnets. The first also hosts the NAT gateway's public subnet."
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
