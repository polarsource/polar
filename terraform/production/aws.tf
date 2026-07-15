data "aws_iam_policy" "permission_boundary" {
  name = "PolarPermissionBoundary"
}

module "secrets_kms" {
  source = "../modules/render_secrets_kms"

  environment              = "production"
  render_owner_id          = "tea-ch0f74hjvhtkjjvvhnr0"
  render_environment_id    = render_project.polar.environments["Production"].id
  permissions_boundary_arn = data.aws_iam_policy.permission_boundary.arn
}

module "lambda_worker_ecr" {
  source = "../modules/ecr_repository"

  name = "polar-production-lambda-worker"
}

module "redis" {
  source = "../modules/aws_redis"

  name       = "polar-production-worker"
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
  files_bucket_name        = "polar-production-files"
  files_public_bucket_name = "polar-public-files"

  lambda_worker_environment = {
    POLAR_ENV                         = "production"
    POLAR_BASE_URL                    = "https://api.polar.sh"
    POLAR_FRONTEND_BASE_URL           = "https://polar.sh"
    POLAR_CHECKOUT_BASE_URL           = "https://buy.polar.sh/{client_secret}"
    POLAR_JWKS                        = "/tmp/jwks.json"
    POLAR_LOG_LEVEL                   = "INFO"
    POLAR_TESTING                     = "0"
    POLAR_POSTGRES_DATABASE           = "polar_cpit_p9lf"
    POLAR_POSTGRES_HOST               = local.db_external_host
    POLAR_POSTGRES_PORT               = local.db_port
    POLAR_POSTGRES_USER               = local.db_user
    POLAR_POSTGRES_SSL                = "true"
    POLAR_REDIS_HOST                  = module.redis.host
    POLAR_REDIS_PORT                  = tostring(module.redis.port)
    POLAR_REDIS_DB                    = "1"
    POLAR_AWS_REGION                  = "us-east-2"
    POLAR_S3_FILES_BUCKET_NAME        = local.files_bucket_name
    POLAR_S3_FILES_PUBLIC_BUCKET_NAME = local.files_public_bucket_name
    POLAR_EMAIL_SENDER                = "resend"
    POLAR_EMAIL_FROM_NAME             = "Polar"
    POLAR_EMAIL_FROM_DOMAIN           = "notifications.polar.sh"
    POLAR_WORKER_SQS_ENABLED          = "true"
    POLAR_WORKER_SQS_QUEUE_PREFIX     = "polar-production-tasks"
  }

  lambda_worker_secrets = {
    POLAR_CURRENT_JWK_KID = var.backend_current_jwk_kid_production
    POLAR_JWKS_CONTENT    = var.backend_jwks_production
    POLAR_LOGFIRE_TOKEN   = var.logfire_token
    POLAR_POSTGRES_PWD    = local.db_password
    POLAR_RESEND_API_KEY  = var.backend_resend_api_key_production
    POLAR_SECRET          = var.backend_secret_production
    POLAR_SENTRY_DSN      = var.backend_sentry_dsn_production
    TAILSCALE_AUTHKEY     = var.lambda_worker_tailscale_token
  }

  lambda_worker_name                 = "default"
  lambda_worker_reserved_concurrency = null
}

module "lambda_worker" {
  source = "../modules/aws_task_worker"

  environment              = "production"
  name                     = local.lambda_worker_name
  queue_name               = "polar-production-tasks-${local.lambda_worker_name}"
  image_uri                = "${module.lambda_worker_ecr.repository_url}:latest"
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
  statement {
    sid = "SendTasks"
    actions = [
      "sqs:SendMessage",
      "sqs:GetQueueUrl",
    ]
    resources = [module.lambda_worker.queue_arn]
  }
}

resource "aws_iam_role_policy" "tasks_producer" {
  name   = "polar-production-tasks-producer"
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
    sid       = "UpdateFunctionCode"
    actions   = ["lambda:UpdateFunctionCode"]
    resources = ["arn:aws:lambda:us-east-2:${data.aws_caller_identity.current.account_id}:function:${module.lambda_worker.function_name}"]
  }
}

resource "aws_iam_policy" "lambda_worker_deploy" {
  name   = "github-actions-lambda-worker-deploy-production"
  policy = data.aws_iam_policy_document.lambda_worker_deploy.json
}

module "github_oidc_lambda_worker" {
  source = "../modules/github_oidc"

  role_name       = "github-actions-lambda-worker-production"
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

  environment       = "production"
  bucket_names      = [local.files_bucket_name, local.files_public_bucket_name]
  source_account_id = "975049931254"
  queue_arn         = module.lambda_worker.queue_arn
  queue_url         = module.lambda_worker.queue_url
  dlq_arn           = module.lambda_worker.dlq_arn
  dlq_url           = module.lambda_worker.dlq_url
}
