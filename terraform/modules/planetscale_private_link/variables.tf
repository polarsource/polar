variable "name" {
  description = "Name for the endpoint and its security group."
  type        = string
}

variable "vpc_id" {
  description = "VPC to create the endpoint in."
  type        = string
}

variable "subnet_ids" {
  description = "Subnets for the endpoint network interfaces."
  type        = list(string)
}

variable "service_name" {
  description = "PlanetScale private connection service name for the branch."
  type        = string
}

variable "client_security_group_ids" {
  description = "Security groups allowed to connect on 5432 and 6432."
  type        = list(string)
}

variable "tags" {
  description = "Tags applied to created resources."
  type        = map(string)
  default     = {}
}
