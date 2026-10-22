output "branch_id" {
  description = "Branch ID."
  value       = planetscale_postgres_branch.this.id
}

output "html_url" {
  description = "PlanetScale console URL for the branch."
  value       = planetscale_postgres_branch.this.html_url
}

output "app_role_id" {
  description = "App role ID. Reset its password with `pscale role reset`."
  value       = planetscale_postgres_redacted_branch_role.app.id
}

output "app_role_username" {
  description = "App role username."
  value       = planetscale_postgres_redacted_branch_role.app.username
}

output "host" {
  description = "Connection host."
  value       = planetscale_postgres_redacted_branch_role.app.access_host_url
}
