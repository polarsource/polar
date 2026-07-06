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

  environment     = "production"
  allowed_origins = ["https://polar.sh"]
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

resource "aws_iam_policy" "production_polar_sh_backups" {
  provider = aws.us_east_2

  name = "polar-sh-backups"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "VisualEditor0"
        Effect = "Allow"
        Action = [
          "s3:DeleteObject",
          "s3:DeleteObjectVersion",
          "s3:GetObject",
          "s3:GetObjectAttributes",
          "s3:GetObjectVersion",
          "s3:GetObjectVersionAttributes",
          "s3:PutObject",
        ]
        Resource = "${aws_s3_bucket.production_backups.arn}/*"
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
    backups          = aws_iam_policy.production_polar_sh_backups.arn
    lambda_artifacts = aws_iam_policy.production_lambda_artifacts_upload.arn
    e2e_reports      = aws_iam_policy.production_e2e_reports_upload.arn
  }
  permissions_boundary_arn = module.permission_boundary_management.policy_arn
}

module "production_application_access" {
  source = "../modules/application_access"
  providers = {
    aws = aws.us_east_2
  }

  username = "polar-production-files"
  buckets = {
    customer_invoices = { name = "polar-customer-invoices" }
    customer_receipts = { name = "polar-customer-receipts" }
    payout_invoices   = { name = "polar-payout-invoices" }
    files             = { name = "polar-production-files", description = "Policy used by our app for downloadable benefits. Keep permissions to a bare minimum." }
    public_files      = { name = "polar-public-files", description = "Policy used by our app for public uploads -products medias and such-. Keep permissions to a bare minimum." }
    logs              = { name = "polar-production-logs", description = "Policy used by our app to write OpenTelemetry spans to S3 for long-term backup." }
  }
}

module "production_athena_spans" {
  source = "../modules/athena_spans"
  providers = {
    aws = aws.us_east_2
  }

  environment      = "production"
  logs_bucket_name = "polar-production-logs"
}

resource "aws_s3_bucket" "production_backups" {
  provider = aws.us_east_2

  bucket = "polar-sh-backups"
}

