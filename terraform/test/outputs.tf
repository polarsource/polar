output "lambda_worker_ecr_repository_url" {
  description = "ECR repository URL for the test Lambda worker image."
  value       = try(module.lambda_worker_ecr[0].repository_url, null)
}

output "redis_endpoint_service_name" {
  description = "VPC endpoint service name for the worker Redis. Provide to Render when creating the private link."
  value       = try(module.redis_private_link[0].service_name, null)
}
