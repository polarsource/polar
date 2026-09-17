locals {
  backups_bucket        = "polar-sh-backups"
  backup_alert_channel  = "C093CJXJXPT"
  backup_copy_task_role = "polar-production-backup-copy-task"

  backup_copy_script = <<-EOT
    set -euo pipefail
    DATE="$${BACKUP_DATE:-$(date -u +%Y-%m-%d)}"
    echo "Copying Render export for $DATE"
    URL=$(curl -fsS "https://api.render.com/v1/postgres/$RENDER_DATABASE_ID/export" \
      -H "Authorization: Bearer $RENDER_API_KEY" \
      | jq -er --arg d "$DATE" '[.[] | select(.createdAt | startswith($d))][0].url')
    curl -fsS "$URL" | aws s3 cp - "s3://$BUCKET_NAME/$${DATE//-/}/$${DATE//-/}_backup.tar.gz" \
      --expected-size 200000000000 --checksum-algorithm SHA256
  EOT
}

resource "aws_secretsmanager_secret" "render_api_key" {
  name = "polar-production-render-api-key"
}

resource "aws_secretsmanager_secret_version" "render_api_key" {
  secret_id     = aws_secretsmanager_secret.render_api_key.id
  secret_string = var.render_api_key
}

resource "aws_security_group" "backup_copy" {
  name        = "polar-production-backup-copy"
  description = "Egress-only security group for the database backup copy task."
  vpc_id      = module.vpc.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

data "aws_iam_policy_document" "backup_copy_task_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "backup_copy_task" {
  name                 = local.backup_copy_task_role
  assume_role_policy   = data.aws_iam_policy_document.backup_copy_task_assume.json
  permissions_boundary = data.aws_iam_policy.permission_boundary.arn
}

data "aws_iam_policy_document" "backup_copy_task" {
  statement {
    actions   = ["s3:PutObject", "s3:AbortMultipartUpload"]
    resources = ["arn:aws:s3:::${local.backups_bucket}/*"]
  }
}

resource "aws_iam_role_policy" "backup_copy_task" {
  name   = "upload-backups"
  role   = aws_iam_role.backup_copy_task.id
  policy = data.aws_iam_policy_document.backup_copy_task.json
}

module "backup_copy" {
  source = "../modules/ecs_service"

  environment              = "production"
  name                     = "backup-copy"
  cluster_arn              = module.ecs_cluster.cluster_arn
  image                    = "public.ecr.aws/aws-cli/aws-cli:2.36.46"
  entrypoint               = ["bash", "-c"]
  command                  = [local.backup_copy_script]
  profile                  = "medium"
  desired_count            = 0
  subnet_ids               = module.vpc.private_subnet_ids
  security_group_ids       = [aws_security_group.backup_copy.id]
  task_role_arn            = aws_iam_role.backup_copy_task.arn
  permissions_boundary_arn = data.aws_iam_policy.permission_boundary.arn

  environment_variables = {
    RENDER_DATABASE_ID = render_postgres.db.id
    BUCKET_NAME        = local.backups_bucket
  }

  secrets = {
    RENDER_API_KEY = aws_secretsmanager_secret.render_api_key.arn
  }

  logfire = {
    token = var.logfire_token
  }

  depends_on = [aws_secretsmanager_secret_version.render_api_key]
}

data "aws_iam_policy_document" "backup_copy_scheduler_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "backup_copy_scheduler" {
  name                 = "polar-production-backup-copy-scheduler"
  assume_role_policy   = data.aws_iam_policy_document.backup_copy_scheduler_assume.json
  permissions_boundary = data.aws_iam_policy.permission_boundary.arn
}

data "aws_iam_policy_document" "backup_copy_scheduler" {
  statement {
    actions   = ["ecs:RunTask"]
    resources = ["arn:aws:ecs:us-east-2:${data.aws_caller_identity.current.account_id}:task-definition/polar-production-backup-copy:*"]

    condition {
      test     = "ArnEquals"
      variable = "ecs:cluster"
      values   = [module.ecs_cluster.cluster_arn]
    }
  }

  statement {
    actions   = ["iam:PassRole"]
    resources = [module.backup_copy.execution_role_arn, aws_iam_role.backup_copy_task.arn]
  }
}

