resource "aws_acm_certificate" "this" {
  count = var.alb == null ? 0 : 1

  domain_name       = var.alb.domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "cloudflare_dns_record" "acm_validation" {
  for_each = var.alb == null ? {} : {
    for dvo in aws_acm_certificate.this[0].domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }

  zone_id = var.alb.cloudflare_zone_id
  name    = each.value.name
  type    = each.value.type
  content = each.value.value
  ttl     = 1

  lifecycle {
    ignore_changes       = [name, content]
    replace_triggered_by = [aws_acm_certificate.this]
  }
}

resource "aws_acm_certificate_validation" "this" {
  count = var.alb == null ? 0 : 1

  certificate_arn = aws_acm_certificate.this[0].arn

  depends_on = [cloudflare_dns_record.acm_validation]
}

module "alb" {
  count  = var.alb == null ? 0 : 1
  source = "../alb"

  environment     = var.environment
  name            = "api"
  vpc_id          = var.alb.vpc_id
  subnet_ids      = var.alb.subnet_ids
  certificate_arn = aws_acm_certificate_validation.this[0].certificate_arn
  target_port     = 10000
}

resource "cloudflare_dns_record" "api" {
  count = var.alb == null ? 0 : 1

  zone_id = var.alb.cloudflare_zone_id
  name    = var.alb.domain
  type    = "CNAME"
  content = module.alb[0].dns_name
  proxied = true
  ttl     = 1
}

module "service" {
  source = "../ecs_service"

  environment              = var.environment
  name                     = "api"
  cluster_arn              = var.cluster_arn
  image                    = var.image
  container_port           = 10000
  cpu                      = var.cpu
  memory                   = var.memory
  desired_count            = var.desired_count
  environment_variables    = var.environment_variables
  target_group_arns        = concat(var.target_group_arns, module.alb[*].target_group_arn)
  subnet_ids               = var.subnet_ids
  security_group_ids       = var.security_group_ids
  permissions_boundary_arn = var.permissions_boundary_arn
}
