module "ecs_cluster" {
  source = "../modules/ecs_cluster"

  environment = "production"
}

# =============================================================================
# PgBouncer for the Lambda worker
# =============================================================================

resource "aws_service_discovery_private_dns_namespace" "internal" {
  name = "polar-production.internal"
  vpc  = module.vpc.vpc_id
}

resource "aws_secretsmanager_secret" "ghcr_pull" {
  name = "polar-production-ghcr-pull"
}

resource "aws_secretsmanager_secret_version" "ghcr_pull" {
  secret_id     = aws_secretsmanager_secret.ghcr_pull.id
  secret_string = jsonencode({ username = var.ghcr_username, password = var.ghcr_auth_token })
}

module "pgbouncer_aws" {
  source = "../modules/services/pgbouncer"

  environment = "production"
  vpc_id      = module.vpc.vpc_id
  subnet_ids  = module.vpc.private_subnet_ids
  cluster_arn = module.ecs_cluster.cluster_arn

  namespace = {
    id   = aws_service_discovery_private_dns_namespace.internal.id
    name = aws_service_discovery_private_dns_namespace.internal.name
  }

  client_security_group_ids  = [aws_security_group.lambda.id]
  permissions_boundary_arn   = data.aws_iam_policy.permission_boundary.arn
  repository_credentials_arn = aws_secretsmanager_secret.ghcr_pull.arn

  logfire = {
    token = var.logfire_token
  }

  database = {
    host     = local.db_external_host
    port     = local.db_port
    user     = local.db_user
    password = local.db_password
  }

  depends_on = [aws_secretsmanager_secret_version.ghcr_pull]
}