resource "aws_iam_role_policy" "backup_copy_scheduler" {
  name   = "run-backup-copy"
  role   = aws_iam_role.backup_copy_scheduler.id
  policy = data.aws_iam_policy_document.backup_copy_scheduler.json
}

resource "aws_scheduler_schedule" "backup_copy" {
  name                = "polar-production-backup-copy"
  schedule_expression = "cron(0 12 * * ? *)"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = module.ecs_cluster.cluster_arn
    role_arn = aws_iam_role.backup_copy_scheduler.arn

    ecs_parameters {
      task_definition_arn = module.backup_copy.task_definition_arn
      launch_type         = "FARGATE"

      network_configuration {
        subnets          = module.vpc.private_subnet_ids
        security_groups  = [aws_security_group.backup_copy.id]
        assign_public_ip = false
      }
    }
  }
}

resource "aws_cloudwatch_event_connection" "slack" {
  name               = "polar-production-slack"
  authorization_type = "API_KEY"

  auth_parameters {
    api_key {
      key   = "Authorization"
      value = "Bearer ${var.backup_alert_slack_bot_token}"
    }
  }
}

resource "aws_cloudwatch_event_api_destination" "slack_post_message" {
  name                = "polar-production-slack-post-message"
  connection_arn      = aws_cloudwatch_event_connection.slack.arn
  invocation_endpoint = "https://slack.com/api/chat.postMessage"
  http_method         = "POST"
}

data "aws_iam_policy_document" "backup_copy_alert_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "backup_copy_alert" {
  name                 = "polar-production-backup-copy-alert"
  assume_role_policy   = data.aws_iam_policy_document.backup_copy_alert_assume.json
  permissions_boundary = data.aws_iam_policy.permission_boundary.arn
}

data "aws_iam_policy_document" "backup_copy_alert" {
  statement {
    actions   = ["events:InvokeApiDestination"]
    resources = [aws_cloudwatch_event_api_destination.slack_post_message.arn]
  }
}

resource "aws_iam_role_policy" "backup_copy_alert" {
  name   = "post-to-slack"
  role   = aws_iam_role.backup_copy_alert.id
  policy = data.aws_iam_policy_document.backup_copy_alert.json
}

resource "aws_cloudwatch_event_rule" "backup_copy_failed" {
  name        = "polar-production-backup-copy-failed"
  description = "Database backup copy task stopped without exiting cleanly."

  event_pattern = jsonencode({
    source      = ["aws.ecs"]
    detail-type = ["ECS Task State Change"]
    detail = {
      lastStatus = ["STOPPED"]
      group      = ["family:polar-production-backup-copy"]
      "$or" = [
        { stopCode = [{ anything-but = ["EssentialContainerExited"] }] },
        { containers = { exitCode = [{ anything-but = [0] }] } },
      ]
    }
  })
}

resource "aws_cloudwatch_event_target" "backup_copy_failed_slack" {
  rule     = aws_cloudwatch_event_rule.backup_copy_failed.name
  arn      = aws_cloudwatch_event_api_destination.slack_post_message.arn
  role_arn = aws_iam_role.backup_copy_alert.arn

  http_target {
    header_parameters = { "Content-Type" = "application/json" }
  }

  input_transformer {
    input_paths = {
      stopCode = "$.detail.stopCode"
      reason   = "$.detail.stoppedReason"
    }
    input_template = <<-EOT
      {
        "channel": "${local.backup_alert_channel}",
        "text": ":rotating_light: *Database backup copy to s3://${local.backups_bucket} failed* — <stopCode>: <reason>. The off-provider backup copy may be missing for today."
      }
    EOT
  }
}
