# =============================================================================
# Application Access (IAM user policies)
# =============================================================================

import {
  to = module.application_access_sandbox.aws_iam_policy.customer_invoices
  id = "arn:aws:iam::975049931254:policy/polar-sandbox-customer-invoices"
}

import {
  to = module.application_access_sandbox.aws_iam_policy.payout_invoices
  id = "arn:aws:iam::975049931254:policy/polar-sandbox-payout-invoices"
}

import {
  to = module.application_access_sandbox.aws_iam_policy.files
  id = "arn:aws:iam::975049931254:policy/polar-sandbox-files"
}

import {
  to = module.application_access_sandbox.aws_iam_policy.public_files
  id = "arn:aws:iam::975049931254:policy/polar-public-sandbox-files"
}

import {
  to = module.application_access_sandbox.aws_iam_user_policy_attachment.customer_invoices
  id = "polar-sandbox-files/arn:aws:iam::975049931254:policy/polar-sandbox-customer-invoices"
}

import {
  to = module.application_access_sandbox.aws_iam_user_policy_attachment.payout_invoices
  id = "polar-sandbox-files/arn:aws:iam::975049931254:policy/polar-sandbox-payout-invoices"
}

import {
  to = module.application_access_sandbox.aws_iam_user_policy_attachment.files
  id = "polar-sandbox-files/arn:aws:iam::975049931254:policy/polar-sandbox-files"
}

import {
  to = module.application_access_sandbox.aws_iam_user_policy_attachment.public_files
  id = "polar-sandbox-files/arn:aws:iam::975049931254:policy/polar-public-sandbox-files"
}

module "application_access_sandbox" {
  source   = "../modules/application_access"
  username = "polar-sandbox-files"
  buckets = {
    customer_invoices = "polar-sandbox-customer-invoices"
    payout_invoices   = "polar-sandbox-payout-invoices"
    files             = "polar-sandbox-files"
    public_files      = "polar-public-sandbox-files"
  }
}

# =============================================================================
# CloudFront Distribution (Sandbox Public Assets)
# =============================================================================

module "cloudfront_sandbox_assets" {
  source = "../modules/cloudfront_distribution"
  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  name                           = "polar-sandbox-public-assets"
  domain                         = "sandbox-assets.polar.sh"
  cloudflare_zone_id             = "22bcd1b07ec25452aab472486bc8df94"
  s3_bucket_id                   = module.s3_buckets.public_assets_bucket_id
  s3_bucket_regional_domain_name = module.s3_buckets.public_assets_bucket_regional_domain_name
  s3_bucket_arn                  = module.s3_buckets.public_assets_bucket_arn
}
