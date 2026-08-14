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

resource "aws_ecs_task_definition" "this" {
  family                   = local.aws_names.task_family.value
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = local.cpu
  memory                   = local.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = var.task_role_arn
  tags                     = var.tags

  container_definitions = jsonencode([
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
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.this.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = local.full_name
        }
      }
    }
  ])

  lifecycle {
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

  depends_on = [aws_iam_role_policy_attachment.execution]
}
