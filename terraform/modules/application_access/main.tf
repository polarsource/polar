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
  description = "Bucket names and policy descriptions"
  type = object({
    customer_invoices = object({ name = string, description = optional(string) })
    payout_invoices   = object({ name = string, description = optional(string) })
    files             = object({ name = string, description = optional(string) })
    public_files      = object({ name = string, description = optional(string) })
    logs              = object({ name = string, description = optional(string) })
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
    resources = ["arn:aws:s3:::${var.buckets.customer_invoices.name}/*"]
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
    resources = ["arn:aws:s3:::${var.buckets.payout_invoices.name}/*"]
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
    resources = ["arn:aws:s3:::${var.buckets.files.name}/*"]
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
    resources = ["arn:aws:s3:::${var.buckets.public_files.name}/*"]
  }
}

data "aws_iam_policy_document" "logs" {
  statement {
    sid = "AllowWriteLogs"
    actions = [
      "s3:PutObject",
    ]
    resources = ["arn:aws:s3:::${var.buckets.logs.name}/*"]
  }
}

resource "aws_iam_policy" "customer_invoices" {
  name        = var.buckets.customer_invoices.name
  description = var.buckets.customer_invoices.description
  policy      = data.aws_iam_policy_document.customer_invoices.json
}

resource "aws_iam_policy" "payout_invoices" {
  name        = var.buckets.payout_invoices.name
  description = var.buckets.payout_invoices.description
  policy      = data.aws_iam_policy_document.payout_invoices.json
}

resource "aws_iam_policy" "files" {
  name        = var.buckets.files.name
  description = var.buckets.files.description
  policy      = data.aws_iam_policy_document.files.json
}

resource "aws_iam_policy" "public_files" {
  name        = var.buckets.public_files.name
  description = var.buckets.public_files.description
  policy      = data.aws_iam_policy_document.public_files.json
}

resource "aws_iam_policy" "logs" {
  name        = var.buckets.logs.name
  description = var.buckets.logs.description
  policy      = data.aws_iam_policy_document.logs.json
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

resource "aws_iam_user_policy_attachment" "logs" {
  user       = var.username
  policy_arn = aws_iam_policy.logs.arn
}
