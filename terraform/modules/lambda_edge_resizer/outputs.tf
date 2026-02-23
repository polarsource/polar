output "qualified_arn" {
  description = "Versioned ARN of the Lambda function (required for Lambda@Edge)"
  value       = aws_lambda_function.this.qualified_arn
}

output "function_arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.this.arn
}
