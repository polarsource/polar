resource "aws_guardduty_detector" "us_east_1" {
  enable = true
}

resource "aws_guardduty_detector" "us_east_2" {
  provider = aws.us_east_2

  enable = true
}

resource "aws_guardduty_organization_configuration" "us_east_1" {
  detector_id                      = aws_guardduty_detector.us_east_1.id
  auto_enable_organization_members = "ALL"
}

resource "aws_guardduty_organization_configuration" "us_east_2" {
  provider = aws.us_east_2

  detector_id                      = aws_guardduty_detector.us_east_2.id
  auto_enable_organization_members = "ALL"
}

resource "aws_guardduty_organization_configuration_feature" "us_east_1_s3_data_events" {
  detector_id = aws_guardduty_detector.us_east_1.id
  name        = "S3_DATA_EVENTS"
  auto_enable = "ALL"

  depends_on = [aws_guardduty_organization_configuration.us_east_1]
}

resource "aws_guardduty_organization_configuration_feature" "us_east_2_s3_data_events" {
  provider = aws.us_east_2

  detector_id = aws_guardduty_detector.us_east_2.id
  name        = "S3_DATA_EVENTS"
  auto_enable = "ALL"

  depends_on = [aws_guardduty_organization_configuration.us_east_2]
}
