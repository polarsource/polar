output "role_arn" {
  description = "ARN of the compliance auditor IAM role."
  value       = aws_iam_role.this.arn
}

output "role_name" {
  description = "Name of the compliance auditor IAM role."
  value       = aws_iam_role.this.name
}

output "oidc_provider_arn" {
  description = "ARN of the compliance platform OIDC provider."
  value       = one(aws_iam_openid_connect_provider.this[*].arn)
}
