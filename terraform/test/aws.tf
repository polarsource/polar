module "lambda_worker_ecr" {
  count  = local.test_enabled ? 1 : 0
  source = "../modules/ecr_repository"

  name = "polar-test-lambda-worker"
}

data "aws_iam_policy" "permission_boundary" {
  name = "PolarPermissionBoundary"
}

module "secrets_kms" {
  count  = local.test_enabled ? 1 : 0
  source = "../modules/render_secrets_kms"

  environment              = "test"
  render_owner_id          = "tea-ch0f74hjvhtkjjvvhnr0"
  render_environment_id    = local.environment_id
  permissions_boundary_arn = data.aws_iam_policy.permission_boundary.arn
}

module "redis" {
  count  = local.test_enabled ? 1 : 0
  source = "../modules/aws_redis"

  name       = "polar-test-worker"
  vpc_id     = module.vpc[0].vpc_id
  subnet_ids = module.vpc[0].secondary_private_subnet_ids
}

resource "aws_vpc_security_group_ingress_rule" "redis_lambda" {
  count                        = local.test_enabled ? 1 : 0
  security_group_id            = module.redis[0].security_group_id
  referenced_security_group_id = aws_security_group.lambda[0].id
  from_port                    = module.redis[0].port
  to_port                      = module.redis[0].port
  ip_protocol                  = "tcp"
}

module "redis_private_link" {
  count  = local.test_enabled ? 1 : 0
  source = "../modules/redis_private_link"

  name                     = "polar-test-worker-redis"
  vpc_id                   = module.vpc[0].vpc_id
  subnet_ids               = module.vpc[0].secondary_private_subnet_ids
  nlb_name                 = "polar-test-worker-redis-b"
  target_group_name        = "polar-test-worker-redis-b"
  redis_host               = module.redis[0].host
  redis_port               = module.redis[0].port
  redis_arn                = module.redis[0].arn
  allowed_principals       = ["arn:aws:iam::557508356783:root"]
  permissions_boundary_arn = data.aws_iam_policy.permission_boundary.arn
}

resource "aws_vpc_security_group_ingress_rule" "redis_nlb" {
  count                        = local.test_enabled ? 1 : 0
  security_group_id            = module.redis[0].security_group_id
  referenced_security_group_id = module.redis_private_link[0].nlb_security_group_id
  from_port                    = module.redis[0].port
  to_port                      = module.redis[0].port
  ip_protocol                  = "tcp"
}

locals {
  files_bucket_name        = "polar-test-files"
  files_public_bucket_name = "polar-test-public-files"

  worker_sqs_queue_prefix = "polar-test-tasks"

  lambda_worker_secrets = local.test_enabled ? merge(
    module.backend_environment[0].environment_variables,
    module.backend_environment[0].secret_environment_variables,
    {
      POLAR_JWKS              = "/tmp/jwks.json"
      POLAR_POSTGRES_DATABASE = local.db_name
      POLAR_POSTGRES_HOST     = module.pgbouncer_aws[0].host
      POLAR_POSTGRES_PORT     = module.pgbouncer_aws[0].port
      POLAR_POSTGRES_USER     = local.db_user
      POLAR_POSTGRES_SSL      = "false"
      POLAR_REDIS_HOST        = module.redis[0].host
      POLAR_REDIS_PORT        = tostring(module.redis[0].port)
      POLAR_REDIS_DB          = "1"
      POLAR_JWKS_CONTENT      = var.backend_jwks
      POLAR_POSTGRES_PWD      = local.db_password
      TAILSCALE_AUTHKEY       = var.lambda_worker_tailscale_token
    },
  ) : {}

  lambda_worker_name                 = "default"
  lambda_worker_reserved_concurrency = null

  lambda_worker_tags = {
    Environment = "test"
    Service     = "task-worker"
  }

  lambda_worker_queues = {
    "high-priority"         = { timeout_seconds = 120 }
    "medium-priority"       = { timeout_seconds = 120 }
    "low-priority"          = { timeout_seconds = 660 }
    "webhooks"              = { timeout_seconds = 120, max_retries = 250 } # Must stay above webhook_event.send's max_retries.
    "tinybird"              = { timeout_seconds = 120 }
    "invoices-and-receipts" = { timeout_seconds = 240 }
  }
}

resource "aws_secretsmanager_secret" "lambda_worker" {
  count                   = local.test_enabled ? 1 : 0
  name                    = "polar-test-worker-lambda"
  recovery_window_in_days = 0
  tags                    = local.lambda_worker_tags
}

resource "aws_secretsmanager_secret_version" "lambda_worker" {
  count         = local.test_enabled ? 1 : 0
  secret_id     = aws_secretsmanager_secret.lambda_worker[0].id
  secret_string = jsonencode(local.lambda_worker_secrets)
}

module "lambda_worker" {
  count  = local.test_enabled ? 1 : 0
  source = "../modules/aws_task_worker"

