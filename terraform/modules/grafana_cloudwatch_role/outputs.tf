output "role_arn" {
  description = "ARN of the IAM role Grafana Cloud assumes."
  value       = aws_iam_role.this.arn
}
