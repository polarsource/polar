output "project_id" {
  description = "The ID of the Vercel project"
  value       = vercel_project.this.id
}

output "project_name" {
  description = "The name of the Vercel project"
  value       = vercel_project.this.name
}

output "domains" {
  description = "Custom domains attached to the project"
  value       = [for domain in vercel_project_domain.this : domain.domain]
}



