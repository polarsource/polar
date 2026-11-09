terraform {
  required_version = ">= 1.2"

  required_providers {
    archive = {
      source  = "hashicorp/archive"
      version = ">= 2.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.69.1, < 7.0.0"
    }
  }
}

variable "member_account_ids" {
  description = "Organization account IDs to activate Inspector for, excluding the delegated admin account"
  type        = set(string)
}

variable "slack_bot_token" {
  description = "Slack bot token used to post findings"
  type        = string
  sensitive   = true
}

variable "slack_channel" {
  description = "Slack channel ID findings are posted to"
  type        = string
}

variable "alert_severities" {
  description = "Finding severities that are posted to Slack"
  type        = list(string)
  default     = ["CRITICAL", "HIGH"]
}

locals {
  resource_types = ["EC2", "ECR", "LAMBDA", "LAMBDA_CODE"]
}

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

resource "aws_inspector2_organization_configuration" "this" {
  auto_enable {
    ec2         = true
    ecr         = true
    lambda      = true
    lambda_code = true
  }
}

resource "aws_inspector2_member_association" "this" {
  for_each = var.member_account_ids

  account_id = each.value
}

resource "aws_inspector2_enabler" "admin" {
  account_ids    = [data.aws_caller_identity.current.account_id]
  resource_types = local.resource_types
}

resource "aws_inspector2_enabler" "members" {
  account_ids    = var.member_account_ids
  resource_types = local.resource_types

  depends_on = [aws_inspector2_enabler.admin, aws_inspector2_member_association.this]
}

resource "aws_cloudwatch_event_rule" "findings" {
  name        = "inspector-findings"
  description = "Active, fixable Inspector findings at alerting severity, across all member accounts."

  event_pattern = jsonencode({
    source      = ["aws.inspector2"]
    detail-type = ["Inspector2 Finding"]
    detail = {
      severity     = var.alert_severities
      status       = ["ACTIVE"]
      fixAvailable = ["YES", "PARTIAL"]
    }
  })
}

resource "aws_dynamodb_table" "notified" {
  name         = "inspector-findings-notified"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "key"

  attribute {
    name = "key"
    type = "S"
  }
}

data "archive_file" "notify" {
  type        = "zip"
  source_file = "${path.module}/notify.py"
  output_path = "${path.root}/inspector-findings-notify-${data.aws_region.current.region}.zip"
}

data "aws_iam_policy_document" "notify_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "notify" {
  name               = "inspector-findings-notify-${data.aws_region.current.region}"
  assume_role_policy = data.aws_iam_policy_document.notify_assume.json
}

data "aws_iam_policy_document" "notify" {
  statement {
    actions   = ["dynamodb:PutItem", "dynamodb:DeleteItem"]
    resources = [aws_dynamodb_table.notified.arn]
  }

  statement {
    actions   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["arn:aws:logs:*:*:*"]
  }
}

resource "aws_iam_role_policy" "notify" {
  name   = "notify"
  role   = aws_iam_role.notify.id
  policy = data.aws_iam_policy_document.notify.json
}

resource "aws_lambda_function" "notify" {
  function_name    = "inspector-findings-notify"
  role             = aws_iam_role.notify.arn
  runtime          = "python3.13"
  handler          = "notify.handler"
  filename         = data.archive_file.notify.output_path
  source_code_hash = data.archive_file.notify.output_base64sha256
  timeout          = 30

  environment {
    variables = {
      TABLE_NAME      = aws_dynamodb_table.notified.name
      SLACK_CHANNEL   = var.slack_channel
      SLACK_BOT_TOKEN = var.slack_bot_token
    }
  }
}

resource "aws_cloudwatch_event_target" "findings_notify" {
  rule = aws_cloudwatch_event_rule.findings.name
  arn  = aws_lambda_function.notify.arn
}

resource "aws_lambda_permission" "findings_notify" {
  statement_id  = "AllowEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.notify.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.findings.arn
}
