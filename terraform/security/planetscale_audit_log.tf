# Written by the Lambda in terraform/production/planetscale.tf.
locals {
  planetscale_audit_log_writer_account = "538043300756"
  planetscale_audit_log_writer_role    = "arn:aws:iam::${local.planetscale_audit_log_writer_account}:role/polar-production-planetscale-audit-log"
}

resource "aws_s3_bucket" "planetscale_audit_log" {
  provider = aws.us_east_2

  bucket = "polar-sh-planetscale-audit-log"
}

resource "aws_s3_bucket_versioning" "planetscale_audit_log" {
  provider = aws.us_east_2

  bucket = aws_s3_bucket.planetscale_audit_log.id

  versioning_configuration {
    status = "Enabled"
  }
}

data "aws_iam_policy_document" "planetscale_audit_log" {
  statement {
    actions = ["s3:ListBucket", "s3:PutObject"]
    resources = [
      aws_s3_bucket.planetscale_audit_log.arn,
      "${aws_s3_bucket.planetscale_audit_log.arn}/*",
    ]

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${local.planetscale_audit_log_writer_account}:root"]
    }

    condition {
      test     = "ArnEquals"
      variable = "aws:PrincipalArn"
      values   = [local.planetscale_audit_log_writer_role]
    }
  }

  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.planetscale_audit_log.arn,
      "${aws_s3_bucket.planetscale_audit_log.arn}/*",
    ]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "planetscale_audit_log" {
  provider = aws.us_east_2

  bucket = aws_s3_bucket.planetscale_audit_log.id
  policy = data.aws_iam_policy_document.planetscale_audit_log.json
}
