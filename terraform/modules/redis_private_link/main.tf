resource "aws_security_group" "nlb" {
  name        = "${var.name}-nlb"
  description = "Security group for the ${var.name} private link NLB."
  vpc_id      = var.vpc_id
  tags        = var.tags
}

resource "aws_vpc_security_group_egress_rule" "redis" {
  security_group_id = aws_security_group.nlb.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = var.redis_port
  to_port           = var.redis_port
  ip_protocol       = "tcp"
}

resource "aws_lb" "this" {
  name                             = var.name
  internal                         = true
  load_balancer_type               = "network"
  subnets                          = var.subnet_ids
  security_groups                  = [aws_security_group.nlb.id]
  enable_cross_zone_load_balancing = true

  enforce_security_group_inbound_rules_on_private_link_traffic = "off"

  tags = var.tags
}

resource "aws_lb_target_group" "redis" {
  name        = var.name
  port        = var.redis_port
  protocol    = "TCP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    protocol = "TCP"
    port     = "traffic-port"
  }

  tags = var.tags
}

resource "aws_lb_listener" "redis" {
  load_balancer_arn = aws_lb.this.arn
  port              = var.redis_port
  protocol          = "TCP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.redis.arn
  }

  tags = var.tags
}

resource "aws_vpc_endpoint_service" "this" {
  acceptance_required        = true
  network_load_balancer_arns = [aws_lb.this.arn]
  allowed_principals         = var.allowed_principals
  tags                       = merge(var.tags, { Name = var.name })
}

# Exclusively owns target registration; the Redis primary IP moves on failover.
data "archive_file" "refresh" {
  type        = "zip"
  source_file = "${path.module}/refresh.py"
  output_path = "${path.module}/refresh.zip"
}

resource "aws_iam_role" "refresh" {
  name                 = "${var.name}-target-refresh"
  permissions_boundary = var.permissions_boundary_arn

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "refresh" {
  name = "${var.name}-target-refresh"
  role = aws_iam_role.refresh.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["elasticloadbalancing:DescribeTargetHealth"]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "elasticloadbalancing:RegisterTargets",
          "elasticloadbalancing:DeregisterTargets",
        ]
        Resource = aws_lb_target_group.redis.arn
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
    ]
  })
}

resource "aws_lambda_function" "refresh" {
  function_name    = "${var.name}-target-refresh"
  role             = aws_iam_role.refresh.arn
  runtime          = "python3.13"
  handler          = "refresh.handler"
  filename         = data.archive_file.refresh.output_path
  source_code_hash = data.archive_file.refresh.output_base64sha256
  timeout          = 30

  environment {
    variables = {
      TARGET_GROUP_ARN = aws_lb_target_group.redis.arn
      REDIS_HOST       = var.redis_host
      REDIS_PORT       = tostring(var.redis_port)
    }
  }

  tags = var.tags
}

resource "aws_cloudwatch_event_rule" "refresh" {
  name                = "${var.name}-target-refresh"
  schedule_expression = "rate(1 minute)"
  tags                = var.tags
}

resource "aws_cloudwatch_event_target" "refresh" {
  rule = aws_cloudwatch_event_rule.refresh.name
  arn  = aws_lambda_function.refresh.arn
}

resource "aws_lambda_permission" "refresh" {
  statement_id  = "AllowEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.refresh.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.refresh.arn
}
