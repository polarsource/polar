# =============================================================================
# Application Access (IAM user policies)
# =============================================================================

module "application_access_sandbox" {
  source   = "../modules/application_access"
  username = "polar-sandbox-files"
  buckets = {
    customer_invoices = { name = "polar-sandbox-customer-invoices" }
    payout_invoices   = { name = "polar-sandbox-payout-invoices" }
    files             = { name = "polar-sandbox-files", description = "Policy used by our SANDBOX app for downloadable benefits. Keep permissions to a bare minimum." }
    public_files      = { name = "polar-public-sandbox-files", description = "Policy used by our SANDBOX app for public uploads -products medias and such-. Keep permissions to a bare minimum." }
    logs              = { name = "polar-sandbox-logs", description = "Policy used by our SANDBOX app to write OpenTelemetry spans to S3 for long-term backup." }
  }
}

# =============================================================================
# Image Resizer Lambda@Edge
# =============================================================================

data "aws_s3_bucket" "lambda_artifacts" {
  provider = aws.us_east_1
  bucket   = "polar-lambda-artifacts"
}

data "aws_s3_object" "image_resizer_package" {
  provider = aws.us_east_1
  bucket   = data.aws_s3_bucket.lambda_artifacts.id
  key      = "image-resizer/package.zip"
}

module "image_resizer" {
  source = "../modules/lambda_edge_resizer"
  providers = {
    aws = aws.us_east_1
  }

  function_name     = "polar-sandbox-image-resizer"
  s3_bucket         = data.aws_s3_bucket.lambda_artifacts.id
  s3_key            = data.aws_s3_object.image_resizer_package.key
  s3_object_version = data.aws_s3_object.image_resizer_package.version_id
  source_bucket_arn = module.s3_buckets.public_files_bucket_arn
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

  name                           = "polar-sandbox-public-files"
  domain                         = "sandbox-uploads.polar.sh"
  cloudflare_zone_id             = "22bcd1b07ec25452aab472486bc8df94"
  s3_bucket_id                   = module.s3_buckets.public_files_bucket_id
  s3_bucket_regional_domain_name = module.s3_buckets.public_files_bucket_regional_domain_name
  s3_bucket_arn                  = module.s3_buckets.public_files_bucket_arn

  lambda_function_associations = [
    {
      event_type = "origin-request"
      lambda_arn = module.image_resizer.qualified_arn
    },
  ]
}
