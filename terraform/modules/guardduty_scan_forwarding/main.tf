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
  description = "S3 bucket names whose GuardDuty scan results are forwarded to the workload account"
  type        = list(string)
}

variable "destination_account_id" {
  description = "Workload AWS account ID that receives the forwarded scan results"
  type        = string
}

variable "permissions_boundary_arn" {
  description = "Permission boundary applied to the forwarding role"
  type        = string
  default     = null
}

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

locals {
  destination_bus_arn = "arn:aws:events:${data.aws_region.current.name}:${var.destination_account_id}:event-bus/polar-${var.environment}-guardduty-scan-results"
}

resource "aws_iam_role" "forward" {
  name                 = "polar-${var.environment}-guardduty-scan-forwarding"
  permissions_boundary = var.permissions_boundary_arn

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "events.amazonaws.com" }
        Action    = "sts:AssumeRole"
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      },
    ]
  })
}

resource "aws_iam_role_policy" "forward" {
  name = "put-events"
  role = aws_iam_role.forward.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "events:PutEvents"
        Resource = local.destination_bus_arn
      },
    ]
  })
}

resource "aws_cloudwatch_event_rule" "forward" {
  name        = "polar-${var.environment}-guardduty-scan-forward"
  description = "Forward GuardDuty Malware Protection THREATS_FOUND results for ${var.environment} buckets to the ${var.environment} workload account."
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

resource "aws_cloudwatch_event_target" "forward" {
  rule     = aws_cloudwatch_event_rule.forward.name
  arn      = local.destination_bus_arn
  role_arn = aws_iam_role.forward.arn
}
