variable "name" {
  description = "Instance name and Tailscale hostname."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$", var.name))
    error_message = "name must be a DNS label of 1–63 lowercase letters, digits, or hyphens, without leading or trailing hyphens."
  }
}

variable "subnet_id" {
  description = "Subnet with outbound internet access for package installation and Tailscale."
  type        = string
}

variable "tailscale_auth_key_secret_arn" {
  description = "ARN of a Secrets Manager secret in the provider region whose SecretString is the raw Tailscale auth key."
  type        = string
}

variable "tailscale_auth_key_kms_key_arn" {
  description = "Customer-managed KMS key encrypting the auth key secret, if used."
  type        = string
  default     = null
}

variable "instance_type" {
  description = "EC2 instance type. Must support x86_64 when using the default AMI."
  type        = string
  default     = "t3.micro"
}

variable "ami_id" {
  description = "Optional Amazon Linux 2023 standard AMI ID. Defaults to the latest x86_64 AMI."
  type        = string
  default     = null
}

variable "associate_public_ip_address" {
  description = "Assign a public IPv4 address; requires a public subnet with an internet gateway."
  type        = bool
  default     = false
}

variable "root_volume_size" {
  description = "Encrypted gp3 root volume size in GiB."
  type        = number
  default     = 20
}

variable "tailscale_ssh" {
  description = "Enable Tailscale SSH. Access must be allowed by the tailnet SSH policy."
  type        = bool
  default     = true
}

variable "advertise_routes" {
  description = "IPv4 subnet CIDRs to advertise to the tailnet. Enables IP forwarding when non-empty."
  type        = list(string)
  default     = []

  validation {
    condition     = alltrue([for route in var.advertise_routes : can(cidrnetmask(route))])
    error_message = "advertise_routes must contain valid IPv4 CIDRs."
  }
}

variable "permissions_boundary_arn" {
  description = "Optional permissions boundary ARN for the instance IAM role."
  type        = string
  default     = null
}

variable "tags" {
  description = "Tags applied to created resources."
  type        = map(string)
  default     = {}
}
