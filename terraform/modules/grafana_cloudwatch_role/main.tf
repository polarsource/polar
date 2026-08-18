data "aws_iam_policy_document" "assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::008923505280:root"]
    }

    condition {
      test     = "StringEquals"
      variable = "sts:ExternalId"
      values   = [var.external_id]
    }
  }
}

resource "aws_iam_role" "this" {
  name                 = var.name
  assume_role_policy   = data.aws_iam_policy_document.assume.json
  permissions_boundary = var.permissions_boundary_arn
  tags                 = var.tags
}

data "aws_iam_policy_document" "cloudwatch_read" {
  statement {
    sid    = "CloudWatchRead"
    effect = "Allow"
    actions = [
      "cloudwatch:GetMetricData",
      "cloudwatch:ListMetrics",
      "tag:GetResources",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "cloudwatch_read" {
  name   = "cloudwatch-read"
  role   = aws_iam_role.this.id
  policy = data.aws_iam_policy_document.cloudwatch_read.json
}
