output "lambda_worker_ecr_repository_url" {
  description = "ECR repository URL for the test Lambda worker image."
  value       = try(module.lambda_worker_ecr[0].repository_url, null)
}

output "redis_endpoint_service_name" {
  description = "VPC endpoint service name for the worker Redis. Provide to Render when creating the private link."
  value       = try(module.redis_private_link[0].service_name, null)
}

output "vercel_services_project_id" {
  description = "Vercel project ID for the full-stack Services test deployment."
  value       = module.vercel_services.project_id
}

output "grafana_cloudwatch_role_arn" {
  description = "IAM role ARN to provide in the Grafana Cloud CloudWatch scrape setup."
  value       = try(module.grafana_cloudwatch_role[0].role_arn, null)
}
