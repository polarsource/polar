# Placeholder until .github/workflows/deploy_planetscale_audit_log.yml
# uploads lambda/planetscale-audit-log, which owns the code from then on.
data "archive_file" "placeholder" {
  type        = "zip"
  output_path = "${path.root}/${var.name}.zip"

  source {
    filename = "handler.py"
    content  = "def handler(event, context):\n    raise RuntimeError(\"Not deployed yet\")\n"
  }
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
  handler          = "handler.handler"
  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256
  timeout          = 300

  environment {
    variables = {
      PLANETSCALE_ORGANIZATION = var.organization
      PLANETSCALE_TOKEN        = var.token
      BUCKET                   = var.bucket_name
    }
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
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
