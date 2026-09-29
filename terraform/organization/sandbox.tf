module "sandbox_s3_buckets" {
  source = "../modules/s3_buckets"
  providers = {
    aws = aws.us_east_2
  }

  environment                 = "sandbox"
  allowed_origins             = ["https://sandbox.polar.sh"]
  public_files_bucket_name    = "polar-public-sandbox-files"
  malware_protection_enabled  = true
  malware_protection_role_arn = module.sandbox_malware_protection.role_arn
  app_access_account_id       = local.workload_accounts.sandbox.id
}

module "sandbox_malware_protection" {
  source = "../modules/malware_protection"
  providers = {
    aws = aws.us_east_2
  }

  environment = "sandbox"
  buckets = {
    files        = module.sandbox_s3_buckets.files_bucket_id
    public_files = module.sandbox_s3_buckets.public_files_bucket_id
  }
  permissions_boundary_arn = module.permission_boundary_management.policy_arn
}

module "sandbox_athena_spans" {
  source = "../modules/athena_spans"
  providers = {
    aws = aws.us_east_2
  }

  environment      = "sandbox"
  logs_bucket_name = "polar-sandbox-logs"
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

  function_name            = "polar-sandbox-image-resizer"
  s3_bucket                = aws_s3_bucket.production_lambda_artifacts.id
  s3_key                   = data.aws_s3_object.sandbox_image_resizer_package.key
  s3_object_version        = data.aws_s3_object.sandbox_image_resizer_package.version_id
  source_bucket_arn        = module.sandbox_s3_buckets.public_files_bucket_arn
  permissions_boundary_arn = module.permission_boundary_management.policy_arn
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
