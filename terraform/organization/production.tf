locals {
  production_legacy_sso_user_assignments = {
    "francois@polar.sh-cloudfront_admin" = { email = "francois@polar.sh", permission_set = "cloudfront_admin" }
    "francois@polar.sh-s3_full_access"   = { email = "francois@polar.sh", permission_set = "s3_full_access" }
    "jesper@polar.sh-admin"              = { email = "jesper@polar.sh", permission_set = "admin" }
    "jesper@polar.sh-cloudfront_admin"   = { email = "jesper@polar.sh", permission_set = "cloudfront_admin" }
    "jesper@polar.sh-s3_full_access"     = { email = "jesper@polar.sh", permission_set = "s3_full_access" }
    "petru@polar.sh-cloudfront_admin"    = { email = "petru@polar.sh", permission_set = "cloudfront_admin" }
    "petru@polar.sh-s3_full_access"      = { email = "petru@polar.sh", permission_set = "s3_full_access" }
    "pieter@polar.sh-cloudfront_admin"   = { email = "pieter@polar.sh", permission_set = "cloudfront_admin" }
    "pieter@polar.sh-s3_full_access"     = { email = "pieter@polar.sh", permission_set = "s3_full_access" }
    "sebastian@polar.sh-cloudfront_admin" = {
      email          = "sebastian@polar.sh"
      permission_set = "cloudfront_admin"
    }
    "sebastian@polar.sh-s3_full_access" = { email = "sebastian@polar.sh", permission_set = "s3_full_access" }
  }

  production_legacy_sso_permission_set_arns = {
    admin            = aws_ssoadmin_permission_set.production_admin.arn
    s3_full_access   = aws_ssoadmin_permission_set.production_s3_full_access.arn
    cloudfront_admin = aws_ssoadmin_permission_set.production_cloudfront_admin.arn
  }

  production_legacy_sso_identity_store_id = tolist(data.aws_ssoadmin_instances.production_legacy.identity_store_ids)[0]
  production_legacy_sso_instance_arn      = tolist(data.aws_ssoadmin_instances.production_legacy.arns)[0]
}

data "aws_ssoadmin_instances" "production_legacy" {}

resource "aws_ssoadmin_permission_set" "production_s3_full_access" {
  name             = "S3FullAccess"
  description      = "Full access to S3 buckets"
  instance_arn     = local.production_legacy_sso_instance_arn
  session_duration = "PT8H"
}

resource "aws_ssoadmin_managed_policy_attachment" "production_s3_full_access" {
  instance_arn       = local.production_legacy_sso_instance_arn
  managed_policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
  permission_set_arn = aws_ssoadmin_permission_set.production_s3_full_access.arn
}

data "aws_iam_policy_document" "production_athena_query_access" {
  statement {
    sid = "AthenaQueryAccess"
    actions = [
      "athena:BatchGetQueryExecution",
      "athena:GetDataCatalog",
      "athena:GetQueryExecution",
      "athena:GetQueryResults",
      "athena:GetTableMetadata",
      "athena:GetWorkGroup",
      "athena:ListDataCatalogs",
      "athena:ListDatabases",
      "athena:ListQueryExecutions",
      "athena:ListTableMetadata",
      "athena:ListWorkGroups",
      "athena:StartQueryExecution",
      "athena:StopQueryExecution",
    ]
    resources = ["*"]
  }

  statement {
    sid = "GlueReadAccess"
    actions = [
      "glue:BatchGetPartition",
      "glue:GetDatabase",
      "glue:GetDatabases",
      "glue:GetPartition",
      "glue:GetPartitions",
      "glue:GetTable",
      "glue:GetTables",
    ]
    resources = ["*"]
  }
}

resource "aws_ssoadmin_permission_set_inline_policy" "production_athena_query_access" {
  instance_arn       = local.production_legacy_sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.production_s3_full_access.arn
  inline_policy      = data.aws_iam_policy_document.production_athena_query_access.json
}

