data "aws_iam_policy" "permission_boundary" {
  name = "PolarPermissionBoundary"
}

module "secrets_kms" {
  source = "../modules/render_secrets_kms"

  environment              = "sandbox"
  render_owner_id          = "tea-ch0f74hjvhtkjjvvhnr0"
  render_environment_id    = data.tfe_outputs.production.values.sandbox_environment_id
  permissions_boundary_arn = data.aws_iam_policy.permission_boundary.arn
}

module "lambda_worker_ecr" {
  source = "../modules/ecr_repository"

  name = "polar-sandbox-lambda-worker"
}

module "redis" {
  source = "../modules/aws_redis"

  name       = "polar-sandbox-worker"
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.secondary_private_subnet_ids
  node_type  = "cache.t4g.small"
  node_count = 2
}

resource "aws_vpc_security_group_ingress_rule" "redis_lambda" {
  security_group_id            = module.redis.security_group_id
  referenced_security_group_id = aws_security_group.lambda.id
  from_port                    = module.redis.port
  to_port                      = module.redis.port
  ip_protocol                  = "tcp"
}

module "redis_private_link" {
  source = "../modules/redis_private_link"

  name                     = "polar-sandbox-worker-redis"
  vpc_id                   = module.vpc.vpc_id
  subnet_ids               = module.vpc.private_subnet_ids
  redis_host               = module.redis.host
  redis_port               = module.redis.port
  redis_arn                = module.redis.arn
  allowed_principals       = ["arn:aws:iam::557508356783:root"]
  permissions_boundary_arn = data.aws_iam_policy.permission_boundary.arn
}

resource "aws_vpc_security_group_ingress_rule" "redis_nlb" {
  security_group_id            = module.redis.security_group_id
  referenced_security_group_id = module.redis_private_link.nlb_security_group_id
  from_port                    = module.redis.port
  to_port                      = module.redis.port
  ip_protocol                  = "tcp"
}

module "redis_private_link_b" {
  source = "../modules/redis_private_link"

  name                     = "polar-sandbox-worker-redis-b"
  vpc_id                   = module.vpc.vpc_id
  subnet_ids               = module.vpc.secondary_private_subnet_ids
  redis_host               = module.redis.host
  redis_port               = module.redis.port
  redis_arn                = module.redis.arn
  allowed_principals       = ["arn:aws:iam::557508356783:root"]
  permissions_boundary_arn = data.aws_iam_policy.permission_boundary.arn
}

resource "aws_vpc_security_group_ingress_rule" "redis_nlb_b" {
  security_group_id            = module.redis.security_group_id
  referenced_security_group_id = module.redis_private_link_b.nlb_security_group_id
  from_port                    = module.redis.port
  to_port                      = module.redis.port
  ip_protocol                  = "tcp"
}

locals {
  files_bucket_name        = "polar-sandbox-files"
  files_public_bucket_name = "polar-public-sandbox-files"

  worker_sqs_queue_prefix = "polar-sandbox-tasks"

  lambda_worker_secrets = merge(
    module.backend_environment.environment_variables,
    module.backend_environment.secret_environment_variables,
    {
      POLAR_JWKS              = "/tmp/jwks.json"
      POLAR_POSTGRES_DATABASE = "polar_sandbox"
      POLAR_POSTGRES_HOST     = module.pgbouncer_aws.host
      POLAR_POSTGRES_PORT     = module.pgbouncer_aws.port
      POLAR_POSTGRES_USER     = local.db_user
      POLAR_POSTGRES_SSL      = "false"
      POLAR_REDIS_HOST        = module.redis.host
      POLAR_REDIS_PORT        = tostring(module.redis.port)
      POLAR_REDIS_DB          = "1"
      POLAR_JWKS_CONTENT      = var.backend_jwks_sandbox
      POLAR_POSTGRES_PWD      = local.db_password
      TAILSCALE_AUTHKEY       = var.lambda_worker_tailscale_token
    },
  )

  lambda_worker_name                 = "default"
  lambda_worker_reserved_concurrency = null

  lambda_worker_tags = {
    Environment = "sandbox"
    Service     = "task-worker"
  }

  lambda_worker_queues = {
    "high-priority"         = {}
    "medium-priority"       = { max_parallel_tasks = 8 }
    "low-priority"          = { max_parallel_tasks = 16, task_time_limit_seconds = 660 }
    "webhooks"              = { max_parallel_tasks = 16, max_retries = 250 } # Must stay above webhook_event.send's max_retries.
    "tinybird"              = { max_parallel_tasks = 128 }
    "invoices-and-receipts" = { max_parallel_tasks = 3, task_time_limit_seconds = 240 }
  }
}

resource "aws_secretsmanager_secret" "lambda_worker" {
  name = "polar-sandbox-worker-lambda"
  tags = local.lambda_worker_tags
}

resource "aws_secretsmanager_secret_version" "lambda_worker" {
  secret_id     = aws_secretsmanager_secret.lambda_worker.id
  secret_string = jsonencode(local.lambda_worker_secrets)
}

module "lambda_worker" {
  source = "../modules/aws_task_worker"

