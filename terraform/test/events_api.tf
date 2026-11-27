# =============================================================================
# Event ingestion API (api-events-test) on ECS Fargate behind an ALB
# =============================================================================

locals {
  events_api_name     = "api-events-test"
  events_api_hostname = "test-api-events.polar.sh"
  events_api_port     = 10000

  events_name     = "events-test"
  events_hostname = "test-events.polar.sh"

  events_api_tags = {
    Environment = "test"
    Service     = local.events_api_name
  }

  events_api_environment = local.test_enabled ? {
    for key, value in merge(
      module.backend_environment[0].environment_variables,
      module.backend_environment[0].secret_environment_variables,
      {
        SERVICE_NAME                  = local.events_api_name
        WEB_CONCURRENCY               = "4"
        FORWARDED_ALLOW_IPS           = local.forwarded_allow_ips
        POLAR_BACKOFFICE_ENABLED      = "false"
        POLAR_ALLOWED_HOSTS           = local.api_allowed_hosts
        POLAR_CORS_ORIGINS            = local.api_cors_origins
        POLAR_DATABASE_POOL_SIZE      = "20"
        POLAR_LOGFIRE_ROOT_SPANS_ONLY = "true"

        POLAR_POSTGRES_DATABASE      = module.planetscale.database_name
        POLAR_POSTGRES_HOST          = local.planetscale_postgres_config.host
        POLAR_POSTGRES_PORT          = local.planetscale_postgres_config.port
        POLAR_POSTGRES_USER          = local.planetscale_postgres_config.user
        POLAR_POSTGRES_PWD           = local.planetscale_postgres_config.password
        POLAR_POSTGRES_READ_DATABASE = module.planetscale.database_name
        POLAR_POSTGRES_READ_HOST     = local.planetscale_postgres_config.read_host
        POLAR_POSTGRES_READ_PORT     = local.planetscale_postgres_config.read_port
        POLAR_POSTGRES_READ_USER     = local.planetscale_postgres_config.read_user
        POLAR_POSTGRES_READ_PWD      = local.planetscale_postgres_config.read_password
        POLAR_POSTGRES_SSL           = "false"
        PGSSLMODE                    = local.planetscale_postgres_config.sslmode
        PGSSLROOTCERT                = local.planetscale_postgres_config.sslrootcert

        POLAR_REDIS_URL = "rediss://${module.redis[0].host}:${module.redis[0].port}/1"
      },
    ) : key => value
    # The S3 span exporter stays off to measure its CPU cost under load.
    if value != null && key != "POLAR_S3_LOGS_BUCKET_NAME"
  } : {}
}

resource "aws_secretsmanager_secret" "events_api" {
  count                   = local.test_enabled ? 1 : 0
  name                    = "polar-test-${local.events_api_name}"
  recovery_window_in_days = 7
  tags                    = local.events_api_tags
}

resource "aws_secretsmanager_secret_version" "events_api" {
  count         = local.test_enabled ? 1 : 0
  secret_id     = aws_secretsmanager_secret.events_api[0].id
  secret_string = jsonencode(local.events_api_environment)
}

resource "aws_secretsmanager_secret" "ghcr" {
  count                   = local.test_enabled ? 1 : 0
  name                    = "polar-test-ghcr-credentials"
  recovery_window_in_days = 7
  tags                    = local.events_api_tags
}

resource "aws_secretsmanager_secret_version" "ghcr" {
  count     = local.test_enabled ? 1 : 0
  secret_id = aws_secretsmanager_secret.ghcr[0].id
  secret_string = jsonencode({
    username = var.ghcr_username
    password = var.ghcr_auth_token
  })
}

# Task role

data "aws_iam_policy_document" "events_api_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_iam_role" "events_api_task" {
  count                = local.test_enabled ? 1 : 0
  name                 = "polar-test-${local.events_api_name}-task"
  assume_role_policy   = data.aws_iam_policy_document.events_api_assume.json
  permissions_boundary = data.aws_iam_policy.permission_boundary.arn
  tags                 = local.events_api_tags
}

data "aws_iam_policy_document" "events_api_task" {
  count = local.test_enabled ? 1 : 0

  source_policy_documents = [
    data.aws_iam_policy_document.tasks_producer[0].json,
    module.hash_secret[0].read_policy_json,
  ]
}

resource "aws_iam_role_policy" "events_api_task" {
  count  = local.test_enabled ? 1 : 0
  name   = "polar-test-${local.events_api_name}-task"
  role   = aws_iam_role.events_api_task[0].id
  policy = data.aws_iam_policy_document.events_api_task[0].json
}

# Networking

