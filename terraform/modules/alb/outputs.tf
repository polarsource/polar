output "target_group_arn" {
  description = "Target group to register services in."
  value       = aws_lb_target_group.this.arn
}

output "security_group_id" {
  description = "Load balancer security group ID."
  value       = aws_security_group.this.id
}

output "dns_name" {
  description = "Load balancer DNS name."
  value       = aws_lb.this.dns_name
}

output "zone_id" {
  description = "Load balancer hosted zone ID for alias records."
  value       = aws_lb.this.zone_id
}
