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
