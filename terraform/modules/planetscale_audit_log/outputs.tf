output "function_arn" {
  description = "ARN of the Lambda function, for the role that deploys its code."
  value       = aws_lambda_function.export.arn
}
