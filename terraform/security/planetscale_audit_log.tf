# Written by the Lambda in terraform/production/planetscale.tf.
locals {
  planetscale_audit_log_writer_account = "538043300756"
  planetscale_audit_log_writer_role    = "arn:aws:iam::${local.planetscale_audit_log_writer_account}:role/polar-production-planetscale-audit-log"
}

resource "aws_s3_bucket" "planetscale_audit_log" {
  provider = aws.us_east_2

  bucket = "polar-sh-planetscale-audit-log"
}

data "aws_iam_policy_document" "planetscale_audit_log" {
  statement {
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.planetscale_audit_log.arn}/*"]

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
}

resource "aws_s3_bucket_policy" "planetscale_audit_log" {
  provider = aws.us_east_2

  bucket = aws_s3_bucket.planetscale_audit_log.id
  policy = data.aws_iam_policy_document.planetscale_audit_log.json
}
