data "aws_region" "current" {}

locals {
  full_name = "polar-${var.environment}-${var.name}"

  aws_names = {
    log_group      = { value = "/ecs/${local.full_name}", max = 512 }
    execution_role = { value = "${local.full_name}-execution", max = 64 }
    task_family    = { value = local.full_name, max = 255 }
    service        = { value = local.full_name, max = 255 }
  }

  profiles = {
    tiny   = { cpu = 256, memory = 512 }
    small  = { cpu = 512, memory = 1024 }
    medium = { cpu = 1024, memory = 2048 }
    big    = { cpu = 2048, memory = 4096 }
  }

  cpu    = var.profile != null ? local.profiles[var.profile].cpu : var.cpu
  memory = var.profile != null ? local.profiles[var.profile].memory : var.memory

  secret_arns = concat(
    values(var.secrets),
    var.logfire == null ? [] : [aws_secretsmanager_secret.logfire_header[0].arn],
  )

  fargate_memory_by_cpu = {
    "256"   = [512, 1024, 2048]
    "512"   = range(1024, 4097, 1024)
    "1024"  = range(2048, 8193, 1024)
    "2048"  = range(4096, 16385, 1024)
    "4096"  = range(8192, 30721, 1024)
    "8192"  = range(16384, 61441, 4096)
    "16384" = range(32768, 122881, 8192)
  }
}

resource "aws_cloudwatch_log_group" "this" {
  name              = local.aws_names.log_group.value
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

data "aws_iam_policy_document" "assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name                 = local.aws_names.execution_role.value
  assume_role_policy   = data.aws_iam_policy_document.assume_role.json
  permissions_boundary = var.permissions_boundary_arn
  tags                 = var.tags
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "repository_credentials" {
  count = var.repository_credentials == null ? 0 : 1

  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.repository_credentials.arn]
  }
}

resource "aws_iam_role_policy" "repository_credentials" {
  count  = var.repository_credentials == null ? 0 : 1
  name   = "repository-credentials"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.repository_credentials[0].json
}

resource "aws_secretsmanager_secret" "logfire_header" {
  count = var.logfire == null ? 0 : 1
  name  = "${local.full_name}-logfire-header"
  tags  = var.tags
}

resource "aws_secretsmanager_secret_version" "logfire_header" {
  count         = var.logfire == null ? 0 : 1
  secret_id     = aws_secretsmanager_secret.logfire_header[0].id
  secret_string = "Authorization ${var.logfire.token}"
}

data "aws_iam_policy_document" "secrets" {
  count = length(local.secret_arns) == 0 ? 0 : 1

  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = local.secret_arns
  }
}

resource "aws_iam_role_policy" "secrets" {
  count  = length(local.secret_arns) == 0 ? 0 : 1
  name   = "secrets"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.secrets[0].json
}

resource "aws_ecs_task_definition" "this" {
  family                   = local.aws_names.task_family.value
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = local.cpu
  memory                   = local.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = var.task_role_arn
  tags                     = var.tags

  container_definitions = jsonencode(concat(
    [
      merge(
        {
          name      = local.full_name
          image     = var.image
          essential = true
          command   = var.command
          environment = [
            for key, value in var.environment_variables : { name = key, value = value }
          ]
          portMappings = var.container_port == null ? [] : [
            { containerPort = var.container_port, protocol = "tcp" }
          ]
          logConfiguration = merge(
            {
              logDriver = var.logfire == null ? "awslogs" : "awsfirelens"
              options = var.logfire == null ? {
                "awslogs-group"         = aws_cloudwatch_log_group.this.name
                "awslogs-region"        = data.aws_region.current.region
                "awslogs-stream-prefix" = local.full_name
                } : {
                Name                     = "opentelemetry"
                host                     = var.logfire.host
                port                     = "443"
                tls                      = "on"
                "tls.verify"             = "on"
                logs_uri                 = "/v1/logs"
                compress                 = "gzip"
                logs_body_key            = "log"
                logs_body_key_attributes = "true"
              }
            },
            var.logfire == null ? {} : {
              secretOptions = [
                { name = "header", valueFrom = aws_secretsmanager_secret.logfire_header[0].arn }
              ]
            },
          )
        },
        var.repository_credentials == null ? {} : {
          repositoryCredentials = { credentialsParameter = var.repository_credentials.arn }
        },
        length(var.secrets) == 0 ? {} : {
          secrets = [for name, arn in var.secrets : { name = name, valueFrom = arn }]
        },
      )
    ],
    var.logfire == null ? [] : [
      {
        name              = "log-router"
        image             = var.logfire.router_image
        essential         = true
        memoryReservation = 51
        firelensConfiguration = {
          type    = "fluentbit"
          options = { "enable-ecs-log-metadata" = "true" }
        }
        logConfiguration = {
          logDriver = "awslogs"
          options = {
            "awslogs-group"         = aws_cloudwatch_log_group.this.name
            "awslogs-region"        = data.aws_region.current.region
            "awslogs-stream-prefix" = "firelens"
          }
        }
      }
    ],
  ))

  lifecycle {
    replace_triggered_by = [aws_secretsmanager_secret_version.logfire_header]

    precondition {
      condition     = alltrue([for n in local.aws_names : length(n.value) <= n.max])
      error_message = "Name over its AWS length limit: ${join(", ", [for key, n in local.aws_names : "${key} \"${n.value}\" (${length(n.value)} > ${n.max})" if length(n.value) > n.max])}."
    }

    precondition {
      condition     = var.profile != null ? var.cpu == null && var.memory == null : var.cpu != null && var.memory != null
      error_message = "Set either profile or both cpu and memory, not both."
    }

    precondition {
      condition     = local.cpu == null || local.memory == null || contains(keys(local.fargate_memory_by_cpu), tostring(local.cpu)) && contains(local.fargate_memory_by_cpu[tostring(local.cpu)], local.memory)
      error_message = "Invalid Fargate combination: ${jsonencode(local.cpu)} CPU units with ${jsonencode(local.memory)} MiB."
    }
  }
}

resource "aws_ecs_service" "this" {
  name            = local.aws_names.service.value
  cluster         = var.cluster_arn
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"
  tags            = var.tags

  network_configuration {
    subnets         = var.subnet_ids
    security_groups = var.security_group_ids
  }

  dynamic "service_registries" {
    for_each = var.service_registry == null ? [] : [var.service_registry.arn]
    content {
      registry_arn = service_registries.value
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.execution,
    aws_iam_role_policy.repository_credentials,
    aws_iam_role_policy.secrets,
  ]
}
