data "aws_region" "current" {}

locals {
  full_name = "polar-${var.environment}-${var.name}"
}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/ecs/${local.full_name}"
  retention_in_days = var.log_retention_days
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
  name                 = "${local.full_name}-execution"
  assume_role_policy   = data.aws_iam_policy_document.assume_role.json
  permissions_boundary = var.permissions_boundary_arn
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_ecs_task_definition" "this" {
  family                   = local.full_name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = var.task_role_arn

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
}

resource "aws_ecs_service" "this" {
  name            = local.full_name
  cluster         = var.cluster_arn
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = var.subnet_ids
    security_groups = var.security_group_ids
  }

  dynamic "load_balancer" {
    for_each = var.target_group_arns

    content {
      target_group_arn = load_balancer.value
      container_name   = local.full_name
      container_port   = var.container_port
    }
  }
}
