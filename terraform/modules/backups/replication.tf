resource "aws_s3_bucket" "replica" {
  provider = aws.replica

  bucket              = "polar-sh-backups-us-west-2"
  object_lock_enabled = true
}

resource "aws_s3_bucket_public_access_block" "replica" {
  provider = aws.replica

  bucket                  = aws_s3_bucket.replica.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "replica" {
  provider = aws.replica

  bucket = aws_s3_bucket.replica.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_versioning" "replica" {
  provider = aws.replica

  bucket = aws_s3_bucket.replica.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_object_lock_configuration" "replica" {
  provider = aws.replica

  bucket = aws_s3_bucket_versioning.replica.id

  rule {
    default_retention {
      mode = "COMPLIANCE"
      days = local.retention_days
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "replica" {
  provider = aws.replica

  bucket = aws_s3_bucket.replica.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "replica" {
  provider = aws.replica

  bucket = aws_s3_bucket_versioning.replica.id

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

resource "aws_iam_role" "replication" {
  name                 = "polar-backups-replication"
  permissions_boundary = var.permissions_boundary_arn

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "s3.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "replication" {
  name = "replicate-backups"
  role = aws_iam_role.replication.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetReplicationConfiguration",
          "s3:ListBucket",
        ]
        Resource = aws_s3_bucket.primary.arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObjectVersionForReplication",
          "s3:GetObjectVersionAcl",
          "s3:GetObjectVersionTagging",
          "s3:GetObjectRetention",
          "s3:GetObjectLegalHold",
        ]
        Resource = "${aws_s3_bucket.primary.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:ReplicateObject", "s3:ReplicateTags"]
        Resource = "${aws_s3_bucket.replica.arn}/*"
      },
    ]
  })
}

resource "aws_s3_bucket_replication_configuration" "primary" {
  bucket = aws_s3_bucket.primary.id
  role   = aws_iam_role.replication.arn

  rule {
    id     = "replicate-to-us-west-2"
    status = "Enabled"
    filter {}

    delete_marker_replication {
      status = "Disabled"
    }

    destination {
      bucket        = aws_s3_bucket.replica.arn
      storage_class = "STANDARD"
    }
  }

  depends_on = [
    aws_iam_role_policy.replication,
    aws_s3_bucket_object_lock_configuration.primary,
    aws_s3_bucket_object_lock_configuration.replica,
  ]
}
