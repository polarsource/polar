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

variable "snapshot_retention_days" {
  description = "Days to retain automatic daily snapshots. 0 disables backups."
  type        = number
  default     = 7
}

variable "node_count" {
  description = "Number of nodes (primary + replicas). More than one enables multi-AZ with automatic failover."
  type        = number
  default     = 1
}

variable "node_type" {
  description = "ElastiCache node type."
  type        = string
  default     = "cache.t4g.micro"
}

variable "engine_version" {
  description = "Valkey engine version."
  type        = string
  default     = "9.1"
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
