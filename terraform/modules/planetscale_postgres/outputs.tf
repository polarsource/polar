output "branch_id" {
  description = "Branch ID."
  value       = planetscale_postgres_branch.this.id
}

output "html_url" {
  description = "PlanetScale console URL for the branch."
  value       = planetscale_postgres_branch.this.html_url
}
