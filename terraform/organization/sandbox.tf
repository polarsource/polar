module "sandbox_s3_buckets" {
  source = "../modules/s3_buckets"
  providers = {
    aws = aws.us_east_2
  }

  environment              = "sandbox"
  allowed_origins          = ["https://sandbox.polar.sh"]
  public_files_bucket_name = "polar-public-sandbox-files"
}

module "sandbox_application_access" {
  source = "../modules/application_access"
  providers = {
    aws = aws.us_east_2
  }

  username = "polar-sandbox-files"
  buckets = {
    customer_invoices = { name = "polar-sandbox-customer-invoices" }
    customer_receipts = { name = "polar-sandbox-customer-receipts" }
    payout_invoices   = { name = "polar-sandbox-payout-invoices" }
    files             = { name = "polar-sandbox-files", description = "Policy used by our SANDBOX app for downloadable benefits. Keep permissions to a bare minimum." }
    public_files      = { name = "polar-public-sandbox-files", description = "Policy used by our SANDBOX app for public uploads -products medias and such-. Keep permissions to a bare minimum." }
    logs              = { name = "polar-sandbox-logs", description = "Policy used by our SANDBOX app to write OpenTelemetry spans to S3 for long-term backup." }
  }
}

data "aws_s3_object" "sandbox_image_resizer_package" {
  bucket = aws_s3_bucket.production_lambda_artifacts.id
  key    = "image-resizer/package.zip"
}

module "sandbox_image_resizer" {
  source = "../modules/lambda_edge_resizer"
  providers = {
    aws = aws
  }

  function_name     = "polar-sandbox-image-resizer"
  s3_bucket         = aws_s3_bucket.production_lambda_artifacts.id
  s3_key            = data.aws_s3_object.sandbox_image_resizer_package.key
  s3_object_version = data.aws_s3_object.sandbox_image_resizer_package.version_id
  source_bucket_arn = module.sandbox_s3_buckets.public_files_bucket_arn
}

module "sandbox_cloudfront_assets" {
  source = "../modules/cloudfront_distribution"
  providers = {
    aws           = aws.us_east_2
    aws.us_east_1 = aws
  }

  name                           = "polar-sandbox-public-files"
  domain                         = "sandbox-uploads.polar.sh"
  cloudflare_zone_id             = "22bcd1b07ec25452aab472486bc8df94"
  s3_bucket_id                   = module.sandbox_s3_buckets.public_files_bucket_id
  s3_bucket_regional_domain_name = module.sandbox_s3_buckets.public_files_bucket_regional_domain_name
  s3_bucket_arn                  = module.sandbox_s3_buckets.public_files_bucket_arn
  cors_allowed_origins           = ["https://sandbox.polar.sh"]

  lambda_function_associations = [
    {
      event_type = "origin-request"
      lambda_arn = module.sandbox_image_resizer.qualified_arn
    },
  ]
}

module "sandbox_cloudfront_cdn" {
  source = "../modules/cloudfront_distribution"
  providers = {
    aws           = aws.us_east_2
    aws.us_east_1 = aws
  }

  name                           = "polar-sandbox-cdn"
  domain                         = "sandbox-cdn.polar.sh"
  cloudflare_zone_id             = "22bcd1b07ec25452aab472486bc8df94"
  s3_bucket_id                   = module.sandbox_s3_buckets.public_assets_bucket_id
  s3_bucket_regional_domain_name = module.sandbox_s3_buckets.public_assets_bucket_regional_domain_name
  s3_bucket_arn                  = module.sandbox_s3_buckets.public_assets_bucket_arn
  cors_allowed_origins           = ["https://sandbox.polar.sh"]
}

import {
  to = module.sandbox_s3_buckets.aws_s3_bucket.customer_invoices
  id = "polar-sandbox-customer-invoices"
}

import {
  to = module.sandbox_s3_buckets.aws_s3_bucket.customer_receipts
  id = "polar-sandbox-customer-receipts"
}

import {
  to = module.sandbox_s3_buckets.aws_s3_bucket.files
  id = "polar-sandbox-files"
}

import {
  to = module.sandbox_s3_buckets.aws_s3_bucket.logs
  id = "polar-sandbox-logs"
}

import {
  to = module.sandbox_s3_buckets.aws_s3_bucket.payout_invoices
  id = "polar-sandbox-payout-invoices"
}

import {
  to = module.sandbox_s3_buckets.aws_s3_bucket.public_assets
  id = "polar-sandbox-public-assets"
}

import {
  to = module.sandbox_s3_buckets.aws_s3_bucket.public_files
  id = "polar-public-sandbox-files"
}

import {
  to = module.sandbox_s3_buckets.aws_s3_bucket_cors_configuration.files
  id = "polar-sandbox-files"
}

import {
  to = module.sandbox_s3_buckets.aws_s3_bucket_cors_configuration.public_files
  id = "polar-public-sandbox-files"
}

import {
  to = module.sandbox_s3_buckets.aws_s3_bucket_policy.public_assets
  id = "polar-sandbox-public-assets"
}

import {
  to = module.sandbox_s3_buckets.aws_s3_bucket_policy.public_files
  id = "polar-public-sandbox-files"
}

import {
  to = module.sandbox_s3_buckets.aws_s3_bucket_public_access_block.public_assets
  id = "polar-sandbox-public-assets"
}

