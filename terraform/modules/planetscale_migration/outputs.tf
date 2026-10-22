output "instance_id" {
  description = "EC2 instance ID. Connect with `aws ssm start-session --target <id>`."
  value       = aws_instance.this.id
}

output "private_ip" {
  description = "Instance's private VPC IPv4 address."
  value       = aws_instance.this.private_ip
}

output "security_group_id" {
  description = "Security group ID for additional rules, if needed."
  value       = aws_security_group.this.id
}