resource "aws_ssoadmin_permission_set" "production_admin" {
  name             = "AdministratorAccess"
  description      = "Full administrator access"
  instance_arn     = local.production_legacy_sso_instance_arn
  session_duration = "PT8H"
}

resource "aws_ssoadmin_managed_policy_attachment" "production_admin" {
  instance_arn       = local.production_legacy_sso_instance_arn
  managed_policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
  permission_set_arn = aws_ssoadmin_permission_set.production_admin.arn
}

resource "aws_ssoadmin_permission_set" "production_cloudfront_admin" {
  name             = "CloudFrontAdmin"
  description      = "Manage CloudFront distributions, Lambda@Edge functions, and Lambda artifact S3 bucket"
  instance_arn     = local.production_legacy_sso_instance_arn
  session_duration = "PT8H"
}

data "aws_iam_policy_document" "production_cloudfront_admin_sso" {
  statement {
    actions = [
      "cloudfront:CreateInvalidation",
      "cloudfront:GetDistribution",
      "cloudfront:ListDistributions",
      "cloudfront:UpdateDistribution",
    ]
    resources = ["*"]
  }

  statement {
    actions = [
      "lambda:GetFunction",
      "lambda:PublishVersion",
      "lambda:UpdateFunctionCode",
    ]
    resources = [module.production_image_resizer.function_arn]
  }

  statement {
    actions = [
      "s3:GetObject",
      "s3:ListBucket",
      "s3:PutObject",
    ]
    resources = [
      aws_s3_bucket.production_lambda_artifacts.arn,
      "${aws_s3_bucket.production_lambda_artifacts.arn}/*",
    ]
  }
}

resource "aws_ssoadmin_permission_set_inline_policy" "production_cloudfront_admin" {
  instance_arn       = local.production_legacy_sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.production_cloudfront_admin.arn
  inline_policy      = data.aws_iam_policy_document.production_cloudfront_admin_sso.json
}

data "aws_identitystore_user" "production_legacy_users" {
  for_each          = local.production_legacy_sso_user_assignments
  identity_store_id = local.production_legacy_sso_identity_store_id

  alternate_identifier {
    unique_attribute {
      attribute_path  = "UserName"
      attribute_value = each.value.email
    }
  }
}

resource "aws_ssoadmin_account_assignment" "production_user_assignments" {
  for_each           = local.production_legacy_sso_user_assignments
  instance_arn       = local.production_legacy_sso_instance_arn
  permission_set_arn = local.production_legacy_sso_permission_set_arns[each.value.permission_set]
  principal_id       = data.aws_identitystore_user.production_legacy_users[each.key].user_id
  principal_type     = "USER"
  target_id          = local.management_account.id
  target_type        = "AWS_ACCOUNT"
}

module "production_s3_buckets" {
  source = "../modules/s3_buckets"
  providers = {
    aws = aws.us_east_2
  }

  environment                 = "production"
  allowed_origins             = ["https://polar.sh"]
  malware_protection_enabled  = true
  malware_protection_role_arn = module.production_malware_protection.role_arn
  app_access_account_id       = local.workload_accounts.production.id
}

module "production_malware_protection" {
  source = "../modules/malware_protection"
  providers = {
    aws = aws.us_east_2
  }

  environment = "production"
  buckets = {
    files        = module.production_s3_buckets.files_bucket_id
    public_files = module.production_s3_buckets.public_files_bucket_id
  }
  permissions_boundary_arn = module.permission_boundary_management.policy_arn
}

resource "aws_s3_bucket" "production_lambda_artifacts" {
  bucket = "polar-lambda-artifacts"
}

