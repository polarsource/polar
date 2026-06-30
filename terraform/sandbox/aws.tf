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
  subnet_ids = module.vpc.private_subnet_ids
}

resource "aws_vpc_security_group_ingress_rule" "redis_lambda" {
  security_group_id            = module.redis.security_group_id
  referenced_security_group_id = aws_security_group.lambda.id
  from_port                    = module.redis.port
  to_port                      = module.redis.port
  ip_protocol                  = "tcp"
}

locals {
  lambda_worker_environment = {
    POLAR_ENV                     = "sandbox"
    POLAR_BASE_URL                = "https://sandbox-api.polar.sh"
    POLAR_FRONTEND_BASE_URL       = "https://sandbox.polar.sh"
    POLAR_CHECKOUT_BASE_URL       = "https://sandbox-api.polar.sh/v1/checkout-links/{client_secret}/redirect"
    POLAR_JWKS                    = "/tmp/jwks.json"
    POLAR_LOG_LEVEL               = "INFO"
    POLAR_TESTING                 = "0"
    POLAR_POSTGRES_DATABASE       = "polar_sandbox"
    POLAR_POSTGRES_HOST           = local.db_external_host
    POLAR_POSTGRES_PORT           = local.db_port
    POLAR_POSTGRES_USER           = local.db_user
    POLAR_POSTGRES_SSL            = "true"
    POLAR_REDIS_HOST              = module.redis.host
    POLAR_REDIS_PORT              = tostring(module.redis.port)
    POLAR_REDIS_DB                = "1"
    POLAR_AWS_REGION              = "us-east-2"
    POLAR_EMAIL_SENDER            = "resend"
    POLAR_EMAIL_FROM_NAME         = "[SANDBOX] Polar"
    POLAR_EMAIL_FROM_DOMAIN       = "notifications.sandbox.polar.sh"
    POLAR_WORKER_SQS_ENABLED      = "true"
    POLAR_WORKER_SQS_QUEUE_PREFIX = "polar-sandbox-tasks"
  }

  lambda_worker_secrets = {
    POLAR_CURRENT_JWK_KID = var.backend_current_jwk_kid_sandbox
    POLAR_JWKS_CONTENT    = var.backend_jwks_sandbox
    POLAR_LOGFIRE_TOKEN   = var.logfire_token
    POLAR_POSTGRES_PWD    = local.db_password
    POLAR_RESEND_API_KEY  = var.backend_resend_api_key_sandbox
    POLAR_SECRET          = var.backend_secret_sandbox
    POLAR_SENTRY_DSN      = var.backend_sentry_dsn_sandbox
    TAILSCALE_AUTHKEY     = var.lambda_worker_tailscale_token
  }

  lambda_worker_name                 = "default"
  lambda_worker_reserved_concurrency = null
}

module "lambda_worker" {
  source = "../modules/aws_task_worker"

  environment              = "sandbox"
  name                     = local.lambda_worker_name
  queue_name               = "polar-sandbox-tasks-${local.lambda_worker_name}"
  image_uri                = "${module.lambda_worker_ecr.repository_url}:latest"
  enabled                  = true
  reserved_concurrency     = local.lambda_worker_reserved_concurrency
  subnet_ids               = local.lambda_subnet_ids
  security_group_ids       = local.lambda_security_group_ids
  permissions_boundary_arn = data.aws_iam_policy.permission_boundary.arn

  environment_variables        = local.lambda_worker_environment
  secret_environment_variables = local.lambda_worker_secrets
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
# Task producer IAM user (SQS send-only, used by the Render backend)
# =============================================================================

resource "aws_iam_user" "tasks_producer" {
  name = "polar-sandbox-tasks-producer"
}

resource "aws_iam_access_key" "tasks_producer" {
  user = aws_iam_user.tasks_producer.name
}

data "aws_iam_policy_document" "tasks_producer" {
  statement {
    sid = "SendTasks"
    actions = [
      "sqs:SendMessage",
      "sqs:GetQueueUrl",
    ]
    resources = [module.lambda_worker.queue_arn]
  }
}

resource "aws_iam_user_policy" "tasks_producer" {
  name   = "polar-sandbox-tasks-producer"
  user   = aws_iam_user.tasks_producer.name
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
    sid       = "UpdateFunctionCode"
    actions   = ["lambda:UpdateFunctionCode"]
    resources = ["arn:aws:lambda:us-east-2:${data.aws_caller_identity.current.account_id}:function:${module.lambda_worker.function_name}"]
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