  environment              = "sandbox"
  name                     = local.lambda_worker_name
  queue_name               = "${local.worker_sqs_queue_prefix}-${local.lambda_worker_name}"
  queue_prefix             = local.worker_sqs_queue_prefix
  image_uri                = "${module.lambda_worker_ecr.repository_url}:latest"
  enabled                  = true
  reserved_concurrency     = local.lambda_worker_reserved_concurrency
  tags                     = local.lambda_worker_tags
  subnet_ids               = local.lambda_subnet_ids
  security_group_ids       = local.lambda_security_group_ids
  permissions_boundary_arn = data.aws_iam_policy.permission_boundary.arn

  secrets_arn        = aws_secretsmanager_secret.lambda_worker.arn
  secrets_version_id = aws_secretsmanager_secret_version.lambda_worker.version_id
  kms_key_arn        = module.secrets_kms.key_arn
}

module "lambda_worker_queue" {
  for_each = local.lambda_worker_queues
  source   = "../modules/aws_task_worker"

  environment              = "sandbox"
  name                     = each.key
  queue_name               = "${local.worker_sqs_queue_prefix}-${each.key}"
  queue_prefix             = local.worker_sqs_queue_prefix
  image_uri                = "${module.lambda_worker_ecr.repository_url}:latest"
  enabled                  = try(each.value.processing_enabled, null)
  timeout_seconds          = try(each.value.task_time_limit_seconds, null)
  max_concurrency          = try(each.value.max_parallel_tasks, null)
  reserved_concurrency     = try(each.value.guaranteed_parallel_tasks, null)
  max_retries              = try(each.value.max_retries, null)
  memory_size              = try(each.value.memory_mb, null)
  tags                     = local.lambda_worker_tags
  subnet_ids               = local.lambda_subnet_ids
  security_group_ids       = local.lambda_security_group_ids
  permissions_boundary_arn = data.aws_iam_policy.permission_boundary.arn

  secrets_arn        = aws_secretsmanager_secret.lambda_worker.arn
  secrets_version_id = aws_secretsmanager_secret_version.lambda_worker.version_id
  kms_key_arn        = module.secrets_kms.key_arn
}

moved {
  from = module.dummy_lambda_worker
  to   = module.lambda_worker["low-priority"]
}

moved {
  from = module.lambda_worker["low-priority"]
  to   = module.lambda_worker
}

# =============================================================================
# Task producer policy (SQS send-only, attached to the Render backend OIDC role)
# =============================================================================

data "aws_iam_policy_document" "tasks_producer" {
  statement {
    sid = "SendTasks"
    actions = [
      "sqs:SendMessage",
      "sqs:GetQueueUrl",
    ]
    resources = concat(
      [module.lambda_worker.queue_arn],
      [for worker in module.lambda_worker_queue : worker.queue_arn],
    )
  }
}

resource "aws_iam_role_policy" "tasks_producer" {
  name   = "polar-sandbox-tasks-producer"
  role   = module.secrets_kms.role_name
  policy = data.aws_iam_policy_document.tasks_producer.json
}

# =============================================================================
# GitHub Actions OIDC role (builds the task-worker image and deploys it)
# =============================================================================

data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "lambda_worker_deploy" {
  statement {
    sid       = "EcrAuthorization"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "EcrPush"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
    ]
    resources = [module.lambda_worker_ecr.repository_arn]
  }

  statement {
    sid     = "UpdateFunctionCode"
    actions = ["lambda:UpdateFunctionCode"]
    resources = [
      for function_name in concat(
        [module.lambda_worker.function_name],
        [for worker in module.lambda_worker_queue : worker.function_name],
      ) :
      "arn:aws:lambda:us-east-2:${data.aws_caller_identity.current.account_id}:function:${function_name}"
    ]
  }
}

resource "aws_iam_policy" "lambda_worker_deploy" {
  name   = "github-actions-lambda-worker-deploy"
  policy = data.aws_iam_policy_document.lambda_worker_deploy.json
}

module "github_oidc_lambda_worker" {
  source = "../modules/github_oidc"

  role_name       = "github-actions-lambda-worker"
  github_org      = "polarsource"
  github_repo     = "polar"
  github_subjects = ["ref:refs/heads/main"]
  policy_arns = {
    deploy = aws_iam_policy.lambda_worker_deploy.arn
  }
  permissions_boundary_arn = data.aws_iam_policy.permission_boundary.arn
}

# =============================================================================
# GuardDuty malware scan results → tasks queue
# =============================================================================

module "guardduty_scan_events" {
  source = "../modules/guardduty_scan_events"

  environment       = "sandbox"
  bucket_names      = [local.files_bucket_name, local.files_public_bucket_name]
  source_account_id = "975049931254"
  queue_arn         = module.lambda_worker.queue_arn
  queue_url         = module.lambda_worker.queue_url
  dlq_arn           = module.lambda_worker.dlq_arn
  dlq_url           = module.lambda_worker.dlq_url
}

module "grafana_cloudwatch_role" {
  source = "../modules/grafana_cloudwatch_role"

  name                     = "polar-sandbox-grafana-cloudwatch"
  external_id              = var.grafana_cloud_aws_external_id
  permissions_boundary_arn = data.aws_iam_policy.permission_boundary.arn
  tags                     = local.lambda_worker_tags
}
