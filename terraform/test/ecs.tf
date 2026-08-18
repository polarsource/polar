module "ecs_cluster" {
  source = "../modules/ecs_cluster"

  environment = "test"
}

# =============================================================================
# PgBouncer for the Lambda worker
# =============================================================================

resource "aws_service_discovery_private_dns_namespace" "internal" {
  count = local.test_enabled ? 1 : 0
  name  = "polar-test.internal"
  vpc   = module.vpc[0].vpc_id
}

resource "aws_secretsmanager_secret" "ghcr_pull" {
  count = local.test_enabled ? 1 : 0
  name  = "polar-test-ghcr-pull"
}

resource "aws_secretsmanager_secret_version" "ghcr_pull" {
  count         = local.test_enabled ? 1 : 0
  secret_id     = aws_secretsmanager_secret.ghcr_pull[0].id
  secret_string = jsonencode({ username = var.ghcr_username, password = var.ghcr_auth_token })
}

module "pgbouncer_aws" {
  count  = local.test_enabled ? 1 : 0
  source = "../modules/services/pgbouncer"

  environment = "test"
  vpc_id      = module.vpc[0].vpc_id
  subnet_ids  = module.vpc[0].secondary_private_subnet_ids
  cluster_arn = module.ecs_cluster.cluster_arn

  namespace = {
    id   = aws_service_discovery_private_dns_namespace.internal[0].id
    name = aws_service_discovery_private_dns_namespace.internal[0].name
  }

  client_security_group_ids  = [aws_security_group.lambda[0].id]
  permissions_boundary_arn   = data.aws_iam_policy.permission_boundary.arn
  repository_credentials_arn = aws_secretsmanager_secret_version.ghcr_pull[0].arn

  database = {
    host     = local.db_external_host
    port     = local.db_port
    user     = local.db_user
    password = local.db_password
  }
}