resource "aws_security_group" "events_api_alb" {
  count       = local.test_enabled ? 1 : 0
  name        = "polar-test-${local.events_api_name}-alb"
  description = "HTTPS from Cloudflare to the event ingestion API load balancer."
  vpc_id      = module.vpc[0].vpc_id
  tags        = local.events_api_tags
}

resource "aws_ec2_managed_prefix_list" "cloudflare_ipv4" {
  count          = local.test_enabled ? 1 : 0
  name           = "cloudflare-ipv4"
  address_family = "IPv4"
  max_entries    = length(module.cloudflare_ips.ipv4_ranges)
  tags           = local.events_api_tags

  dynamic "entry" {
    for_each = module.cloudflare_ips.ipv4_ranges
    content {
      cidr = entry.value
    }
  }
}

resource "aws_vpc_security_group_ingress_rule" "events_api_alb_cloudflare" {
  count             = local.test_enabled ? 1 : 0
  security_group_id = aws_security_group.events_api_alb[0].id
  prefix_list_id    = aws_ec2_managed_prefix_list.cloudflare_ipv4[0].id
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "events_api_alb_tasks" {
  count                        = local.test_enabled ? 1 : 0
  security_group_id            = aws_security_group.events_api_alb[0].id
  referenced_security_group_id = aws_security_group.events_api[0].id
  from_port                    = local.events_api_port
  to_port                      = local.events_api_port
  ip_protocol                  = "tcp"
}

resource "aws_security_group" "events_api" {
  count       = local.test_enabled ? 1 : 0
  name        = "polar-test-${local.events_api_name}"
  description = "Event ingestion API tasks."
  vpc_id      = module.vpc[0].vpc_id
  tags        = local.events_api_tags

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_vpc_security_group_ingress_rule" "events_api_alb" {
  count                        = local.test_enabled ? 1 : 0
  security_group_id            = aws_security_group.events_api[0].id
  referenced_security_group_id = aws_security_group.events_api_alb[0].id
  from_port                    = local.events_api_port
  to_port                      = local.events_api_port
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "redis_events_api" {
  count                        = local.test_enabled ? 1 : 0
  security_group_id            = module.redis[0].security_group_id
  referenced_security_group_id = aws_security_group.events_api[0].id
  from_port                    = module.redis[0].port
  to_port                      = module.redis[0].port
  ip_protocol                  = "tcp"
}

# Load balancer

resource "aws_acm_certificate" "events_api" {
  count                     = local.test_enabled ? 1 : 0
  domain_name               = local.events_api_hostname
  subject_alternative_names = [local.events_hostname]
  validation_method         = "DNS"
  tags                      = local.events_api_tags

  lifecycle {
    create_before_destroy = true
  }
}

resource "cloudflare_dns_record" "events_api_acm_validation" {
  for_each = local.test_enabled ? {
    for option in aws_acm_certificate.events_api[0].domain_validation_options : option.domain_name => option
  } : {}

  zone_id = "22bcd1b07ec25452aab472486bc8df94"
  name    = trimsuffix(each.value.resource_record_name, ".")
  type    = each.value.resource_record_type
  content = trimsuffix(each.value.resource_record_value, ".")
  proxied = false
  ttl     = 60
}

resource "aws_acm_certificate_validation" "events_api" {
  count                   = local.test_enabled ? 1 : 0
  certificate_arn         = aws_acm_certificate.events_api[0].arn
  validation_record_fqdns = [for record in cloudflare_dns_record.events_api_acm_validation : record.name]
}

resource "aws_lb" "events_api" {
  count              = local.test_enabled ? 1 : 0
  name               = "polar-test-${local.events_api_name}"
  load_balancer_type = "application"
  subnets            = module.vpc[0].public_subnet_ids
  security_groups    = [aws_security_group.events_api_alb[0].id]
  tags               = local.events_api_tags
}

resource "aws_lb_target_group" "events_api" {
  count                = local.test_enabled ? 1 : 0
  name                 = "polar-test-${local.events_api_name}"
  port                 = local.events_api_port
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = module.vpc[0].vpc_id
  deregistration_delay = 30
  tags                 = local.events_api_tags

  health_check {
    path              = "/healthz"
    matcher           = "200"
    interval          = 10
    healthy_threshold = 2
  }
}

resource "aws_lb_listener" "events_api_https" {
  count             = local.test_enabled ? 1 : 0
  load_balancer_arn = aws_lb.events_api[0].arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.events_api[0].certificate_arn
  tags              = local.events_api_tags

  # Other Cloudflare zones can also proxy to this ALB; only our hostname is served.
  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "text/plain"
      status_code  = "404"
    }
  }
}

