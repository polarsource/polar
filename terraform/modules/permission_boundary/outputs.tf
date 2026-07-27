output "policy_arn" {
  value = aws_iam_policy.boundary.arn
}

output "policy_name" {
  value = aws_iam_policy.boundary.name
}
