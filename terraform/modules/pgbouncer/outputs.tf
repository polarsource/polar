output "service_id" {
  description = "The ID of the PgBouncer service"
  value       = render_private_service.pgbouncer.id
}

output "host" {
  description = "Private-network hostname of the PgBouncer service"
  value       = render_private_service.pgbouncer.slug
}

output "port" {
  description = "Port PgBouncer listens on"
  value       = "5432"
}
