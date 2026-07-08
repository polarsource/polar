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
  subnet_ids = module.vpc[0].private_subnet_ids
}

resource "aws_vpc_security_group_ingress_rule" "redis_lambda" {
  count                        = local.test_enabled ? 1 : 0
  security_group_id            = module.redis[0].security_group_id
  referenced_security_group_id = aws_security_group.lambda[0].id
  from_port                    = module.redis[0].port
  to_port                      = module.redis[0].port
  ip_protocol                  = "tcp"
}

locals {
  lambda_worker_environment = local.test_enabled ? {
    POLAR_ENV                     = "test"
    POLAR_BASE_URL                = "https://test-api.polar.sh"
    POLAR_FRONTEND_BASE_URL       = "https://test.polar.sh"
    POLAR_CHECKOUT_BASE_URL       = "https://test-api.polar.sh/v1/checkout-links/{client_secret}/redirect"
    POLAR_JWKS                    = "/tmp/jwks.json"
    POLAR_LOG_LEVEL               = "INFO"
    POLAR_TESTING                 = "0"
    POLAR_POSTGRES_DATABASE       = local.db_name
    POLAR_POSTGRES_HOST           = local.db_external_host
    POLAR_POSTGRES_PORT           = local.db_port
    POLAR_POSTGRES_USER           = local.db_user
    POLAR_POSTGRES_SSL            = "true"
    POLAR_REDIS_HOST              = module.redis[0].host
    POLAR_REDIS_PORT              = tostring(module.redis[0].port)
    POLAR_REDIS_DB                = "1"
    POLAR_AWS_REGION              = "us-east-2"
    POLAR_EMAIL_SENDER            = "resend"
    POLAR_EMAIL_FROM_NAME         = "[TEST] Polar"
    POLAR_EMAIL_FROM_DOMAIN       = "notifications.test.polar.sh"
    POLAR_WORKER_SQS_ENABLED      = "true"
    POLAR_WORKER_SQS_QUEUE_PREFIX = "polar-test-tasks"
  } : {}

  lambda_worker_secrets = local.test_enabled ? {
    POLAR_CURRENT_JWK_KID = var.backend_current_jwk_kid
    POLAR_JWKS_CONTENT    = var.backend_jwks
    POLAR_LOGFIRE_TOKEN   = var.logfire_token
    POLAR_POSTGRES_PWD    = local.db_password
    POLAR_RESEND_API_KEY  = var.backend_resend_api_key
    POLAR_SECRET          = var.backend_secret
    POLAR_SENTRY_DSN      = var.backend_sentry_dsn
    TAILSCALE_AUTHKEY     = var.lambda_worker_tailscale_token
  } : {}

  lambda_worker_name                 = "default"
  lambda_worker_reserved_concurrency = null
}

module "lambda_worker" {
  count  = local.test_enabled ? 1 : 0
  source = "../modules/aws_task_worker"

  environment              = "test"
  name                     = local.lambda_worker_name
  queue_name               = "polar-test-tasks-${local.lambda_worker_name}"
  image_uri                = "${module.lambda_worker_ecr[0].repository_url}:latest"
  enabled                  = true
  reserved_concurrency     = local.lambda_worker_reserved_concurrency
  subnet_ids               = local.lambda_subnet_ids
  security_group_ids       = local.lambda_security_group_ids
  permissions_boundary_arn = data.aws_iam_policy.permission_boundary.arn

  environment_variables        = local.lambda_worker_environment
  secret_environment_variables = local.lambda_worker_secrets
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
    resources = [module.lambda_worker[0].queue_arn]
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
    sid       = "UpdateFunctionCode"
    actions   = ["lambda:UpdateFunctionCode"]
    resources = ["arn:aws:lambda:us-east-2:${data.aws_caller_identity.current.account_id}:function:${module.lambda_worker[0].function_name}"]
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

  environment  = "test"
  bucket_names = ["polar-test-files", "polar-test-public-files"]
  queue_arn    = module.lambda_worker[0].queue_arn
  queue_url    = module.lambda_worker[0].queue_url
  dlq_arn      = module.lambda_worker[0].dlq_arn
  dlq_url      = module.lambda_worker[0].dlq_url
}
