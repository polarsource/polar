# =============================================================================
# Application Access (IAM user policies)
# =============================================================================

module "application_access_sandbox" {
  source   = "../modules/application_access"
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

# Adopt the IAM user that already exists in AWS (console-created).
import {
  to = module.application_access_sandbox.aws_iam_user.this
  id = "polar-sandbox-files"
}

module "lambda_worker_ecr" {
  source = "../modules/ecr_repository"

  name = "polar-sandbox-lambda-worker"
}

module "dummy_lambda_worker" {
  source = "../modules/aws_task_worker"

  environment = "sandbox"
  name        = "dummy"
  queue_name  = "polar-sandbox-tasks-dummy"
  image_uri   = "${module.lambda_worker_ecr.repository_url}:latest"
  enabled     = false

  environment_variables = {
    POLAR_ENV                     = "sandbox"
    POLAR_BASE_URL                = "https://sandbox-api.polar.sh"
    POLAR_FRONTEND_BASE_URL       = "https://sandbox.polar.sh"
    POLAR_CHECKOUT_BASE_URL       = "https://sandbox-api.polar.sh/v1/checkout-links/{client_secret}/redirect"
    POLAR_JWKS                    = "/tmp/jwks.json"
    POLAR_LOG_LEVEL               = "INFO"
    POLAR_TESTING                 = "0"
    POLAR_POSTGRES_DATABASE       = "polar_sandbox"
    POLAR_POSTGRES_HOST           = local.db_internal_host
    POLAR_POSTGRES_PORT           = local.db_port
    POLAR_POSTGRES_USER           = local.db_user
    POLAR_POSTGRES_READ_DATABASE  = "polar_sandbox"
    POLAR_POSTGRES_READ_HOST      = local.read_replica.id
    POLAR_POSTGRES_READ_PORT      = local.db_port
    POLAR_POSTGRES_READ_USER      = local.db_user
    POLAR_REDIS_HOST              = local.redis_host
    POLAR_REDIS_PORT              = local.redis_port
    POLAR_REDIS_DB                = "1"
    POLAR_AWS_REGION              = "us-east-2"
    POLAR_WORKER_SQS_ENABLED      = "true"
    POLAR_WORKER_SQS_QUEUE_PREFIX = "polar-sandbox-tasks"
  }

  secret_environment_variables = {
    POLAR_CURRENT_JWK_KID   = var.backend_current_jwk_kid_sandbox
    POLAR_JWKS_CONTENT      = var.backend_jwks_sandbox
    POLAR_LOGFIRE_TOKEN     = var.logfire_token
    POLAR_POSTGRES_PWD      = local.db_password
    POLAR_POSTGRES_READ_PWD = local.db_password
    POLAR_SECRET            = var.backend_secret_sandbox
    POLAR_SENTRY_DSN        = var.backend_sentry_dsn_sandbox
    TAILSCALE_AUTHKEY       = var.lambda_worker_tailscale_token
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
  cors_allowed_origins           = ["https://sandbox.polar.sh"]

  lambda_function_associations = [
    {
      event_type = "origin-request"
      lambda_arn = module.image_resizer.qualified_arn
    },
  ]
}

# =============================================================================
# CloudFront Distribution (Sandbox CDN)
# =============================================================================

module "cloudfront_sandbox_cdn" {
  source = "../modules/cloudfront_distribution"
  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  name                           = "polar-sandbox-cdn"
  domain                         = "sandbox-cdn.polar.sh"
  cloudflare_zone_id             = "22bcd1b07ec25452aab472486bc8df94"
  s3_bucket_id                   = module.s3_buckets.public_assets_bucket_id
  s3_bucket_regional_domain_name = module.s3_buckets.public_assets_bucket_regional_domain_name
  s3_bucket_arn                  = module.s3_buckets.public_assets_bucket_arn
  cors_allowed_origins           = ["https://sandbox.polar.sh"]
}
