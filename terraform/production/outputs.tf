output "render_project_id" {
  description = "The project ID for the Polar Render project. Used for the render_project data source."
  value       = render_project.polar.id
}

output "sandbox_environment_id" {
  description = "The Sandbox environment ID within the Polar project."
  value       = render_project.polar.environments["Sandbox"].id
}

output "test_environment_id" {
  description = "The Test environment ID within the Polar project."
  value       = render_project.polar.environments["Test"].id
}

output "postgres_id" {
  description = "The postgres ID. Used for the render_postgres data source."
  value       = render_postgres.db.id
}

output "redis_id" {
  description = "The Redis ID. Used for the render_redis data source."
  value       = render_redis.redis.id
}

output "redis_endpoint_service_name" {
  description = "VPC endpoint service name for the worker Redis. Provide to Render when creating the private link."
  value       = module.redis_private_link.service_name
}

output "grafana_cloudwatch_role_arn" {
  description = "IAM role ARN to provide in the Grafana Cloud CloudWatch scrape setup."
  value       = module.grafana_cloudwatch_role.role_arn
}
