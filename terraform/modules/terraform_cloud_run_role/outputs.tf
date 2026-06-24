output "role_arn" {
  value = aws_iam_role.terraform_cloud.arn
}

output "oidc_provider_arn" {
  value = aws_iam_openid_connect_provider.terraform_cloud.arn
}
