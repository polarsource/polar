variable "name" {
  description = "Name used for the ElastiCache cluster, subnet group, and security group."
  type        = string
}

variable "vpc_id" {
  description = "VPC the cache and its security group live in."
  type        = string
}

variable "subnet_ids" {
  description = "Private subnets for the cache subnet group."
  type        = list(string)
}

variable "ingress_security_group_ids" {
  description = "Security groups allowed to reach Redis on the cache port."
  type        = list(string)
}

variable "node_type" {
  description = "ElastiCache node type."
  type        = string
  default     = "cache.t4g.micro"
}

variable "engine_version" {
  description = "Redis engine version."
  type        = string
  default     = "7.1"
}

variable "port" {
  description = "Redis port."
  type        = number
  default     = 6379
}

variable "tags" {
  description = "Tags applied to all created resources."
  type        = map(string)
  default     = {}
}