resource "aws_lb_listener_rule" "events_api_host" {
  count        = local.test_enabled ? 1 : 0
  listener_arn = aws_lb_listener.events_api_https[0].arn
  priority     = 1
  tags         = local.events_api_tags

  condition {
    host_header {
      values = [local.events_api_hostname]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.events_api[0].arn
  }
}

resource "aws_lb_target_group" "events" {
  count                = local.test_enabled ? 1 : 0
  name                 = "polar-test-${local.events_name}"
  port                 = local.events_api_port
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = module.vpc[0].vpc_id
  deregistration_delay = 30
  tags                 = local.events_api_tags

  health_check {
    path              = "/healthz"
    matcher           = "200"
    interval          = 10
    healthy_threshold = 2
  }
}

resource "aws_lb_listener_rule" "events_host" {
  count        = local.test_enabled ? 1 : 0
  listener_arn = aws_lb_listener.events_api_https[0].arn
  priority     = 2
  tags         = local.events_api_tags

  condition {
    host_header {
      values = [local.events_hostname]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.events[0].arn
  }
}

# Service

module "events_api" {
  count  = local.test_enabled ? 1 : 0
  source = "../modules/ecs_service"

  environment = "test"
  name        = local.events_api_name
  cluster_arn = module.ecs_cluster[0].cluster_arn
  # Tracks :latest; the deploy-ecs-test job in deploy.yml rolls it after each build.
  image = "ghcr.io/polarsource/polar:latest"
  command = [
    "uv", "run", "uvicorn", "polar.event_ingestion_api_app:app",
    "--host", "0.0.0.0", "--port", tostring(local.events_api_port),
    "--limit-max-requests", "50000", "--limit-max-requests-jitter", "10000",
    "--timeout-graceful-shutdown", "30",
  ]
  cpu            = 4096
  memory         = 8192
  container_port = local.events_api_port

  subnet_ids               = module.vpc[0].secondary_private_subnet_ids
  security_group_ids       = [aws_security_group.events_api[0].id]
  task_role_arn            = aws_iam_role.events_api_task[0].arn
  permissions_boundary_arn = data.aws_iam_policy.permission_boundary.arn
  repository_credentials   = { arn = aws_secretsmanager_secret.ghcr[0].arn }
  lb_target_group          = { arn = aws_lb_target_group.events_api[0].arn }
  desired_count            = 0
  tags                     = local.events_api_tags

  environment_variables = {
    # ECS reads secrets at task start; a new version must roll the task definition.
    SECRET_VERSION_ID = aws_secretsmanager_secret_version.events_api[0].version_id
  }

  secrets = {
    for key in nonsensitive(keys(local.events_api_environment)) :
    key => "${aws_secretsmanager_secret.events_api[0].arn}:${key}::"
  }

  depends_on = [
    aws_secretsmanager_secret_version.events_api,
    aws_secretsmanager_secret_version.ghcr,
    aws_lb_listener_rule.events_api_host,
    aws_iam_role_policy.events_api_task,
  ]
}

# Rust event service

module "events" {
  count  = local.test_enabled ? 1 : 0
  source = "../modules/ecs_service"

  environment    = "test"
  name           = local.events_name
  cluster_arn    = module.ecs_cluster[0].cluster_arn
  image          = "ghcr.io/polarsource/polar-events:latest"
  profile        = "small"
  container_port = local.events_api_port

  subnet_ids               = module.vpc[0].secondary_private_subnet_ids
  security_group_ids       = [aws_security_group.events_api[0].id]
  task_role_arn            = aws_iam_role.events_api_task[0].arn
  permissions_boundary_arn = data.aws_iam_policy.permission_boundary.arn
  repository_credentials   = { arn = aws_secretsmanager_secret.ghcr[0].arn }
  lb_target_group          = { arn = aws_lb_target_group.events[0].arn }
  desired_count            = 0
  tags                     = { Environment = "test", Service = local.events_name }

  environment_variables = {
    # The service reads its telemetry name from Render's variable.
    RENDER_SERVICE_NAME = local.events_name
    SECRET_VERSION_ID   = aws_secretsmanager_secret_version.events_api[0].version_id
  }

  secrets = {
    for key in nonsensitive(keys(local.events_api_environment)) :
    key => "${aws_secretsmanager_secret.events_api[0].arn}:${key}::"
  }

  depends_on = [
    aws_secretsmanager_secret_version.events_api,
    aws_secretsmanager_secret_version.ghcr,
    aws_lb_listener_rule.events_host,
    aws_iam_role_policy.events_api_task,
  ]
}
