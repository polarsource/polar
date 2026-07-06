resource "aws_guardduty_detector" "management" {
  enable = true
}

resource "aws_guardduty_detector" "management_us_east_2" {
  provider = aws.us_east_2

  enable = true
}

resource "aws_guardduty_detector_feature" "management_s3_data_events" {
  detector_id = aws_guardduty_detector.management.id
  name        = "S3_DATA_EVENTS"
  status      = "ENABLED"
}

resource "aws_guardduty_detector_feature" "management_us_east_2_s3_data_events" {
  provider = aws.us_east_2

  detector_id = aws_guardduty_detector.management_us_east_2.id
  name        = "S3_DATA_EVENTS"
  status      = "ENABLED"
}

resource "aws_cloudwatch_event_rule" "malware_scan_threats_found" {
  provider = aws.us_east_2

  name        = "guardduty-malware-scan-threats-found"
  description = "GuardDuty Malware Protection scan results where threats were found in an uploaded S3 object."
  event_pattern = jsonencode({
    source      = ["aws.guardduty"]
    detail-type = ["GuardDuty Malware Protection Object Scan Result"]
    detail = {
      scanStatus = ["COMPLETED"]
      scanResultDetails = {
        scanResultStatus = ["THREATS_FOUND"]
      }
    }
  })
}

resource "aws_sns_topic" "malware_scan_threats_found" {
  provider = aws.us_east_2

  name = "guardduty-malware-scan-threats-found"
}

resource "aws_sns_topic_policy" "malware_scan_threats_found" {
  provider = aws.us_east_2

  arn = aws_sns_topic.malware_scan_threats_found.arn
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
        Resource = aws_sns_topic.malware_scan_threats_found.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_cloudwatch_event_rule.malware_scan_threats_found.arn
          }
        }
      },
    ]
  })
}

resource "aws_sns_topic_subscription" "malware_scan_threats_found_email" {
  provider = aws.us_east_2

  topic_arn = aws_sns_topic.malware_scan_threats_found.arn
  protocol  = "email"
  endpoint  = var.guardduty_alert_email
}

resource "aws_cloudwatch_event_target" "malware_scan_threats_found" {
  provider = aws.us_east_2

  rule = aws_cloudwatch_event_rule.malware_scan_threats_found.name
  arn  = aws_sns_topic.malware_scan_threats_found.arn
}