resource "aws_s3_bucket_server_side_encryption_configuration" "production_backups" {
  provider = aws.us_east_2

  bucket = aws_s3_bucket.production_backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "production_backups" {
  provider = aws.us_east_2

  bucket = aws_s3_bucket.production_backups.id

  rule {
    id     = "14-days-expiration-rule"
    status = "Enabled"
    filter {}
    expiration {
      days = 14
    }
  }
}

import {
  to = aws_ssoadmin_permission_set.production_s3_full_access
  id = "arn:aws:sso:::permissionSet/ssoins-7223aa5e609c2376/ps-722379888f161379,arn:aws:sso:::instance/ssoins-7223aa5e609c2376"
}

import {
  to = aws_ssoadmin_managed_policy_attachment.production_s3_full_access
  id = "arn:aws:iam::aws:policy/AmazonS3FullAccess,arn:aws:sso:::permissionSet/ssoins-7223aa5e609c2376/ps-722379888f161379,arn:aws:sso:::instance/ssoins-7223aa5e609c2376"
}

import {
  to = aws_ssoadmin_permission_set_inline_policy.production_athena_query_access
  id = "arn:aws:sso:::permissionSet/ssoins-7223aa5e609c2376/ps-722379888f161379,arn:aws:sso:::instance/ssoins-7223aa5e609c2376"
}

import {
  to = aws_ssoadmin_permission_set.production_admin
  id = "arn:aws:sso:::permissionSet/ssoins-7223aa5e609c2376/ps-7223f76f71a4e308,arn:aws:sso:::instance/ssoins-7223aa5e609c2376"
}

import {
  to = aws_ssoadmin_managed_policy_attachment.production_admin
  id = "arn:aws:iam::aws:policy/AdministratorAccess,arn:aws:sso:::permissionSet/ssoins-7223aa5e609c2376/ps-7223f76f71a4e308,arn:aws:sso:::instance/ssoins-7223aa5e609c2376"
}

import {
  to = aws_ssoadmin_permission_set.production_cloudfront_admin
  id = "arn:aws:sso:::permissionSet/ssoins-7223aa5e609c2376/ps-722397de1aa87297,arn:aws:sso:::instance/ssoins-7223aa5e609c2376"
}

import {
  to = aws_ssoadmin_permission_set_inline_policy.production_cloudfront_admin
  id = "arn:aws:sso:::permissionSet/ssoins-7223aa5e609c2376/ps-722397de1aa87297,arn:aws:sso:::instance/ssoins-7223aa5e609c2376"
}

import {
  to = aws_ssoadmin_account_assignment.production_user_assignments["francois@polar.sh-cloudfront_admin"]
  id = "24e864a8-d051-70ae-422d-514cea9f9d30,USER,975049931254,AWS_ACCOUNT,arn:aws:sso:::permissionSet/ssoins-7223aa5e609c2376/ps-722397de1aa87297,arn:aws:sso:::instance/ssoins-7223aa5e609c2376"
}

import {
  to = aws_ssoadmin_account_assignment.production_user_assignments["francois@polar.sh-s3_full_access"]
  id = "24e864a8-d051-70ae-422d-514cea9f9d30,USER,975049931254,AWS_ACCOUNT,arn:aws:sso:::permissionSet/ssoins-7223aa5e609c2376/ps-722379888f161379,arn:aws:sso:::instance/ssoins-7223aa5e609c2376"
}

import {
  to = aws_ssoadmin_account_assignment.production_user_assignments["jesper@polar.sh-admin"]
  id = "e4884488-4001-705f-6ec8-410b54204d38,USER,975049931254,AWS_ACCOUNT,arn:aws:sso:::permissionSet/ssoins-7223aa5e609c2376/ps-7223f76f71a4e308,arn:aws:sso:::instance/ssoins-7223aa5e609c2376"
}

import {
  to = aws_ssoadmin_account_assignment.production_user_assignments["jesper@polar.sh-cloudfront_admin"]
  id = "e4884488-4001-705f-6ec8-410b54204d38,USER,975049931254,AWS_ACCOUNT,arn:aws:sso:::permissionSet/ssoins-7223aa5e609c2376/ps-722397de1aa87297,arn:aws:sso:::instance/ssoins-7223aa5e609c2376"
}

import {
  to = aws_ssoadmin_account_assignment.production_user_assignments["jesper@polar.sh-s3_full_access"]
  id = "e4884488-4001-705f-6ec8-410b54204d38,USER,975049931254,AWS_ACCOUNT,arn:aws:sso:::permissionSet/ssoins-7223aa5e609c2376/ps-722379888f161379,arn:aws:sso:::instance/ssoins-7223aa5e609c2376"
}

import {
  to = aws_ssoadmin_account_assignment.production_user_assignments["petru@polar.sh-cloudfront_admin"]
  id = "c4a8f4b8-90e1-7074-ebb5-90de4710ac65,USER,975049931254,AWS_ACCOUNT,arn:aws:sso:::permissionSet/ssoins-7223aa5e609c2376/ps-722397de1aa87297,arn:aws:sso:::instance/ssoins-7223aa5e609c2376"
}

import {
  to = aws_ssoadmin_account_assignment.production_user_assignments["petru@polar.sh-s3_full_access"]
  id = "c4a8f4b8-90e1-7074-ebb5-90de4710ac65,USER,975049931254,AWS_ACCOUNT,arn:aws:sso:::permissionSet/ssoins-7223aa5e609c2376/ps-722379888f161379,arn:aws:sso:::instance/ssoins-7223aa5e609c2376"
}

import {
  to = aws_ssoadmin_account_assignment.production_user_assignments["pieter@polar.sh-cloudfront_admin"]
  id = "c4f80468-c071-7014-beac-96234b38771b,USER,975049931254,AWS_ACCOUNT,arn:aws:sso:::permissionSet/ssoins-7223aa5e609c2376/ps-722397de1aa87297,arn:aws:sso:::instance/ssoins-7223aa5e609c2376"
}

import {
  to = aws_ssoadmin_account_assignment.production_user_assignments["pieter@polar.sh-s3_full_access"]
  id = "c4f80468-c071-7014-beac-96234b38771b,USER,975049931254,AWS_ACCOUNT,arn:aws:sso:::permissionSet/ssoins-7223aa5e609c2376/ps-722379888f161379,arn:aws:sso:::instance/ssoins-7223aa5e609c2376"
}

import {
  to = aws_ssoadmin_account_assignment.production_user_assignments["sebastian@polar.sh-cloudfront_admin"]
  id = "f4180428-5091-7004-2e1f-51693a6a0e4b,USER,975049931254,AWS_ACCOUNT,arn:aws:sso:::permissionSet/ssoins-7223aa5e609c2376/ps-722397de1aa87297,arn:aws:sso:::instance/ssoins-7223aa5e609c2376"
}

import {
  to = aws_ssoadmin_account_assignment.production_user_assignments["sebastian@polar.sh-s3_full_access"]
  id = "f4180428-5091-7004-2e1f-51693a6a0e4b,USER,975049931254,AWS_ACCOUNT,arn:aws:sso:::permissionSet/ssoins-7223aa5e609c2376/ps-722379888f161379,arn:aws:sso:::instance/ssoins-7223aa5e609c2376"
}

import {
  to = module.production_s3_buckets.aws_s3_bucket.customer_invoices
  id = "polar-customer-invoices"
}

import {
  to = module.production_s3_buckets.aws_s3_bucket.customer_receipts
  id = "polar-customer-receipts"
}

import {
  to = module.production_s3_buckets.aws_s3_bucket.files
  id = "polar-production-files"
}

import {
  to = module.production_s3_buckets.aws_s3_bucket.logs
  id = "polar-production-logs"
}

import {
  to = module.production_s3_buckets.aws_s3_bucket.payout_invoices
  id = "polar-payout-invoices"
}

import {
  to = module.production_s3_buckets.aws_s3_bucket.public_assets
  id = "polar-public-assets"
}

import {
  to = module.production_s3_buckets.aws_s3_bucket.public_files
  id = "polar-public-files"
}

import {
  to = module.production_s3_buckets.aws_s3_bucket_cors_configuration.files
  id = "polar-production-files"
}

import {
  to = module.production_s3_buckets.aws_s3_bucket_cors_configuration.public_files
  id = "polar-public-files"
}

import {
  to = module.production_s3_buckets.aws_s3_bucket_policy.public_assets
  id = "polar-public-assets"
}

import {
  to = module.production_s3_buckets.aws_s3_bucket_policy.public_files
  id = "polar-public-files"
}

import {
  to = module.production_s3_buckets.aws_s3_bucket_public_access_block.public_assets
  id = "polar-public-assets"
}

import {
  to = module.production_s3_buckets.aws_s3_bucket_public_access_block.public_files
  id = "polar-public-files"
}

import {
  to = aws_s3_bucket.production_lambda_artifacts
  id = "polar-lambda-artifacts"
}

import {
  to = aws_s3_bucket_versioning.production_lambda_artifacts
  id = "polar-lambda-artifacts"
}

import {
  to = module.production_image_resizer.aws_iam_role.this
  id = "polar-image-resizer"
}

import {
  to = module.production_image_resizer.aws_iam_role_policy.this
  id = "polar-image-resizer:polar-image-resizer"
}

import {
  to = module.production_image_resizer.aws_lambda_function.this
  id = "polar-image-resizer"
}

import {
  to = module.production_cloudfront_public_assets.aws_acm_certificate.this
  id = "arn:aws:acm:us-east-1:975049931254:certificate/69ea5c6f-e9a1-4ca9-b2cd-197630177eb3"
}

import {
  to = module.production_cloudfront_public_assets.aws_cloudfront_cache_policy.this
  id = "87d15640-112a-48c0-a48a-72d8e16ae3a4"
}

import {
  to = module.production_cloudfront_public_assets.aws_cloudfront_distribution.this
  id = "EOHRE2VUWCNHK"
}

import {
  to = module.production_cloudfront_public_assets.aws_cloudfront_response_headers_policy.cors[0]
  id = "c0f37b59-820f-4db9-aad4-c1187686c54b"
}

import {
  to = module.production_cloudfront_public_assets.cloudflare_dns_record.acm_validation["uploads.polar.sh"]
  id = "22bcd1b07ec25452aab472486bc8df94/712c07bcb48686b39deddef3364b5d3d"
}

import {
  to = module.production_cloudfront_public_assets.cloudflare_dns_record.this
  id = "22bcd1b07ec25452aab472486bc8df94/8e431316ac9b345a0a01f42baebf04ee"
}

import {
  to = module.production_cloudfront_cdn.aws_acm_certificate.this
  id = "arn:aws:acm:us-east-1:975049931254:certificate/5141687f-2734-4fbe-b2f6-f40f0bb09493"
}

import {
  to = module.production_cloudfront_cdn.aws_cloudfront_cache_policy.this
  id = "41b717a7-29af-426a-8e8d-a49f5fb69102"
}

import {
  to = module.production_cloudfront_cdn.aws_cloudfront_distribution.this
  id = "E2P76VCRZOEZBZ"
}

import {
  to = module.production_cloudfront_cdn.aws_cloudfront_response_headers_policy.cors[0]
  id = "4491acbc-2264-451a-9a64-e4e7b0effbe9"
}

import {
  to = module.production_cloudfront_cdn.cloudflare_dns_record.acm_validation["cdn.polar.sh"]
  id = "22bcd1b07ec25452aab472486bc8df94/e789463e7465415466330fd924a9c4c5"
}

import {
  to = module.production_cloudfront_cdn.cloudflare_dns_record.this
  id = "22bcd1b07ec25452aab472486bc8df94/2cc31d592a1c2a1c4a2c8afdbc207c89"
}

import {
  to = aws_iam_policy.production_lambda_artifacts_upload
  id = "arn:aws:iam::975049931254:policy/lambda-artifacts-upload"
}

import {
  to = aws_iam_policy.production_e2e_reports_upload
  id = "arn:aws:iam::975049931254:policy/e2e-reports-upload"
}

import {
  to = aws_iam_policy.production_polar_sh_backups
  id = "arn:aws:iam::975049931254:policy/polar-sh-backups"
}

import {
  to = module.production_github_oidc_backup.aws_iam_openid_connect_provider.github
  id = "arn:aws:iam::975049931254:oidc-provider/token.actions.githubusercontent.com"
}

import {
  to = module.production_github_oidc_backup.aws_iam_role.github_actions
  id = "github-actions-backup"
}

import {
  to = module.production_github_oidc_backup.aws_iam_role_policy_attachment.policies["backups"]
  id = "github-actions-backup/arn:aws:iam::975049931254:policy/polar-sh-backups"
}

import {
  to = module.production_github_oidc_backup.aws_iam_role_policy_attachment.policies["lambda_artifacts"]
  id = "github-actions-backup/arn:aws:iam::975049931254:policy/lambda-artifacts-upload"
}

import {
  to = module.production_github_oidc_backup.aws_iam_role_policy_attachment.policies["e2e_reports"]
  id = "github-actions-backup/arn:aws:iam::975049931254:policy/e2e-reports-upload"
}

import {
  to = module.production_application_access.aws_iam_user.this
  id = "polar-production-files"
}

import {
  to = module.production_application_access.aws_iam_policy.customer_invoices
  id = "arn:aws:iam::975049931254:policy/polar-customer-invoices"
}

import {
  to = module.production_application_access.aws_iam_policy.customer_receipts
  id = "arn:aws:iam::975049931254:policy/polar-customer-receipts"
}

import {
  to = module.production_application_access.aws_iam_policy.files
  id = "arn:aws:iam::975049931254:policy/polar-production-files"
}

import {
  to = module.production_application_access.aws_iam_policy.logs
  id = "arn:aws:iam::975049931254:policy/polar-production-logs"
}

import {
  to = module.production_application_access.aws_iam_policy.payout_invoices
  id = "arn:aws:iam::975049931254:policy/polar-payout-invoices"
}

import {
  to = module.production_application_access.aws_iam_policy.public_files
  id = "arn:aws:iam::975049931254:policy/polar-public-files"
}

import {
  to = module.production_application_access.aws_iam_user_policy_attachment.customer_invoices
  id = "polar-production-files/arn:aws:iam::975049931254:policy/polar-customer-invoices"
}

import {
  to = module.production_application_access.aws_iam_user_policy_attachment.customer_receipts
  id = "polar-production-files/arn:aws:iam::975049931254:policy/polar-customer-receipts"
}

import {
  to = module.production_application_access.aws_iam_user_policy_attachment.files
  id = "polar-production-files/arn:aws:iam::975049931254:policy/polar-production-files"
}

import {
  to = module.production_application_access.aws_iam_user_policy_attachment.logs
  id = "polar-production-files/arn:aws:iam::975049931254:policy/polar-production-logs"
}

import {
  to = module.production_application_access.aws_iam_user_policy_attachment.payout_invoices
  id = "polar-production-files/arn:aws:iam::975049931254:policy/polar-payout-invoices"
}

import {
  to = module.production_application_access.aws_iam_user_policy_attachment.public_files
  id = "polar-production-files/arn:aws:iam::975049931254:policy/polar-public-files"
}

import {
  to = module.production_athena_spans.aws_s3_bucket.athena_results
  id = "polar-production-athena-results"
}

import {
  to = module.production_athena_spans.aws_s3_bucket_lifecycle_configuration.athena_results
  id = "polar-production-athena-results"
}

import {
  to = module.production_athena_spans.aws_glue_catalog_database.spans
  id = "975049931254:polar-production-spans"
}

import {
  to = module.production_athena_spans.aws_glue_catalog_table.spans
  id = "975049931254:polar-production-spans:spans"
}

import {
  to = module.production_athena_spans.aws_athena_workgroup.spans
  id = "polar-production-spans"
}

import {
  to = aws_s3_bucket.production_backups
  id = "polar-sh-backups"
}

import {
  to = aws_s3_bucket_lifecycle_configuration.production_backups
  id = "polar-sh-backups"
}
