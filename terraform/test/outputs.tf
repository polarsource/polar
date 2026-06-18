output "lambda_worker_ecr_repository_url" {
  description = "ECR repository URL for the test Lambda worker image."
  value       = try(module.lambda_worker_ecr[0].repository_url, null)
}
