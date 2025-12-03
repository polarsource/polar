terraform {
  required_version = ">= 1.2"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.92"
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

variable "allowed_origins" {
  description = "Allowed origin for files"
  type        = list(string)
}

variable "public_files_bucket_name" {
  description = "Override the public files bucket name"
  type        = string
  default     = null
}

locals {
  name_prefix         = (var.environment == "production" ? "polar" : "polar-${var.environment}")
  full_name_prefix    = "polar-${var.environment}"
  public_files_bucket = coalesce(var.public_files_bucket_name, "${local.name_prefix}-public-files")
}


# resource "aws_s3_bucket" "backups" {
#   bucket = "polar-sh-backups"
# }
#
# resource "aws_s3_bucket_lifecycle_configuration" "backups_lifecycle" {
#   bucket = aws_s3_bucket.backups.id
#
#   rule {
#     id     = "14-days-expiration-rule"
#     status = "Enabled"
#     filter {}
#     expiration {
#       days = 14
#     }
#   }
# }

resource "aws_s3_bucket" "customer_invoices" {
  bucket = "${local.name_prefix}-customer-invoices"
}

resource "aws_s3_bucket" "payout_invoices" {
  bucket = "${local.name_prefix}-payout-invoices"
}

resource "aws_s3_bucket" "files" {
  bucket = "${local.full_name_prefix}-files"
}

resource "aws_s3_bucket_cors_configuration" "files" {
  bucket = aws_s3_bucket.files.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "HEAD"]
    allowed_origins = var.allowed_origins
    expose_headers  = ["ETag"]
  }
}

resource "aws_s3_bucket" "public_assets" {
  bucket = "${local.name_prefix}-public-assets"
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
  depends_on = [aws_s3_bucket_public_access_block.public_assets]
}

resource "aws_s3_bucket" "public_files" {
  bucket = local.public_files_bucket
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
  depends_on = [aws_s3_bucket_public_access_block.public_files]
}

resource "aws_s3_bucket_cors_configuration" "public_files" {
  bucket = aws_s3_bucket.public_files.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "HEAD"]
    allowed_origins = var.allowed_origins
    expose_headers  = ["ETag"]
  }
}
