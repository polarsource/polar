terraform {
  required_version = ">= 1.2"

  required_providers {
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

resource "aws_cloudwatch_event_connection" "slack" {
  name               = "inspector-findings-slack"
  authorization_type = "API_KEY"

  auth_parameters {
    api_key {
      key   = "Authorization"
      value = "Bearer ${var.slack_bot_token}"
    }
  }
}

resource "aws_cloudwatch_event_api_destination" "slack_post_message" {
  name                = "inspector-findings-slack-post-message"
  connection_arn      = aws_cloudwatch_event_connection.slack.arn
  invocation_endpoint = "https://slack.com/api/chat.postMessage"
  http_method         = "POST"
}

data "aws_iam_policy_document" "slack_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "slack" {
  name               = "inspector-findings-slack-${data.aws_region.current.region}"
  assume_role_policy = data.aws_iam_policy_document.slack_assume.json
}

data "aws_iam_policy_document" "slack" {
  statement {
    actions   = ["events:InvokeApiDestination"]
    resources = [aws_cloudwatch_event_api_destination.slack_post_message.arn]
  }
}

resource "aws_iam_role_policy" "slack" {
  name   = "post-to-slack"
  role   = aws_iam_role.slack.id
  policy = data.aws_iam_policy_document.slack.json
}

resource "aws_cloudwatch_event_target" "findings_slack" {
  rule     = aws_cloudwatch_event_rule.findings.name
  arn      = aws_cloudwatch_event_api_destination.slack_post_message.arn
  role_arn = aws_iam_role.slack.arn

  http_target {
    header_parameters = { "Content-Type" = "application/json" }
  }

  input_transformer {
    input_paths = {
      severity = "$.detail.severity"
      title    = "$.detail.title"
      account  = "$.detail.awsAccountId"
      resource = "$.detail.resources[0].id"
      region   = "$.region"
    }
    input_template = <<-EOT
      {
        "channel": "${var.slack_channel}",
        "text": ":shield: *Inspector <severity>* in account <account> (<region>): <title>\nResource: `<resource>`\nhttps://<region>.console.aws.amazon.com/inspector/v2/home?region=<region>#/findings/all"
      }
    EOT
  }
}
