locals {
  in_vpc = length(var.subnet_ids) > 0
}

resource "aws_sqs_queue" "dlq" {
  name                      = "${var.queue_name}-dlq"
  message_retention_seconds = 1209600

  tags = var.tags
}

resource "aws_sqs_queue" "task" {
  name = var.queue_name

  # Visibility must exceed the function timeout so a slow task is not redelivered while still running.
  visibility_timeout_seconds = max(180, var.timeout_seconds + 60)

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = min(var.max_retries + 1, 5)
  })

  tags = var.tags
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = var.function_name
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
  tags               = var.tags
}

data "aws_iam_policy_document" "lambda" {
  statement {
    sid = "Logs"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["${aws_cloudwatch_log_group.task.arn}:*"]
  }

  statement {
    sid = "TaskQueue"
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
      "sqs:GetQueueUrl",
      "sqs:ChangeMessageVisibility",
      "sqs:SendMessage",
    ]
    resources = [aws_sqs_queue.task.arn]
  }

  statement {
    sid       = "DeadLetterQueue"
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.dlq.arn]
  }
}

resource "aws_iam_role_policy" "lambda" {
  name   = var.function_name
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.lambda.json
}

resource "aws_iam_role_policy_attachment" "vpc_access" {
  count      = local.in_vpc ? 1 : 0
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_cloudwatch_log_group" "task" {
  name              = "/aws/lambda/${var.function_name}"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

resource "aws_lambda_function" "task" {
  function_name = var.function_name
  role          = aws_iam_role.lambda.arn
  package_type  = "Image"
  image_uri     = var.image_uri

  timeout     = var.timeout_seconds
  memory_size = var.memory_size

  reserved_concurrent_executions = var.reserved_concurrency == null ? -1 : var.reserved_concurrency

  environment {
    variables = merge(
      var.environment_variables,
      var.secret_environment_variables,
      { POLAR_DATABASE_POOL_SIZE = "1" },
    )
  }

  dynamic "vpc_config" {
    for_each = local.in_vpc ? [1] : []
    content {
      subnet_ids         = var.subnet_ids
      security_group_ids = var.security_group_ids
    }
  }

  depends_on = [aws_cloudwatch_log_group.task]

  tags = var.tags
}

resource "aws_lambda_event_source_mapping" "task" {
  event_source_arn        = aws_sqs_queue.task.arn
  function_name           = aws_lambda_function.task.arn
  batch_size              = var.batch_size
  enabled                 = var.enabled
  function_response_types = ["ReportBatchItemFailures"]
}
