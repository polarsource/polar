locals {
  full_name = "polar-${var.environment}-${var.name}"
}

resource "aws_security_group" "this" {
  name   = "${local.full_name}-alb"
  vpc_id = var.vpc_id
}

resource "aws_vpc_security_group_ingress_rule" "https" {
  security_group_id = aws_security_group.this.id
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.this.id
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_lb" "this" {
  name               = local.full_name
  load_balancer_type = "application"
  internal           = false
  security_groups    = [aws_security_group.this.id]
  subnets            = var.subnet_ids
}

resource "aws_lb_target_group" "this" {
  name        = local.full_name
  vpc_id      = var.vpc_id
  target_type = "ip"
  protocol    = "HTTP"
  port        = var.target_port

  health_check {
    path = var.health_check_path
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this.arn
  }
}
