output "host" {
  description = "Primary endpoint host for the Redis replication group."
  value       = aws_elasticache_replication_group.this.primary_endpoint_address
}

output "port" {
  description = "Redis port."
  value       = aws_elasticache_replication_group.this.port
}

output "security_group_id" {
  description = "Security group attached to the cache."
  value       = aws_security_group.this.id
}
