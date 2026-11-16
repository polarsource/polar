data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

locals {
  prefix            = "polar-${var.environment}-claude"
  runner_container  = "runner"
  session_family    = "${local.prefix}-session"
  account_id        = data.aws_caller_identity.current.account_id
  region            = data.aws_region.current.region
  session_log_group = "/ecs/${local.session_family}"

  # Match server/.env.template so the session hook's generated .env works unchanged.
  postgres_user     = "polar"
  postgres_password = "polar"
  postgres_database = "polar"
  minio_user        = "polar"
  minio_password    = "polarpolar"

  sidecar_log = {
    logDriver = "awslogs"
    options = {
      "awslogs-group"         = local.session_log_group
      "awslogs-region"        = local.region
      "awslogs-stream-prefix" = "sidecar"
    }
  }
}

# =============================================================================
# Networking: outbound only. The VPC itself has no route to other environments.
# =============================================================================

resource "aws_security_group" "orchestrator" {
  name_prefix = "${local.prefix}-orchestrator-"
  description = "Claude orchestrator: outbound to Anthropic, Tailscale and AWS APIs."
  vpc_id      = var.vpc_id
  tags        = merge(var.tags, { Name = "${local.prefix}-orchestrator" })

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "session" {
  name_prefix = "${local.prefix}-session-"
  description = "Claude session tasks: outbound only, no inbound."
  vpc_id      = var.vpc_id
  tags        = merge(var.tags, { Name = "${local.prefix}-session" })

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# =============================================================================
# Secrets
# =============================================================================

resource "aws_secretsmanager_secret" "environment_secret" {
  name = "${local.prefix}-environment-secret"
  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "environment_secret" {
  secret_id     = aws_secretsmanager_secret.environment_secret.id
  secret_string = var.environment_secret
}

resource "aws_secretsmanager_secret" "tailscale_oauth_client_secret" {
  name = "${local.prefix}-tailscale-oauth-client-secret"
  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "tailscale_oauth_client_secret" {
  secret_id     = aws_secretsmanager_secret.tailscale_oauth_client_secret.id
  secret_string = var.tailscale_oauth_client_secret
}

# =============================================================================
# Session task: one per Claude session, destroyed when the runner exits.
# It gets an execution role (image pull, logs) and deliberately no task role,
# so code running in the session holds no AWS credentials.
# =============================================================================

resource "aws_cloudwatch_log_group" "session" {
  name              = local.session_log_group
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

data "aws_iam_policy_document" "ecs_tasks_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "session_execution" {
  name                 = "${local.session_family}-execution"
  assume_role_policy   = data.aws_iam_policy_document.ecs_tasks_assume_role.json
  permissions_boundary = var.permissions_boundary_arn
  tags                 = var.tags
}

resource "aws_iam_role_policy_attachment" "session_execution" {
  role       = aws_iam_role.session_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "session_execution_registry" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.repository_credentials_arn]
  }
}

resource "aws_iam_role_policy" "session_execution_registry" {
  name   = "repository-credentials"
  role   = aws_iam_role.session_execution.id
  policy = data.aws_iam_policy_document.session_execution_registry.json
}

resource "aws_ecs_task_definition" "session" {
  family                   = local.session_family
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.session_cpu
  memory                   = var.session_memory
  execution_role_arn       = aws_iam_role.session_execution.arn
  tags                     = var.tags

  ephemeral_storage {
    size_in_gib = var.session_ephemeral_storage_gib
  }

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name                  = local.runner_container
      image                 = var.image
      essential             = true
      command               = ["runner"]
      stopTimeout           = 120
      repositoryCredentials = { credentialsParameter = var.repository_credentials_arn }
      environment = [
        for key, value in {
          POLAR_SESSION_SERVICES          = "sidecars"
          SPEAKEASY_GATEWAY_URL           = var.speakeasy_gateway_url
          CLAUDE_RELEASE_IDLE_SESSION_MIN = tostring(var.release_idle_session_min)
          CLAUDE_KILL_SESSION_AFTER_MIN   = tostring(var.kill_session_after_min)
        } : { name = key, value = value }
      ]
      dependsOn = [
        { containerName = "postgres", condition = "HEALTHY" },
        { containerName = "redis", condition = "HEALTHY" },
        { containerName = "minio", condition = "HEALTHY" },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = local.session_log_group
          "awslogs-region"        = local.region
          "awslogs-stream-prefix" = "runner"
        }
      }
    },
    {
      name              = "postgres"
      image             = "postgres:18.6-bookworm"
      essential         = false
      memoryReservation = 1024
      # Throwaway test database: durability settings off for speed. Fargate's small
      # /dev/shm cannot be resized, so parallel query uses mmap-backed shared memory.
      command = [
        "postgres",
        "-c", "max_locks_per_transaction=256",
        "-c", "fsync=off",
        "-c", "synchronous_commit=off",
        "-c", "full_page_writes=off",
        "-c", "dynamic_shared_memory_type=mmap",
      ]
      environment = [
        { name = "POSTGRES_USER", value = local.postgres_user },
        { name = "POSTGRES_PASSWORD", value = local.postgres_password },
        { name = "POSTGRES_DB", value = local.postgres_database },
      ]
      healthCheck = {
        command     = ["CMD-SHELL", "pg_isready -q -U ${local.postgres_user} -d ${local.postgres_database}"]
        interval    = 5
        timeout     = 5
        retries     = 20
        startPeriod = 10
      }
      logConfiguration = local.sidecar_log
    },
    {
      name              = "redis"
      image             = "redis:8-alpine"
      essential         = false
      memoryReservation = 256
      healthCheck = {
        command  = ["CMD", "redis-cli", "ping"]
        interval = 5
        timeout  = 5
        retries  = 20
      }
      logConfiguration = local.sidecar_log
    },
    {
      name              = "minio"
      image             = "bitnamilegacy/minio:2024.5.28"
      essential         = false
      memoryReservation = 512
      environment = [
        { name = "MINIO_ROOT_USER", value = local.minio_user },
        { name = "MINIO_ROOT_PASSWORD", value = local.minio_password },
      ]
      healthCheck = {
        command     = ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
        interval    = 5
        timeout     = 5
        retries     = 20
        startPeriod = 10
      }
      logConfiguration = local.sidecar_log
    },
  ])
}

