locals {
  guardduty_findings_event_pattern = jsonencode({
    source      = ["aws.guardduty"]
    detail-type = ["GuardDuty Finding"]
    detail = {
      severity = [{ numeric = [">=", var.guardduty_finding_severity_threshold] }]
    }
  })
}

resource "aws_cloudwatch_event_rule" "guardduty_findings_us_east_1" {
  name          = "guardduty-findings"
  description   = "GuardDuty findings at or above the alerting severity threshold, across all member accounts."
  event_pattern = local.guardduty_findings_event_pattern
}

resource "aws_cloudwatch_event_rule" "guardduty_findings_us_east_2" {
  provider = aws.us_east_2

  name          = "guardduty-findings"
  description   = "GuardDuty findings at or above the alerting severity threshold, across all member accounts."
  event_pattern = local.guardduty_findings_event_pattern
}

resource "aws_sns_topic" "guardduty_findings_us_east_1" {
  name = "guardduty-findings"
}

resource "aws_sns_topic" "guardduty_findings_us_east_2" {
  provider = aws.us_east_2

  name = "guardduty-findings"
}

resource "aws_sns_topic_policy" "guardduty_findings_us_east_1" {
  arn = aws_sns_topic.guardduty_findings_us_east_1.arn
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowEventBridgePublish"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.guardduty_findings_us_east_1.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_cloudwatch_event_rule.guardduty_findings_us_east_1.arn
          }
        }
      },
    ]
  })
}

resource "aws_sns_topic_policy" "guardduty_findings_us_east_2" {
  provider = aws.us_east_2

  arn = aws_sns_topic.guardduty_findings_us_east_2.arn
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowEventBridgePublish"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.guardduty_findings_us_east_2.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_cloudwatch_event_rule.guardduty_findings_us_east_2.arn
          }
        }
      },
    ]
  })
}

resource "aws_sns_topic_subscription" "guardduty_findings_email_us_east_1" {
  topic_arn = aws_sns_topic.guardduty_findings_us_east_1.arn
  protocol  = "email"
  endpoint  = var.guardduty_alert_email
}

resource "aws_sns_topic_subscription" "guardduty_findings_email_us_east_2" {
  provider = aws.us_east_2

  topic_arn = aws_sns_topic.guardduty_findings_us_east_2.arn
  protocol  = "email"
  endpoint  = var.guardduty_alert_email
}

resource "aws_cloudwatch_event_target" "guardduty_findings_us_east_1" {
  rule = aws_cloudwatch_event_rule.guardduty_findings_us_east_1.name
  arn  = aws_sns_topic.guardduty_findings_us_east_1.arn
}

resource "aws_cloudwatch_event_target" "guardduty_findings_us_east_2" {
  provider = aws.us_east_2

  rule = aws_cloudwatch_event_rule.guardduty_findings_us_east_2.name
  arn  = aws_sns_topic.guardduty_findings_us_east_2.arn
}
