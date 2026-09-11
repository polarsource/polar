output "instance_id" {
  description = "EC2 instance ID."
  value       = aws_instance.this.id
}

output "private_ip" {
  description = "Instance's private VPC IPv4 address."
  value       = aws_instance.this.private_ip
}

output "public_ip" {
  description = "Instance's public IPv4 address, if assigned."
  value       = aws_instance.this.public_ip
}

output "security_group_id" {
  description = "Security group ID for additional rules, if needed."
  value       = aws_security_group.this.id
}

output "iam_role_name" {
  description = "IAM role name for attaching workload-specific policies."
  value       = aws_iam_role.this.name
}

output "tailscale_hostname" {
  description = "Requested Tailscale hostname; Tailscale may add a suffix if it already exists."
  value       = var.name
}

output "advertise_routes" {
  description = "Subnet CIDRs advertised by the instance; these must be approved in the tailnet."
  value       = var.advertise_routes
}
