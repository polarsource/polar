variable "environment" {
  description = "Environment name"
  type        = string

  validation {
    condition     = contains(["production", "sandbox", "test"], var.environment)
    error_message = "Must be either \"production\", \"sandbox\" or \"test\"."
  }
}

variable "name" {
  description = "Short name, combined into polar-{environment}-{name}."
  type        = string
}

variable "vpc_id" {
  description = "VPC the load balancer and target group live in."
  type        = string
}

variable "subnet_ids" {
  description = "Public subnets for the load balancer."
  type        = list(string)
}

variable "certificate_arn" {
  description = "ACM certificate for the HTTPS listener."
  type        = string
}

variable "target_port" {
  description = "Port the target containers listen on."
  type        = number
}

variable "health_check_path" {
  description = "HTTP health check path."
  type        = string
  default     = "/healthz"
}
