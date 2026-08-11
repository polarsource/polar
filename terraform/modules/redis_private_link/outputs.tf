output "service_name" {
  description = "Endpoint service name to provide to Render when creating the private link."
  value       = aws_vpc_endpoint_service.this.service_name
}

output "nlb_security_group_id" {
  description = "Security group attached to the NLB, for ingress rules on the Redis side."
  value       = aws_security_group.nlb.id
}

output "target_ips" {
  description = "Redis node IPs currently registered on the target group."
  value       = data.dns_a_record_set.redis.addrs
}
