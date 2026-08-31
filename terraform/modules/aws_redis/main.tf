resource "aws_elasticache_subnet_group" "this" {
  name       = var.name
  subnet_ids = var.subnet_ids
  tags       = var.tags
}

resource "aws_security_group" "this" {
  name        = "${var.name}-cache"
  description = "Security group for ${var.name} Redis."
  vpc_id      = var.vpc_id
  tags        = var.tags
}

resource "aws_elasticache_parameter_group" "this" {
  name   = var.name
  family = var.parameter_group_family
  tags   = var.tags

  parameter {
    name  = "maxmemory-policy"
    value = "noeviction"
  }
}

resource "aws_cloudwatch_log_group" "slow_log" {
  name              = "/aws/elasticache/${var.name}/slow-log"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id       = var.name
  description                = "${var.name} cache"
  engine                     = "valkey"
  engine_version             = var.engine_version
  parameter_group_name       = aws_elasticache_parameter_group.this.name
  node_type                  = var.node_type
  num_cache_clusters         = var.node_count
  multi_az_enabled           = var.node_count > 1
  automatic_failover_enabled = var.node_count > 1
  port                       = var.port
  snapshot_retention_limit   = var.snapshot_retention_days
  subnet_group_name          = aws_elasticache_subnet_group.this.name
  security_group_ids         = [aws_security_group.this.id]
  tags                       = var.tags

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.slow_log.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "slow-log"
  }
}
