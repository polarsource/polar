output "host" {
  description = "Primary endpoint host for the Redis node."
  value       = aws_elasticache_cluster.this.cache_nodes[0].address
}

output "port" {
  description = "Redis port."
  value       = aws_elasticache_cluster.this.port
}

output "security_group_id" {
  description = "Security group attached to the cache."
  value       = aws_security_group.this.id
}