import {
  to = module.sandbox_s3_buckets.aws_s3_bucket_public_access_block.public_files
  id = "polar-public-sandbox-files"
}

import {
  to = module.sandbox_application_access.aws_iam_user.this
  id = "polar-sandbox-files"
}

import {
  to = module.sandbox_application_access.aws_iam_policy.customer_invoices
  id = "arn:aws:iam::975049931254:policy/polar-sandbox-customer-invoices"
}

import {
  to = module.sandbox_application_access.aws_iam_policy.customer_receipts
  id = "arn:aws:iam::975049931254:policy/polar-sandbox-customer-receipts"
}

import {
  to = module.sandbox_application_access.aws_iam_policy.files
  id = "arn:aws:iam::975049931254:policy/polar-sandbox-files"
}

import {
  to = module.sandbox_application_access.aws_iam_policy.logs
  id = "arn:aws:iam::975049931254:policy/polar-sandbox-logs"
}

import {
  to = module.sandbox_application_access.aws_iam_policy.payout_invoices
  id = "arn:aws:iam::975049931254:policy/polar-sandbox-payout-invoices"
}

import {
  to = module.sandbox_application_access.aws_iam_policy.public_files
  id = "arn:aws:iam::975049931254:policy/polar-public-sandbox-files"
}

import {
  to = module.sandbox_application_access.aws_iam_user_policy_attachment.customer_invoices
  id = "polar-sandbox-files/arn:aws:iam::975049931254:policy/polar-sandbox-customer-invoices"
}

import {
  to = module.sandbox_application_access.aws_iam_user_policy_attachment.customer_receipts
  id = "polar-sandbox-files/arn:aws:iam::975049931254:policy/polar-sandbox-customer-receipts"
}

import {
  to = module.sandbox_application_access.aws_iam_user_policy_attachment.files
  id = "polar-sandbox-files/arn:aws:iam::975049931254:policy/polar-sandbox-files"
}

import {
  to = module.sandbox_application_access.aws_iam_user_policy_attachment.logs
  id = "polar-sandbox-files/arn:aws:iam::975049931254:policy/polar-sandbox-logs"
}

import {
  to = module.sandbox_application_access.aws_iam_user_policy_attachment.payout_invoices
  id = "polar-sandbox-files/arn:aws:iam::975049931254:policy/polar-sandbox-payout-invoices"
}

import {
  to = module.sandbox_application_access.aws_iam_user_policy_attachment.public_files
  id = "polar-sandbox-files/arn:aws:iam::975049931254:policy/polar-public-sandbox-files"
}

import {
  to = module.sandbox_image_resizer.aws_iam_role.this
  id = "polar-sandbox-image-resizer"
}

import {
  to = module.sandbox_image_resizer.aws_iam_role_policy.this
  id = "polar-sandbox-image-resizer:polar-sandbox-image-resizer"
}

import {
  to = module.sandbox_image_resizer.aws_lambda_function.this
  id = "polar-sandbox-image-resizer"
}

import {
  to = module.sandbox_cloudfront_assets.aws_acm_certificate.this
  id = "arn:aws:acm:us-east-1:975049931254:certificate/4d878276-bae9-4557-a7af-6c4e79ed65d2"
}

import {
  to = module.sandbox_cloudfront_assets.aws_cloudfront_cache_policy.this
  id = "16cfa261-18aa-4ee5-9b9e-013b3f53dbb8"
}

import {
  to = module.sandbox_cloudfront_assets.aws_cloudfront_distribution.this
  id = "E11MGVVO0TOWL1"
}

import {
  to = module.sandbox_cloudfront_assets.aws_cloudfront_response_headers_policy.cors[0]
  id = "e3892bd9-e502-4715-b2fe-cc24e6aced88"
}

import {
  to = module.sandbox_cloudfront_assets.cloudflare_dns_record.acm_validation["sandbox-uploads.polar.sh"]
  id = "22bcd1b07ec25452aab472486bc8df94/690b6691c3e83de6b2895023cf6ddd89"
}

import {
  to = module.sandbox_cloudfront_assets.cloudflare_dns_record.this
  id = "22bcd1b07ec25452aab472486bc8df94/c2e020d5f3e842b604e2278d6cf0c8b5"
}

import {
  to = module.sandbox_cloudfront_cdn.aws_acm_certificate.this
  id = "arn:aws:acm:us-east-1:975049931254:certificate/44eb0638-d211-4584-a2a3-3f37330840df"
}

import {
  to = module.sandbox_cloudfront_cdn.aws_cloudfront_cache_policy.this
  id = "f4ecee16-10be-4c6e-b4bf-e62fb7c130bd"
}

import {
  to = module.sandbox_cloudfront_cdn.aws_cloudfront_distribution.this
  id = "E3JT4XH8AF7RMC"
}

import {
  to = module.sandbox_cloudfront_cdn.aws_cloudfront_response_headers_policy.cors[0]
  id = "b80c0eb2-2210-434d-8594-4af155a67bc5"
}

import {
  to = module.sandbox_cloudfront_cdn.cloudflare_dns_record.acm_validation["sandbox-cdn.polar.sh"]
  id = "22bcd1b07ec25452aab472486bc8df94/2a303163145a78e9bd8d17b63f94e674"
}

import {
  to = module.sandbox_cloudfront_cdn.cloudflare_dns_record.this
  id = "22bcd1b07ec25452aab472486bc8df94/57078f07aa57b27994eb65390cd4231c"
}
