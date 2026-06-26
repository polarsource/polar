output "lambda_worker_ecr_repository_url" {
  description = "ECR repository URL for the sandbox Lambda worker image."
  value       = module.lambda_worker_ecr.repository_url
}

output "lambda_worker_function_names" {
  description = "Sandbox Lambda worker function names, keyed by worker."
  value       = { for key, worker in module.lambda_worker : key => worker.function_name }
}

output "lambda_worker_queue_urls" {
  description = "Sandbox Lambda worker SQS queue URLs, keyed by worker."
  value       = { for key, worker in module.lambda_worker : key => worker.queue_url }
}

output "egress_ip" {
  description = "Static NAT egress IP for the sandbox VPC. Add this (as a /32) to the database IP allow list."
  value       = module.egress_ip.public_ip
}

output "redis_sandbox_id" {
  description = "The sandbox Redis ID. Used for the render_redis data source."
  value       = render_redis.redis_sandbox.id
}
