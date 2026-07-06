module "test_s3_buckets" {
  source = "../modules/s3_buckets"
  providers = {
    aws = aws.us_east_2
  }

  environment                 = "test"
  allowed_origins             = ["https://test.polar.sh"]
  malware_protection_enabled  = true
  malware_protection_role_arn = module.test_malware_protection.role_arn
}

module "test_malware_protection" {
  source = "../modules/malware_protection"
  providers = {
    aws = aws.us_east_2
  }

  environment = "test"
  buckets = {
    files        = module.test_s3_buckets.files_bucket_id
    public_files = module.test_s3_buckets.public_files_bucket_id
  }
  permissions_boundary_arn = module.permission_boundary_management.policy_arn
}

module "test_application_access" {
  source = "../modules/application_access"
  providers = {
    aws = aws.us_east_2
  }

  username = "polar-test-files"
  buckets = {
    customer_invoices = { name = "polar-test-customer-invoices" }
    customer_receipts = { name = "polar-test-customer-receipts" }
    payout_invoices   = { name = "polar-test-payout-invoices" }
    files             = { name = "polar-test-files", description = "Policy used by our TEST app for downloadable benefits. Keep permissions to a bare minimum." }
    public_files      = { name = "polar-test-public-files", description = "Policy used by our TEST app for public uploads -products medias and such-. Keep permissions to a bare minimum." }
    logs              = { name = "polar-test-logs", description = "Policy used by our TEST app to write OpenTelemetry spans to S3 for long-term backup." }
  }
}

import {
  to = module.test_s3_buckets.aws_s3_bucket.customer_invoices
  id = "polar-test-customer-invoices"
}

import {
  to = module.test_s3_buckets.aws_s3_bucket.customer_receipts
  id = "polar-test-customer-receipts"
}

import {
  to = module.test_s3_buckets.aws_s3_bucket.files
  id = "polar-test-files"
}

import {
  to = module.test_s3_buckets.aws_s3_bucket.logs
  id = "polar-test-logs"
}

import {
  to = module.test_s3_buckets.aws_s3_bucket.payout_invoices
  id = "polar-test-payout-invoices"
}

import {
  to = module.test_s3_buckets.aws_s3_bucket.public_assets
  id = "polar-test-public-assets"
}

import {
  to = module.test_s3_buckets.aws_s3_bucket.public_files
  id = "polar-test-public-files"
}

import {
  to = module.test_s3_buckets.aws_s3_bucket_cors_configuration.files
  id = "polar-test-files"
}

import {
  to = module.test_s3_buckets.aws_s3_bucket_cors_configuration.public_files
  id = "polar-test-public-files"
}

import {
  to = module.test_s3_buckets.aws_s3_bucket_policy.public_assets
  id = "polar-test-public-assets"
}

import {
  to = module.test_s3_buckets.aws_s3_bucket_policy.public_files
  id = "polar-test-public-files"
}

import {
  to = module.test_s3_buckets.aws_s3_bucket_public_access_block.public_assets
  id = "polar-test-public-assets"
}

import {
  to = module.test_s3_buckets.aws_s3_bucket_public_access_block.public_files
  id = "polar-test-public-files"
}

import {
  to = module.test_application_access.aws_iam_user.this
  id = "polar-test-files"
}

import {
  to = module.test_application_access.aws_iam_policy.customer_invoices
  id = "arn:aws:iam::975049931254:policy/polar-test-customer-invoices"
}

import {
  to = module.test_application_access.aws_iam_policy.customer_receipts
  id = "arn:aws:iam::975049931254:policy/polar-test-customer-receipts"
}

import {
  to = module.test_application_access.aws_iam_policy.files
  id = "arn:aws:iam::975049931254:policy/polar-test-files"
}

import {
  to = module.test_application_access.aws_iam_policy.logs
  id = "arn:aws:iam::975049931254:policy/polar-test-logs"
}

import {
  to = module.test_application_access.aws_iam_policy.payout_invoices
  id = "arn:aws:iam::975049931254:policy/polar-test-payout-invoices"
}

import {
  to = module.test_application_access.aws_iam_policy.public_files
  id = "arn:aws:iam::975049931254:policy/polar-test-public-files"
}

import {
  to = module.test_application_access.aws_iam_user_policy_attachment.customer_invoices
  id = "polar-test-files/arn:aws:iam::975049931254:policy/polar-test-customer-invoices"
}

import {
  to = module.test_application_access.aws_iam_user_policy_attachment.customer_receipts
  id = "polar-test-files/arn:aws:iam::975049931254:policy/polar-test-customer-receipts"
}

import {
  to = module.test_application_access.aws_iam_user_policy_attachment.files
  id = "polar-test-files/arn:aws:iam::975049931254:policy/polar-test-files"
}

import {
  to = module.test_application_access.aws_iam_user_policy_attachment.logs
  id = "polar-test-files/arn:aws:iam::975049931254:policy/polar-test-logs"
}

import {
  to = module.test_application_access.aws_iam_user_policy_attachment.payout_invoices
  id = "polar-test-files/arn:aws:iam::975049931254:policy/polar-test-payout-invoices"
}

import {
  to = module.test_application_access.aws_iam_user_policy_attachment.public_files
  id = "polar-test-files/arn:aws:iam::975049931254:policy/polar-test-public-files"
}
