module "ecs_cluster" {
  source = "../modules/ecs_cluster"

  environment = "sandbox"
}

resource "aws_security_group" "ecs_tasks" {
  name   = "polar-sandbox-ecs-tasks"
  vpc_id = module.vpc.vpc_id
}

resource "aws_vpc_security_group_egress_rule" "ecs_tasks" {
  security_group_id = aws_security_group.ecs_tasks.id
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

locals {
  ecs_environment_variables = {
    POLAR_GRAFANA_CLOUD_PROMETHEUS_WRITE_URL      = "${var.grafana_cloud_prometheus_url}/api/prom/push"
    POLAR_GRAFANA_CLOUD_PROMETHEUS_WRITE_USERNAME = var.grafana_cloud_prometheus_username
    POLAR_GRAFANA_CLOUD_PROMETHEUS_WRITE_PASSWORD = var.grafana_cloud_prometheus_password
  }
}

module "ecs_api" {
  source = "../modules/api_service"

  environment              = "sandbox"
  cluster_arn              = module.ecs_cluster.cluster_arn
  cpu                      = 2048
  memory                   = 4096
  desired_count            = 0
  environment_variables    = local.ecs_environment_variables
  subnet_ids               = module.vpc.private_subnet_ids
  security_group_ids       = [aws_security_group.ecs_tasks.id]
  permissions_boundary_arn = data.aws_iam_policy.permission_boundary.arn
}

module "ecs_workers" {
  source = "../modules/worker_service"

  for_each = {
    worker = {
      command = [
        "uv", "run", "dramatiq", "polar.worker.run",
        "-p", "4", "-t", "8",
        "-f", "polar.worker.scheduler:start",
        "--queues", "high_priority", "medium_priority", "low_priority",
      ]
      cpu    = 2048
      memory = 4096
    }
    worker-webhook = {
      command = [
        "uv", "run", "dramatiq", "polar.worker.run",
        "-p", "1", "-t", "16",
        "--queues", "webhooks",
      ]
      cpu    = 2048
      memory = 4096
    }
    worker-tinybird = {
      command = [
        "uv", "run", "dramatiq", "polar.worker.run_without_db",
        "-p", "1", "-t", "16",
        "--queues", "tinybird",
      ]
      cpu    = 2048
      memory = 4096
    }
    worker-invoices-receipts = {
      command = [
        "uv", "run", "dramatiq", "polar.worker.run",
        "-p", "1", "-t", "3",
        "--queues", "invoices_and_receipts",
      ]
      cpu    = 1024
      memory = 2048
    }
  }

  environment              = "sandbox"
  name                     = each.key
  cluster_arn              = module.ecs_cluster.cluster_arn
  command                  = each.value.command
  cpu                      = each.value.cpu
  memory                   = each.value.memory
  desired_count            = 0
  environment_variables    = local.ecs_environment_variables
  subnet_ids               = module.vpc.private_subnet_ids
  security_group_ids       = [aws_security_group.ecs_tasks.id]
  permissions_boundary_arn = data.aws_iam_policy.permission_boundary.arn
}
