
resource "aws_s3_bucket" "backups" {
  bucket = "polar-sh-backups"
}

resource "aws_s3_bucket_lifecycle_configuration" "backups-lifecycle" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "14-days-expiration-rule"
    status = "Enabled"
    filter {}
    expiration {
      days = 14
    }
  }
}

resource "aws_s3_bucket" "customer_invoices" {
  bucket = "polar-customer-invoices"
}

resource "aws_s3_bucket" "payout_invoices" {
  bucket = "polar-payout-invoices"
}

resource "aws_s3_bucket" "production_files" {
  bucket = "polar-production-files"
}

resource "aws_s3_bucket_cors_configuration" "production_files" {
  bucket = aws_s3_bucket.production_files.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "HEAD"]
    allowed_origins = ["https://polar.sh"]
    expose_headers  = ["ETag"]
  }
}

resource "aws_s3_bucket" "sandbox_customer_invoices" {
  bucket = "polar-sandbox-customer-invoices"
}

resource "aws_s3_bucket" "sandbox_files" {
  bucket = "polar-sandbox-files"
}

resource "aws_s3_bucket_cors_configuration" "sandbox_files" {
  bucket = aws_s3_bucket.sandbox_files.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "HEAD"]
    allowed_origins = ["https://sandbox.polar.sh"]
    expose_headers  = ["ETag"]
  }
}

resource "aws_s3_bucket" "sandbox_payout_invoices" {
  bucket = "polar-sandbox-payout-invoices"
}

resource "aws_s3_bucket" "public_assets" {
  bucket = "polar-public-assets"
}

resource "aws_s3_bucket_public_access_block" "public_assets" {
  bucket                  = aws_s3_bucket.public_assets.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "public_assets" {
  bucket = aws_s3_bucket.public_assets.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.public_assets.arn}/*"
      }
    ]
  })
}

resource "aws_s3_bucket" "public_files" {
  bucket = "polar-public-files"
}

resource "aws_s3_bucket_public_access_block" "public_files" {
  bucket                  = aws_s3_bucket.public_files.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "public_files" {
  bucket = aws_s3_bucket.public_files.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.public_files.arn}/*"
      }
    ]
  })
}

resource "aws_s3_bucket_cors_configuration" "public_files" {
  bucket = aws_s3_bucket.public_files.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "HEAD"]
    allowed_origins = ["https://polar.sh"]
    expose_headers  = ["ETag"]
  }
}

resource "aws_s3_bucket" "public_sandbox_files" {
  bucket = "polar-public-sandbox-files"
}

resource "aws_s3_bucket_public_access_block" "public_sandbox_files" {
  bucket                  = aws_s3_bucket.public_sandbox_files.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "public_sandbox_files" {
  bucket = aws_s3_bucket.public_sandbox_files.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.public_sandbox_files.arn}/*"
      }
    ]
  })
}

resource "aws_s3_bucket_cors_configuration" "public_sandbox_files" {
  bucket = aws_s3_bucket.public_sandbox_files.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "HEAD"]
    allowed_origins = ["https://sandbox.polar.sh"]
    expose_headers  = ["ETag"]
  }
}
