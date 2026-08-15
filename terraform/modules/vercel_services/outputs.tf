output "project_id" {
  description = "The ID of the Vercel Services project"
  value       = vercel_project.this.id
}

output "project_name" {
  description = "The name of the Vercel Services project"
  value       = vercel_project.this.name
}
