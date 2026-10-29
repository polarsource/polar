output "endpoint_id" {
  description = "VPC endpoint ID."
  value       = aws_vpc_endpoint.this.id
}

output "security_group_id" {
  description = "Endpoint security group ID."
  value       = aws_security_group.this.id
}

output "ip_addresses" {
  description = "Endpoint IPs, one per subnet."
  value       = data.aws_network_interface.this[*].private_ip
}
