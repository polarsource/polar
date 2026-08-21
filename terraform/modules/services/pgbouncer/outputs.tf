output "host" {
  description = "Private DNS name of the PgBouncer service"
  value       = "${aws_service_discovery_service.this.name}.${var.namespace.name}"
}

output "port" {
  description = "Port PgBouncer listens on"
  value       = tostring(local.port)
}

output "security_group_id" {
  description = "Security group attached to the PgBouncer tasks"
  value       = aws_security_group.this.id
}
