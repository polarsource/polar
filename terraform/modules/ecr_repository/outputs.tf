output "repository_arn" {
  description = "ECR repository ARN."
  value       = aws_ecr_repository.this.arn
}

output "repository_name" {
  description = "ECR repository name."
  value       = aws_ecr_repository.this.name
}

output "repository_url" {
  description = "ECR repository URL."
  value       = aws_ecr_repository.this.repository_url
}