resource "aws_s3_bucket_server_side_encryption_configuration" "production_lambda_artifacts" {
  bucket = aws_s3_bucket.production_lambda_artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "production_lambda_artifacts" {
  bucket = aws_s3_bucket.production_lambda_artifacts.id
  versioning_configuration {
    status = "Enabled"
  }
}

data "aws_s3_object" "production_image_resizer_package" {
  bucket = aws_s3_bucket.production_lambda_artifacts.id
  key    = "image-resizer/package.zip"
}

module "production_image_resizer" {
  source = "../modules/lambda_edge_resizer"
  providers = {
    aws = aws
  }

  function_name            = "polar-image-resizer"
  s3_bucket                = aws_s3_bucket.production_lambda_artifacts.id
  s3_key                   = data.aws_s3_object.production_image_resizer_package.key
  s3_object_version        = data.aws_s3_object.production_image_resizer_package.version_id
  source_bucket_arn        = module.production_s3_buckets.public_files_bucket_arn
  permissions_boundary_arn = module.permission_boundary_management.policy_arn
}

module "production_cloudfront_public_assets" {
  source = "../modules/cloudfront_distribution"
  providers = {
    aws           = aws.us_east_2
    aws.us_east_1 = aws
  }

  name                           = "polar-public-files"
  domain                         = "uploads.polar.sh"
  cloudflare_zone_id             = "22bcd1b07ec25452aab472486bc8df94"
  s3_bucket_id                   = module.production_s3_buckets.public_files_bucket_id
  s3_bucket_regional_domain_name = module.production_s3_buckets.public_files_bucket_regional_domain_name
  s3_bucket_arn                  = module.production_s3_buckets.public_files_bucket_arn
  cors_allowed_origins           = ["https://polar.sh", "https://trace.playwright.dev"]

  lambda_function_associations = [
    {
      event_type = "origin-request"
      lambda_arn = module.production_image_resizer.qualified_arn
    },
  ]
}

module "production_cloudfront_cdn" {
  source = "../modules/cloudfront_distribution"
  providers = {
    aws           = aws.us_east_2
    aws.us_east_1 = aws
  }

  name                           = "polar-cdn"
  domain                         = "cdn.polar.sh"
  cloudflare_zone_id             = "22bcd1b07ec25452aab472486bc8df94"
  s3_bucket_id                   = module.production_s3_buckets.public_assets_bucket_id
  s3_bucket_regional_domain_name = module.production_s3_buckets.public_assets_bucket_regional_domain_name
  s3_bucket_arn                  = module.production_s3_buckets.public_assets_bucket_arn
  cors_allowed_origins           = ["https://polar.sh"]
}

resource "aws_iam_policy" "production_lambda_artifacts_upload" {
  provider = aws.us_east_2

  name = "lambda-artifacts-upload"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:PutObject",
        ]
        Resource = "${aws_s3_bucket.production_lambda_artifacts.arn}/*"
      },
    ]
  })
}

resource "aws_iam_policy" "production_e2e_reports_upload" {
  provider = aws.us_east_2

  name = "e2e-reports-upload"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:PutObject",
        ]
        Resource = [
          "${module.production_s3_buckets.public_files_bucket_arn}/e2e-artifacts",
          "${module.production_s3_buckets.public_files_bucket_arn}/e2e-artifacts/*",
        ]
      },
    ]
  })
}

module "production_github_oidc_backup" {
  source = "../modules/github_oidc"
  providers = {
    aws = aws.us_east_2
  }

  role_name   = "github-actions-backup"
  github_org  = "polarsource"
  github_repo = "polar"
  github_subjects = [
    "ref:refs/heads/main",
    "pull_request",
  ]
  policy_arns = {
    lambda_artifacts = aws_iam_policy.production_lambda_artifacts_upload.arn
    e2e_reports      = aws_iam_policy.production_e2e_reports_upload.arn
  }
  permissions_boundary_arn = module.permission_boundary_management.policy_arn
}

module "production_athena_spans" {
  source = "../modules/athena_spans"
  providers = {
    aws = aws.us_east_2
  }

  environment      = "production"
  logs_bucket_name = "polar-production-logs"
}
