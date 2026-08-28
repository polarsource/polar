output "environment_groups" {
  description = "Named backend environment groups for deployment targets that preserve grouping."
  value       = local.environment_groups
  sensitive   = true
}

output "environment_variables" {
  description = "Non-secret backend environment variables shared across deployment targets."
  value       = nonsensitive(local.environment_variables)
}

output "secret_environment_variables" {
  description = "Secret backend environment variables shared across deployment targets."
  value       = local.secret_environment_variables
  sensitive   = true
}
