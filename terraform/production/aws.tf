# =============================================================================
# IAM Identity Center (SSO) Configuration
# =============================================================================

# Variable for user-to-permission-set assignments
# Configure this in Terraform Cloud as a list of objects:
# [
#   { email = "admin@polar.sh", permission_set = "admin" },
#   { email = "dev@polar.sh", permission_set = "s3_full_access" }
# ]
variable "aws_sso_user_assignments" {
  description = "List of user assignments with email and permission set name"
  type = list(object({
    email          = string
    permission_set = string # One of: admin, s3_full_access
  }))
  default = []
}

# Get the IAM Identity Center instance
data "aws_ssoadmin_instances" "main" {
  provider = aws.sso
}

locals {
  identity_store_id = tolist(data.aws_ssoadmin_instances.main.identity_store_ids)[0]
  sso_instance_arn  = tolist(data.aws_ssoadmin_instances.main.arns)[0]

  # Map permission set names to their ARNs
  permission_set_arns = {
    admin          = aws_ssoadmin_permission_set.admin.arn
    s3_full_access = aws_ssoadmin_permission_set.s3_full_access.arn
  }

  # Create a map keyed by email for the user assignments
  user_assignments_map = {
    for assignment in var.aws_sso_user_assignments :
    "${assignment.email}-${assignment.permission_set}" => assignment
  }
}

# -----------------------------------------------------------------------------
# Permission Sets
# -----------------------------------------------------------------------------

# S3 Full Access Permission Set
resource "aws_ssoadmin_permission_set" "s3_full_access" {
  provider         = aws.sso
  name             = "S3FullAccess"
  description      = "Full access to S3 buckets"
  instance_arn     = local.sso_instance_arn
  session_duration = "PT8H"
}

resource "aws_ssoadmin_managed_policy_attachment" "s3_full_access" {
  provider           = aws.sso
  instance_arn       = local.sso_instance_arn
  managed_policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
  permission_set_arn = aws_ssoadmin_permission_set.s3_full_access.arn
}

# Administrator Access Permission Set (for admin users)
resource "aws_ssoadmin_permission_set" "admin" {
  provider         = aws.sso
  name             = "AdministratorAccess"
  description      = "Full administrator access"
  instance_arn     = local.sso_instance_arn
  session_duration = "PT8H"
}

resource "aws_ssoadmin_managed_policy_attachment" "admin" {
  provider           = aws.sso
  instance_arn       = local.sso_instance_arn
  managed_policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
  permission_set_arn = aws_ssoadmin_permission_set.admin.arn
}

# -----------------------------------------------------------------------------
# Account Assignments (Dynamic)
# -----------------------------------------------------------------------------

# Look up users from Identity Store based on the variable
data "aws_identitystore_user" "users" {
  provider          = aws.sso
  for_each          = local.user_assignments_map
  identity_store_id = local.identity_store_id

  alternate_identifier {
    unique_attribute {
      attribute_path  = "UserName"
      attribute_value = each.value.email
    }
  }
}

# Create account assignments for each user-permission_set pair
resource "aws_ssoadmin_account_assignment" "user_assignments" {
  provider           = aws.sso
  for_each           = local.user_assignments_map
  instance_arn       = local.sso_instance_arn
  permission_set_arn = local.permission_set_arns[each.value.permission_set]
  principal_id       = data.aws_identitystore_user.users[each.key].user_id
  principal_type     = "USER"
  target_id          = data.aws_caller_identity.current.account_id
  target_type        = "AWS_ACCOUNT"
}

data "aws_caller_identity" "current" {}

# =============================================================================
# S3 Buckets
# =============================================================================

module "s3_buckets" {
  source          = "../modules/s3_buckets"
  environment     = "production"
  allowed_origins = ["https://polar.sh"]
}

# =============================================================================
# Lambda Artifacts S3 Bucket
# =============================================================================

resource "aws_s3_bucket" "lambda_artifacts" {
  provider = aws.us_east_1
  bucket   = "polar-lambda-artifacts"
}

resource "aws_s3_bucket_versioning" "lambda_artifacts" {
  provider = aws.us_east_1
  bucket   = aws_s3_bucket.lambda_artifacts.id
  versioning_configuration {
    status = "Enabled"
  }
}

# =============================================================================
# Image Resizer Lambda@Edge
# =============================================================================

data "aws_s3_object" "image_resizer_package" {
  provider = aws.us_east_1
  bucket   = aws_s3_bucket.lambda_artifacts.id
  key      = "image-resizer/package.zip"
}

module "image_resizer" {
  source = "../modules/lambda_edge_resizer"
  providers = {
    aws = aws.us_east_1
  }

