locals {
  port = 5432
}

resource "aws_secretsmanager_secret" "database_password" {
  name = "polar-${var.environment}-pgbouncer-db-password"
}

resource "aws_secretsmanager_secret_version" "database_password" {
  secret_id     = aws_secretsmanager_secret.database_password.id
  secret_string = var.database.password
}

resource "aws_service_discovery_service" "this" {
  name = "pgbouncer"

  dns_config {
    namespace_id   = var.namespace.id
    routing_policy = "MULTIVALUE"

    dns_records {
      ttl  = 10
      type = "A"
    }
  }

  health_check_custom_config {}

  lifecycle {
    ignore_changes = [health_check_custom_config]
  }
}

resource "aws_security_group" "this" {
  name        = "polar-${var.environment}-pgbouncer"
  description = "PgBouncer tasks fronting the Render database."
  vpc_id      = var.vpc_id

  ingress {
    from_port       = local.port
    to_port         = local.port
    protocol        = "tcp"
    security_groups = var.client_security_group_ids
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

module "service" {
  source = "../../ecs_service"

  environment              = var.environment
  name                     = "pgbouncer"
  cluster_arn              = var.cluster_arn
  image                    = var.image
  profile                  = "tiny"
  container_port           = local.port
  subnet_ids               = var.subnet_ids
  security_group_ids       = [aws_security_group.this.id]
  permissions_boundary_arn = var.permissions_boundary_arn
  logfire                  = var.logfire

  service_registry = {
    arn = aws_service_discovery_service.this.arn
  }

  repository_credentials = {
    arn = var.repository_credentials_arn
  }

  environment_variables = {
    DB_HOST            = var.database.host
    DB_PORT            = var.database.port
    DB_USER            = var.database.user
    SERVER_TLS_SSLMODE = "verify-full"
  }

  secrets = {
    DB_PASSWORD = aws_secretsmanager_secret.database_password.arn
  }
}
