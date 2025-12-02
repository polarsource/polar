provider "aws" {
  region = "us-east-2"
}

# IAM Identity Center is only available in one region per organization.
# Change this if your Identity Center is in a different region.
provider "aws" {
  alias  = "sso"
  region = "us-east-1"
}

provider "render" {
}

module "s3_buckets" {
  source          = "../modules/s3_buckets"
  environment     = "sandbox"
  allowed_origins = ["https://sandbox.polar.sh"]
}

import {
  to = module.s3_buckets.aws_s3_bucket.customer_invoices
  id = "polar-sandbox-customer-invoices"
}

import {
  to = module.s3_buckets.aws_s3_bucket.files
  id = "polar-sandbox-files"
}

import {
  to = module.s3_buckets.aws_s3_bucket.payout_invoices
  id = "polar-sandbox-payout-invoices"
}

import {
  to = module.s3_buckets.aws_s3_bucket.public_assets
  id = "polar-sandbox-public-assets"
}

import {
  to = module.s3_buckets.aws_s3_bucket.public_files
  id = "polar-sandbox-public-files"
}

import {
  to = module.s3_buckets.aws_s3_bucket_cors_configuration.files
  id = "polar-sandbox-files"
}

import {
  to = module.s3_buckets.aws_s3_bucket_cors_configuration.public_files
  id = "polar-sandbox-public-files"
}

import {
  to = module.s3_buckets.aws_s3_bucket_policy.public_assets
  id = "polar-sandbox-public-assets"
}

import {
  to = module.s3_buckets.aws_s3_bucket_policy.public_files
  id = "polar-sandbox-public-files"
}

import {
  to = module.s3_buckets.aws_s3_bucket_public_access_block.public_assets
  id = "polar-sandbox-public-assets"
}

import {
  to = module.s3_buckets.aws_s3_bucket_public_access_block.public_files
  id = "polar-sandbox-public-files"
}
