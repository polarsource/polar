locals {
  function_name = "polar-${var.environment}-worker-${var.name}"
  in_vpc        = length(var.subnet_ids) > 0
}

data "aws_caller_identity" "current" {}

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
    maxReceiveCount     = var.max_retries + 1
  })

  tags = var.tags
}

# Role EventBridge Scheduler assumes to redeliver retries delayed beyond SQS's 12h visibility limit.
data "aws_iam_policy_document" "scheduler_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "scheduler" {
  name                 = "${local.function_name}-scheduler"
  assume_role_policy   = data.aws_iam_policy_document.scheduler_assume.json
  permissions_boundary = var.permissions_boundary_arn
  tags                 = var.tags

  lifecycle {
    precondition {
      condition     = length("${local.function_name}-scheduler") <= 64
      error_message = "Scheduler role name must be 64 characters or fewer: ${local.function_name}-scheduler"
    }
  }
}

data "aws_iam_policy_document" "scheduler" {
  statement {
    sid       = "SendToTaskQueue"
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.task.arn]
  }
}

resource "aws_iam_role_policy" "scheduler" {
  name   = "${local.function_name}-scheduler"
  role   = aws_iam_role.scheduler.id
  policy = data.aws_iam_policy_document.scheduler.json
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
  name                 = local.function_name
  assume_role_policy   = data.aws_iam_policy_document.lambda_assume.json
  permissions_boundary = var.permissions_boundary_arn
  tags                 = var.tags
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
    sid = "DeadLetterQueue"
    actions = [
      "sqs:GetQueueUrl",
      "sqs:SendMessage",
    ]
    resources = [aws_sqs_queue.dlq.arn]
  }

  statement {
    sid       = "ScheduleRetries"
    actions   = ["scheduler:CreateSchedule"]
    resources = ["arn:aws:scheduler:*:${data.aws_caller_identity.current.account_id}:schedule/default/polar-retry-*"]
  }

  statement {
    sid       = "PassSchedulerRole"
    actions   = ["iam:PassRole"]
    resources = [aws_iam_role.scheduler.arn]
    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["scheduler.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "lambda" {
  name   = local.function_name
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.lambda.json
}

resource "aws_iam_role_policy_attachment" "vpc_access" {
  count      = local.in_vpc ? 1 : 0
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_cloudwatch_log_group" "task" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

resource "aws_lambda_function" "task" {
  function_name = local.function_name
  role          = aws_iam_role.lambda.arn
  package_type  = "Image"
  image_uri     = var.image_uri

  image_config {
    command = var.image_command
  }

  timeout     = var.timeout_seconds
  memory_size = var.memory_size

  reserved_concurrent_executions = var.reserved_concurrency == null ? -1 : var.reserved_concurrency

  environment {
    variables = merge(
      var.environment_variables,
      var.secret_environment_variables,
      { POLAR_DATABASE_POOL_SIZE = "1" },
      { SERVICE_NAME = local.function_name },
      { POLAR_WORKER_SQS_SCHEDULER_ROLE_ARN = aws_iam_role.scheduler.arn },
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

  lifecycle {
    ignore_changes = [image_uri]

    precondition {
      condition     = length(local.function_name) <= 64
      error_message = "Lambda function name must be 64 characters or fewer: ${local.function_name}"
    }
  }
}

resource "aws_lambda_event_source_mapping" "task" {
  event_source_arn        = aws_sqs_queue.task.arn
  function_name           = aws_lambda_function.task.arn
  batch_size              = 1
  enabled                 = var.enabled
  function_response_types = ["ReportBatchItemFailures"]
}
