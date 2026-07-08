terraform {
  required_version = ">= 1.2"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.55"
    }
  }
}

variable "environment" {
  description = "Environment to run in"
  type        = string

  validation {
    condition     = contains(["production", "sandbox", "test"], var.environment)
    error_message = "Must be either \"production\", \"sandbox\" or \"test\"."
  }
}

variable "bucket_names" {
  description = "S3 bucket names whose GuardDuty scan results are delivered to the task queue"
  type        = list(string)
}

variable "queue_arn" {
  description = "Task queue ARN scan results are delivered to"
  type        = string
}

variable "queue_url" {
  description = "Task queue URL scan results are delivered to"
  type        = string
}

variable "dlq_arn" {
  description = "Dead-letter queue ARN for undeliverable events"
  type        = string
}

variable "dlq_url" {
  description = "Dead-letter queue URL for undeliverable events"
  type        = string
}

variable "source_account_id" {
  description = "AWS account ID that owns the GuardDuty malware protection plans and forwards scan results to this bus"
  type        = string
}

resource "aws_cloudwatch_event_bus" "guardduty" {
  name = "polar-${var.environment}-guardduty-scan-results"
}

resource "aws_cloudwatch_event_bus_policy" "guardduty" {
  event_bus_name = aws_cloudwatch_event_bus.guardduty.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowManagementAccountPutEvents"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${var.source_account_id}:root" }
        Action    = "events:PutEvents"
        Resource  = aws_cloudwatch_event_bus.guardduty.arn
        Condition = {
          BoolIfExists = {
            "events:eventBusInvocation" = "true"
          }
        }
      },
    ]
  })
}

resource "aws_cloudwatch_event_rule" "threats_found" {
  name           = "polar-${var.environment}-guardduty-scan-threats-found"
  event_bus_name = aws_cloudwatch_event_bus.guardduty.name
  description    = "GuardDuty Malware Protection THREATS_FOUND results for ${var.environment} buckets, delivered to the task worker."
  event_pattern = jsonencode({
    source      = ["aws.guardduty"]
    detail-type = ["GuardDuty Malware Protection Object Scan Result"]
    detail = {
      scanStatus = ["COMPLETED"]
      s3ObjectDetails = {
        bucketName = var.bucket_names
      }
      scanResultDetails = {
        scanResultStatus = ["THREATS_FOUND"]
      }
    }
  })
}

resource "aws_cloudwatch_event_target" "threats_found" {
  rule           = aws_cloudwatch_event_rule.threats_found.name
  event_bus_name = aws_cloudwatch_event_bus.guardduty.name
  arn            = var.queue_arn

  input_transformer {
    input_paths = {
      detail = "$.detail"
    }
    input_template = "{\"actor\":\"file.guardduty_scan_result\",\"kwargs\":{\"scan_result\":<detail>}}"
  }

  dead_letter_config {
    arn = var.dlq_arn
  }
}

resource "aws_sqs_queue_policy" "queue" {
  queue_url = var.queue_url
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowEventBridgeSend"
        Effect    = "Allow"
        Principal = { Service = "events.amazonaws.com" }
        Action    = "sqs:SendMessage"
        Resource  = var.queue_arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_cloudwatch_event_rule.threats_found.arn
          }
        }
      },
    ]
  })
}

resource "aws_sqs_queue_policy" "dlq" {
  queue_url = var.dlq_url
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowEventBridgeSend"
        Effect    = "Allow"
        Principal = { Service = "events.amazonaws.com" }
        Action    = "sqs:SendMessage"
        Resource  = var.dlq_arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_cloudwatch_event_rule.threats_found.arn
          }
        }
      },
    ]
  })
}
