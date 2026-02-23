output "qualified_arn" {
  description = "Versioned ARN of the Lambda function (required for Lambda@Edge)"
  value       = aws_lambda_function.this.qualified_arn
}