# =============================================================================
# Orchestrator: polls Anthropic for queued sessions and starts one session task
# for each through hooks/spawn-runner. It never runs session code.
# =============================================================================

data "aws_iam_policy_document" "orchestrator" {
  statement {
    sid       = "RunSessionTasks"
    actions   = ["ecs:RunTask"]
    resources = ["arn:aws:ecs:${local.region}:${local.account_id}:task-definition/${local.session_family}:*"]

    condition {
      test     = "ArnEquals"
      variable = "ecs:cluster"
      values   = [var.cluster_arn]
    }
  }

  statement {
    sid       = "TagSessionTasks"
    actions   = ["ecs:TagResource"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "ecs:CreateAction"
      values   = ["RunTask"]
    }
  }

  statement {
    sid       = "PassSessionExecutionRole"
    actions   = ["iam:PassRole"]
    resources = [aws_iam_role.session_execution.arn]

    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "orchestrator" {
  name                 = "${local.prefix}-orchestrator-task"
  assume_role_policy   = data.aws_iam_policy_document.ecs_tasks_assume_role.json
  permissions_boundary = var.permissions_boundary_arn
  tags                 = var.tags
}

resource "aws_iam_role_policy" "orchestrator" {
  name   = "run-session-tasks"
  role   = aws_iam_role.orchestrator.id
  policy = data.aws_iam_policy_document.orchestrator.json
}

module "orchestrator" {
  source = "../ecs_service"

  environment              = var.environment
  name                     = "claude-orchestrator"
  cluster_arn              = var.cluster_arn
  image                    = var.image
  command                  = ["orchestrator"]
  profile                  = "small"
  desired_count            = 1
  stop_timeout             = 60
  subnet_ids               = var.subnet_ids
  security_group_ids       = [aws_security_group.orchestrator.id]
  task_role_arn            = aws_iam_role.orchestrator.arn
  repository_credentials   = { arn = var.repository_credentials_arn }
  permissions_boundary_arn = var.permissions_boundary_arn
  log_retention_days       = var.log_retention_days
  tags                     = var.tags

  environment_variables = {
    RUNNER_CLUSTER           = var.cluster_arn
    RUNNER_TASK_DEFINITION   = aws_ecs_task_definition.session.family
    RUNNER_CONTAINER_NAME    = local.runner_container
    RUNNER_SUBNETS           = join(",", var.subnet_ids)
    RUNNER_SECURITY_GROUPS   = aws_security_group.session.id
    RUNNER_CAPACITY_PROVIDER = var.capacity_provider
    TS_OAUTH_CLIENT_ID       = var.tailscale_oauth_client_id
    TS_SESSION_TAG           = var.tailscale_session_tag
    CLAUDE_MIN_IDLE          = tostring(var.min_idle)
  }

  secrets = {
    CLAUDE_ENVIRONMENT_SECRET = aws_secretsmanager_secret.environment_secret.arn
    TS_OAUTH_CLIENT_SECRET    = aws_secretsmanager_secret.tailscale_oauth_client_secret.arn
  }

  depends_on = [
    aws_secretsmanager_secret_version.environment_secret,
    aws_secretsmanager_secret_version.tailscale_oauth_client_secret,
  ]
}
