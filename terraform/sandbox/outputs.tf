output "lambda_worker_ecr_repository_url" {
  description = "ECR repository URL for the sandbox Lambda worker image."
  value       = module.lambda_worker_ecr.repository_url
}

output "dummy_lambda_worker_function_name" {
  description = "Sandbox dummy Lambda worker function name."
  value       = module.dummy_lambda_worker.function_name
}

output "dummy_lambda_worker_queue_url" {
  description = "Sandbox dummy Lambda worker SQS queue URL."
  value       = module.dummy_lambda_worker.queue_url
}

output "egress_ip" {
  description = "Static NAT egress IP for the sandbox VPC. Add this (as a /32) to the database IP allow list."
  value       = module.egress_ip.public_ip
}