  environment              = "test"
  name                     = local.lambda_worker_name
  queue_name               = "${local.worker_sqs_queue_prefix}-${local.lambda_worker_name}"
  queue_prefix             = local.worker_sqs_queue_prefix
  image_uri                = "${module.lambda_worker_ecr[0].repository_url}:latest"
  enabled                  = true
  reserved_concurrency     = local.lambda_worker_reserved_concurrency
  tags                     = local.lambda_worker_tags
  subnet_ids               = local.lambda_subnet_ids
  security_group_ids       = local.lambda_security_group_ids
  permissions_boundary_arn = data.aws_iam_policy.permission_boundary.arn

  secrets_arn        = aws_secretsmanager_secret.lambda_worker[0].arn
  secrets_version_id = aws_secretsmanager_secret_version.lambda_worker[0].version_id
  kms_key_arn        = module.secrets_kms[0].key_arn
}

module "lambda_worker_queue" {
  for_each = local.test_enabled ? local.lambda_worker_queues : {}
  source   = "../modules/aws_task_worker"

  environment              = "test"
  name                     = each.key
  queue_name               = "${local.worker_sqs_queue_prefix}-${each.key}"
  queue_prefix             = local.worker_sqs_queue_prefix
  image_uri                = "${module.lambda_worker_ecr[0].repository_url}:latest"
  enabled                  = true
  timeout_seconds          = each.value.timeout_seconds
  max_retries              = try(each.value.max_retries, null)
  tags                     = local.lambda_worker_tags
  subnet_ids               = local.lambda_subnet_ids
  security_group_ids       = local.lambda_security_group_ids
  permissions_boundary_arn = data.aws_iam_policy.permission_boundary.arn

  secrets_arn        = aws_secretsmanager_secret.lambda_worker[0].arn
  secrets_version_id = aws_secretsmanager_secret_version.lambda_worker[0].version_id
  kms_key_arn        = module.secrets_kms[0].key_arn
}

# =============================================================================
# Task producer policy (SQS send-only, attached to the Render backend OIDC role)
# =============================================================================

data "aws_iam_policy_document" "tasks_producer" {
  count = local.test_enabled ? 1 : 0

  statement {
    sid = "SendTasks"
    actions = [
      "sqs:SendMessage",
      "sqs:GetQueueUrl",
    ]
    resources = concat(
      [module.lambda_worker[0].queue_arn],
      [for worker in module.lambda_worker_queue : worker.queue_arn],
    )
  }
}

resource "aws_iam_role_policy" "tasks_producer" {
  count  = local.test_enabled ? 1 : 0
  name   = "polar-test-tasks-producer"
  role   = module.secrets_kms[0].role_name
  policy = data.aws_iam_policy_document.tasks_producer[0].json
}

# =============================================================================
# GitHub Actions OIDC role (builds the task-worker image and deploys it)
# =============================================================================

data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "lambda_worker_deploy" {
  count = local.test_enabled ? 1 : 0

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
    resources = [module.lambda_worker_ecr[0].repository_arn]
  }

  statement {
    sid     = "UpdateFunctionCode"
    actions = ["lambda:UpdateFunctionCode"]
    resources = [
      for function_name in concat(
        [module.lambda_worker[0].function_name],
        [for worker in module.lambda_worker_queue : worker.function_name],
      ) :
      "arn:aws:lambda:us-east-2:${data.aws_caller_identity.current.account_id}:function:${function_name}"
    ]
  }
}

resource "aws_iam_policy" "lambda_worker_deploy" {
  count  = local.test_enabled ? 1 : 0
  name   = "github-actions-lambda-worker-deploy-test"
  policy = data.aws_iam_policy_document.lambda_worker_deploy[0].json
}

module "github_oidc_lambda_worker" {
  count  = local.test_enabled ? 1 : 0
  source = "../modules/github_oidc"

  role_name       = "github-actions-lambda-worker-test"
  github_org      = "polarsource"
  github_repo     = "polar"
  github_subjects = ["ref:refs/heads/main"]
  policy_arns = {
    deploy = aws_iam_policy.lambda_worker_deploy[0].arn
  }
  permissions_boundary_arn = data.aws_iam_policy.permission_boundary.arn
}

# =============================================================================
# GuardDuty malware scan results → tasks queue
# =============================================================================

module "guardduty_scan_events" {
  source = "../modules/guardduty_scan_events"
  count  = local.test_enabled ? 1 : 0

  environment       = "test"
  bucket_names      = [local.files_bucket_name, local.files_public_bucket_name]
  source_account_id = "975049931254"
  queue_arn         = module.lambda_worker[0].queue_arn
  queue_url         = module.lambda_worker[0].queue_url
  dlq_arn           = module.lambda_worker[0].dlq_arn
  dlq_url           = module.lambda_worker[0].dlq_url
}

module "grafana_cloudwatch_role" {
  count  = local.test_enabled ? 1 : 0
  source = "../modules/grafana_cloudwatch_role"

  name                     = "polar-test-grafana-cloudwatch"
  external_id              = var.grafana_cloud_aws_external_id
  permissions_boundary_arn = data.aws_iam_policy.permission_boundary.arn
  tags                     = local.lambda_worker_tags
}
