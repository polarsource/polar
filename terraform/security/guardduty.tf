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

locals {
  guardduty_public_buckets     = ["polar-public-files", "polar-public-sandbox-files", "polar-test-public-files"]
  guardduty_eicar_threat_names = ["EICAR-Test-File", "EICAR-Test-File (not a virus)"]
}

resource "aws_guardduty_filter" "us_east_1_public_buckets" {
  detector_id = aws_guardduty_detector.us_east_1.id
  name        = "archive-public-buckets-anonymous-access"
  description = "Public-files buckets are public by design."
  action      = "ARCHIVE"
  rank        = 1

  finding_criteria {
    criterion {
      field  = "type"
      equals = ["Policy:S3/BucketAnonymousAccessGranted"]
    }
    criterion {
      field  = "resource.s3BucketDetails.name"
      equals = local.guardduty_public_buckets
    }
  }
}

resource "aws_guardduty_filter" "us_east_2_public_buckets" {
  provider = aws.us_east_2

  detector_id = aws_guardduty_detector.us_east_2.id
  name        = "archive-public-buckets-anonymous-access"
  description = "Public-files buckets are public by design."
  action      = "ARCHIVE"
  rank        = 1

  finding_criteria {
    criterion {
      field  = "type"
      equals = ["Policy:S3/BucketAnonymousAccessGranted"]
    }
    criterion {
      field  = "resource.s3BucketDetails.name"
      equals = local.guardduty_public_buckets
    }
  }
}

resource "aws_guardduty_filter" "us_east_1_eicar" {
  detector_id = aws_guardduty_detector.us_east_1.id
  name        = "archive-eicar-test-files"
  description = "EICAR test files from verifying the malware scan pipeline."
  action      = "ARCHIVE"
  rank        = 2

  finding_criteria {
    criterion {
      field  = "type"
      equals = ["Object:S3/MaliciousFile"]
    }
    criterion {
      field  = "service.malwareScanDetails.threats.name"
      equals = local.guardduty_eicar_threat_names
    }
  }
}

resource "aws_guardduty_filter" "us_east_2_eicar" {
  provider = aws.us_east_2

  detector_id = aws_guardduty_detector.us_east_2.id
  name        = "archive-eicar-test-files"
  description = "EICAR test files from verifying the malware scan pipeline."
  action      = "ARCHIVE"
  rank        = 2

  finding_criteria {
    criterion {
      field  = "type"
      equals = ["Object:S3/MaliciousFile"]
    }
    criterion {
      field  = "service.malwareScanDetails.threats.name"
      equals = local.guardduty_eicar_threat_names
    }
  }
}
