terraform {
  required_version = ">= 1.2"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.92"
    }
  }
}

data "aws_iam_policy_document" "assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com", "edgelambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "this" {
  name               = var.function_name
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
}

data "aws_iam_policy_document" "this" {
  statement {
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:HeadObject",
    ]
    resources = ["${var.source_bucket_arn}/*"]
  }

  statement {
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["arn:aws:logs:*:*:*"]
  }
}

resource "aws_iam_role_policy" "this" {
  name   = var.function_name
  role   = aws_iam_role.this.id
  policy = data.aws_iam_policy_document.this.json
}

resource "aws_lambda_function" "this" {
  function_name     = var.function_name
  role              = aws_iam_role.this.arn
  handler           = "handler.handler"
  runtime           = "python3.13"
  memory_size       = var.memory_size
  timeout           = var.timeout
  publish           = true
  s3_bucket         = var.s3_bucket
  s3_key            = var.s3_key
  s3_object_version = var.s3_object_version
}
