terraform {
  required_version = ">= 1.2"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

variable "username" {
  description = "Name of the IAM user to attach policies to"
  type        = string
}

variable "buckets" {
  description = "Bucket names for each policy"
  type = object({
    customer_invoices = string
    payout_invoices   = string
    files             = string
    public_files      = string
  })
}

data "aws_iam_policy_document" "customer_invoices" {
  statement {
    sid = "VisualEditor0"
    actions = [
      "s3:PutObject",
      "s3:GetObjectAttributes",
      "s3:GetObject",
      "s3:GetObjectVersion",
      "s3:GetObjectVersionAttributes",
    ]
    resources = ["arn:aws:s3:::${var.buckets.customer_invoices}/*"]
  }
}

data "aws_iam_policy_document" "payout_invoices" {
  statement {
    sid = "VisualEditor0"
    actions = [
      "s3:PutObject",
      "s3:GetObjectAttributes",
      "s3:GetObject",
      "s3:GetObjectVersion",
      "s3:GetObjectVersionAttributes",
    ]
    resources = ["arn:aws:s3:::${var.buckets.payout_invoices}/*"]
  }
}

data "aws_iam_policy_document" "files" {
  statement {
    sid = "VisualEditor0"
    actions = [
      "s3:PutObject",
      "s3:GetObjectAttributes",
      "s3:GetObject",
      "s3:GetObjectVersion",
      "s3:GetObjectVersionAttributes",
      "s3:DeleteObject",
      "s3:DeleteObjectVersion",
    ]
    resources = ["arn:aws:s3:::${var.buckets.files}/*"]
  }
}

data "aws_iam_policy_document" "public_files" {
  statement {
    sid = "VisualEditor0"
    actions = [
      "s3:PutObject",
      "s3:GetObjectAttributes",
      "s3:GetObject",
      "s3:GetObjectVersion",
      "s3:GetObjectVersionAttributes",
      "s3:DeleteObject",
      "s3:DeleteObjectVersion",
    ]
    resources = ["arn:aws:s3:::${var.buckets.public_files}/*"]
  }
}

resource "aws_iam_policy" "customer_invoices" {
  name   = var.buckets.customer_invoices
  policy = data.aws_iam_policy_document.customer_invoices.json
}

resource "aws_iam_policy" "payout_invoices" {
  name   = var.buckets.payout_invoices
  policy = data.aws_iam_policy_document.payout_invoices.json
}

resource "aws_iam_policy" "files" {
  name   = var.buckets.files
  policy = data.aws_iam_policy_document.files.json
}

resource "aws_iam_policy" "public_files" {
  name   = var.buckets.public_files
  policy = data.aws_iam_policy_document.public_files.json
}

resource "aws_iam_user_policy_attachment" "customer_invoices" {
  user       = var.username
  policy_arn = aws_iam_policy.customer_invoices.arn
}

resource "aws_iam_user_policy_attachment" "payout_invoices" {
  user       = var.username
  policy_arn = aws_iam_policy.payout_invoices.arn
}

resource "aws_iam_user_policy_attachment" "files" {
  user       = var.username
  policy_arn = aws_iam_policy.files.arn
}

resource "aws_iam_user_policy_attachment" "public_files" {
  user       = var.username
  policy_arn = aws_iam_policy.public_files.arn
}
