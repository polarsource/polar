# Resolved at plan time; a node replacement changes the IP until re-apply.
data "dns_a_record_set" "redis" {
  host = var.redis_host
}

resource "aws_security_group" "nlb" {
  name        = "${var.name}-nlb"
  description = "Security group for the ${var.name} private link NLB."
  vpc_id      = var.vpc_id
  tags        = var.tags
}

resource "aws_vpc_security_group_ingress_rule" "clients" {
  security_group_id = aws_security_group.nlb.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = var.redis_port
  to_port           = var.redis_port
  ip_protocol       = "tcp"
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

resource "aws_lb_target_group_attachment" "redis" {
  for_each = toset(data.dns_a_record_set.redis.addrs)

  target_group_arn = aws_lb_target_group.redis.arn
  target_id        = each.value
  port             = var.redis_port
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