  function_name     = "polar-image-resizer"
  s3_bucket         = aws_s3_bucket.lambda_artifacts.id
  s3_key            = data.aws_s3_object.image_resizer_package.key
  s3_object_version = data.aws_s3_object.image_resizer_package.version_id
  source_bucket_arn = module.s3_buckets.public_files_bucket_arn
}


# =============================================================================
# CloudFront Distribution (Public Assets)
# =============================================================================

module "cloudfront_public_assets" {
  source = "../modules/cloudfront_distribution"
  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  name                           = "polar-public-files"
  domain                         = "uploads.polar.sh"
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

# =============================================================================
# GitHub Actions OIDC
# =============================================================================

import {
  to = module.github_oidc_backup.aws_iam_openid_connect_provider.github
  id = "arn:aws:iam::975049931254:oidc-provider/token.actions.githubusercontent.com"
}

import {
  to = module.github_oidc_backup.aws_iam_role.github_actions
  id = "github-actions-backup"
}

import {
  to = aws_iam_policy.polar_sh_backups
  id = "arn:aws:iam::975049931254:policy/polar-sh-backups"
}

import {
  to = module.github_oidc_backup.aws_iam_role_policy_attachment.policies["backups"]
  id = "github-actions-backup/arn:aws:iam::975049931254:policy/polar-sh-backups"
}

module "github_oidc_backup" {
  source = "../modules/github_oidc"

  role_name   = "github-actions-backup"
  github_org  = "polarsource"
  github_repo = "polar"
  policy_arns = {
    backups          = aws_iam_policy.polar_sh_backups.arn
    lambda_artifacts = aws_iam_policy.lambda_artifacts_upload.arn
  }
}

resource "aws_iam_policy" "polar_sh_backups" {
  name = "polar-sh-backups"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "VisualEditor0"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObjectAttributes",
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:GetObjectVersionAttributes",
          "s3:DeleteObject",
          "s3:DeleteObjectVersion"
        ]
        Resource = "${aws_s3_bucket.backups.arn}/*"
      }
    ]
  })
}

# =============================================================================
# Application Access (IAM user policies)
# =============================================================================

import {
  to = module.application_access_production.aws_iam_policy.customer_invoices
  id = "arn:aws:iam::975049931254:policy/polar-customer-invoices"
}

import {
  to = module.application_access_production.aws_iam_policy.payout_invoices
  id = "arn:aws:iam::975049931254:policy/polar-payout-invoices"
}

import {
  to = module.application_access_production.aws_iam_policy.files
  id = "arn:aws:iam::975049931254:policy/polar-production-files"
}

import {
  to = module.application_access_production.aws_iam_policy.public_files
  id = "arn:aws:iam::975049931254:policy/polar-public-files"
}

import {
  to = module.application_access_production.aws_iam_user_policy_attachment.customer_invoices
  id = "polar-production-files/arn:aws:iam::975049931254:policy/polar-customer-invoices"
}

import {
  to = module.application_access_production.aws_iam_user_policy_attachment.payout_invoices
  id = "polar-production-files/arn:aws:iam::975049931254:policy/polar-payout-invoices"
}

import {
  to = module.application_access_production.aws_iam_user_policy_attachment.files
  id = "polar-production-files/arn:aws:iam::975049931254:policy/polar-production-files"
}

import {
  to = module.application_access_production.aws_iam_user_policy_attachment.public_files
  id = "polar-production-files/arn:aws:iam::975049931254:policy/polar-public-files"
}

module "application_access_production" {
  source   = "../modules/application_access"
  username = "polar-production-files"
  buckets = {
    customer_invoices = { name = "polar-customer-invoices" }
    payout_invoices   = { name = "polar-payout-invoices" }
    files             = { name = "polar-production-files", description = "Policy used by our app for downloadable benefits. Keep permissions to a bare minimum." }
    public_files      = { name = "polar-public-files", description = "Policy used by our app for public uploads -products medias and such-. Keep permissions to a bare minimum." }
    logs              = { name = "polar-production-logs", description = "Policy used by our app to write OpenTelemetry spans to S3 for long-term backup." }
  }
}

resource "aws_iam_policy" "lambda_artifacts_upload" {
  name = "lambda-artifacts-upload"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:PutObject"
        ]
        Resource = "${aws_s3_bucket.lambda_artifacts.arn}/*"
      }
    ]
  })
}

# =============================================================================
# Backups S3 Bucket
# =============================================================================

resource "aws_s3_bucket" "backups" {
  bucket = "polar-sh-backups"
}

resource "aws_s3_bucket_lifecycle_configuration" "backups_lifecycle" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "14-days-expiration-rule"
    status = "Enabled"
    filter {}
    expiration {
      days = 14
    }
  }
}
