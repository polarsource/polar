output "queue_url" {
  description = "Worker profile SQS queue URL."
  value       = aws_sqs_queue.task.url
}

output "queue_arn" {
  description = "Worker profile SQS queue ARN."
  value       = aws_sqs_queue.task.arn
}

output "dlq_arn" {
  description = "Dead-letter queue ARN."
  value       = aws_sqs_queue.dlq.arn
}

output "function_name" {
  description = "Lambda function name (used by CI to update-function-code)."
  value       = local.function_name
}

output "function_arn" {
  description = "Lambda function ARN."
  value       = aws_lambda_function.task.arn
}

output "lambda_role_arn" {
  description = "ARN of the Lambda execution role."
  value       = aws_iam_role.lambda.arn
}
