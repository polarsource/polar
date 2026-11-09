terraform {
  required_version = ">= 1.2"

  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = ">= 6.69.1, < 7.0.0"
      configuration_aliases = [aws.us_east_1]
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = ">= 5.0"
    }
  }
}

# =============================================================================
# ACM Certificate
# =============================================================================

resource "aws_acm_certificate" "this" {
  provider          = aws.us_east_1
  domain_name       = var.domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "cloudflare_dns_record" "acm_validation" {
  for_each = {
    for dvo in aws_acm_certificate.this.domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }

  zone_id = var.cloudflare_zone_id
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
  provider        = aws.us_east_1
  certificate_arn = aws_acm_certificate.this.arn
}

# =============================================================================
# CloudFront Distribution
# =============================================================================

resource "aws_cloudfront_cache_policy" "this" {
  name        = var.name
  min_ttl     = 0
  default_ttl = 86400
  max_ttl     = 31536000

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }

    headers_config {
      header_behavior = "none"
    }

    query_strings_config {
      query_string_behavior = "all"
    }
  }
}

locals {
  response_headers_policy = length(var.cors_allowed_origins) > 0 || var.content_security_policy != null
}

resource "aws_cloudfront_response_headers_policy" "cors" {
  count = local.response_headers_policy ? 1 : 0
  name  = "${var.name}-cors"

  dynamic "cors_config" {
    for_each = length(var.cors_allowed_origins) > 0 ? [1] : []
    content {
      access_control_allow_origins {
        items = var.cors_allowed_origins
      }
      access_control_allow_methods {
        items = ["GET", "HEAD", "OPTIONS"]
      }
      access_control_allow_headers {
        items = ["*"]
      }
      access_control_allow_credentials = false
      origin_override                  = true
    }
  }

  dynamic "security_headers_config" {
    for_each = var.content_security_policy != null ? [var.content_security_policy] : []
    content {
      content_security_policy {
        content_security_policy = security_headers_config.value
        override                = true
      }
      content_type_options {
        override = true
      }
    }
  }
}

resource "aws_cloudfront_distribution" "this" {
  enabled         = true
  is_ipv6_enabled = true
  aliases         = [var.domain]
  price_class     = var.price_class

  origin {
    domain_name = var.s3_bucket_regional_domain_name
    origin_id   = var.s3_bucket_id
  }

  default_cache_behavior {
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = var.s3_bucket_id
    cache_policy_id            = aws_cloudfront_cache_policy.this.id
    response_headers_policy_id = local.response_headers_policy ? aws_cloudfront_response_headers_policy.cors[0].id : null
    viewer_protocol_policy     = "redirect-to-https"
    compress                   = true

    dynamic "lambda_function_association" {
      for_each = var.lambda_function_associations
      content {
        event_type   = lambda_function_association.value.event_type
        lambda_arn   = lambda_function_association.value.lambda_arn
        include_body = lambda_function_association.value.include_body
      }
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.this.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
}

# =============================================================================
# DNS
# =============================================================================

resource "cloudflare_dns_record" "this" {
  zone_id = var.cloudflare_zone_id
  name    = var.domain
  type    = "CNAME"
  content = aws_cloudfront_distribution.this.domain_name
  proxied = false
  ttl     = 1
}
