locals {
  retention_days = 30
}

resource "aws_s3_bucket" "primary" {
  bucket = "polar-sh-backups"
}

resource "aws_s3_bucket_ownership_controls" "primary" {
  bucket = aws_s3_bucket.primary.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_policy" "primary" {
  count  = length(var.uploader_role_arns) == 0 ? 0 : 1
  bucket = aws_s3_bucket.primary.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCrossAccountUploads"
        Effect    = "Allow"
        Principal = { AWS = var.uploader_role_arns }
        Action    = ["s3:PutObject", "s3:AbortMultipartUpload"]
        Resource  = "${aws_s3_bucket.primary.arn}/*"
      },
    ]
  })
}

resource "aws_s3_bucket_versioning" "primary" {
  bucket = aws_s3_bucket.primary.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_object_lock_configuration" "primary" {
  bucket = aws_s3_bucket_versioning.primary.id

  rule {
    default_retention {
      mode = "COMPLIANCE"
      days = local.retention_days
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "primary" {
  bucket = aws_s3_bucket.primary.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "primary" {
  bucket = aws_s3_bucket_versioning.primary.id

  rule {
    id     = "${local.retention_days}-days-expiration-rule"
    status = "Enabled"
    filter {}
    expiration {
      days = local.retention_days
    }
    noncurrent_version_expiration {
      noncurrent_days = 1
    }
  }
}
