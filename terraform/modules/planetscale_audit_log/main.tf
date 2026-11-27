data "archive_file" "export" {
  type        = "zip"
  source_file = "${path.module}/export.py"
  output_path = "${path.root}/${var.name}.zip"
}

data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "export" {
  name                 = var.name
  assume_role_policy   = data.aws_iam_policy_document.assume.json
  permissions_boundary = var.permissions_boundary_arn
}

data "aws_iam_policy_document" "export" {
  statement {
    actions   = ["s3:PutObject"]
    resources = ["arn:aws:s3:::${var.bucket_name}/*"]
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

resource "aws_iam_role_policy" "export" {
  name   = var.name
  role   = aws_iam_role.export.id
  policy = data.aws_iam_policy_document.export.json
}

resource "aws_lambda_function" "export" {
  function_name    = var.name
  role             = aws_iam_role.export.arn
  runtime          = "python3.13"
  handler          = "export.handler"
  filename         = data.archive_file.export.output_path
  source_code_hash = data.archive_file.export.output_base64sha256
  timeout          = 300

  environment {
    variables = {
      PLANETSCALE_ORGANIZATION = var.organization
      PLANETSCALE_TOKEN        = var.token
      BUCKET                   = var.bucket_name
    }
  }
}

resource "aws_cloudwatch_event_rule" "export" {
  name                = var.name
  schedule_expression = "rate(1 hour)"
}

resource "aws_cloudwatch_event_target" "export" {
  rule = aws_cloudwatch_event_rule.export.name
  arn  = aws_lambda_function.export.arn
}

resource "aws_lambda_permission" "export" {
  statement_id  = "AllowEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.export.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.export.arn
}
