variable "name" {
  description = "Name used for the NLB, target group, and endpoint service."
  type        = string
}

variable "vpc_id" {
  description = "VPC the NLB and its security group live in."
  type        = string
}

variable "subnet_ids" {
  description = "Private subnets for the NLB."
  type        = list(string)
}

variable "redis_host" {
  description = "ElastiCache endpoint hostname to expose through the endpoint service."
  type        = string
}

variable "redis_port" {
  description = "Redis port."
  type        = number
  default     = 6379
}

variable "allowed_principals" {
  description = "AWS principal ARNs allowed to connect to the endpoint service (Render's, from the private link dialog)."
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags applied to all created resources."
  type        = map(string)
  default     = {}
}
