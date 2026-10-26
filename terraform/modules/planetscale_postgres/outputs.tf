locals {
  app_role_sql_identifier = "\"${replace(planetscale_postgres_redacted_branch_role.app.base_username, "\"", "\"\"")}\""
  database_sql_identifier = "\"${replace(var.app_database_name, "\"", "\"\"")}\""
}

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

output "app_role_base_username" {
  description = "App role name for SQL grants and ownership, without the branch routing suffix."
  value       = planetscale_postgres_redacted_branch_role.app.base_username
}

output "database_name" {
  description = "PostgreSQL database name to connect to, distinct from the PlanetScale database slug."
  value       = var.app_database_name
}

output "app_role_setup_sql" {
  description = "Run as the default postgres role connected to database_name, which must already exist. Import objects and run migrations as the app role; existing objects retain their owners."
  value       = <<-SQL
    -- Run as the default postgres role connected to ${local.database_sql_identifier}.
    GRANT CONNECT, CREATE ON DATABASE ${local.database_sql_identifier} TO ${local.app_role_sql_identifier};
    GRANT USAGE, CREATE ON SCHEMA public TO ${local.app_role_sql_identifier};
  SQL
}

output "host" {
  description = "Connection host."
  value       = planetscale_postgres_redacted_branch_role.app.access_host_url
}

output "bouncer_usernames" {
  description = "App role username for each dedicated PgBouncer, keyed by bouncer name. Connect on port 6432."
  value       = { for name, _ in planetscale_postgres_bouncer.this : name => "${planetscale_postgres_redacted_branch_role.app.username}|${name}" }
}
