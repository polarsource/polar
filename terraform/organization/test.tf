module "test_s3_buckets" {
  source = "../modules/s3_buckets"
  providers = {
    aws = aws.us_east_2
  }

  environment                 = "test"
  allowed_origins             = ["https://test.polar.sh"]
  malware_protection_enabled  = true
  malware_protection_role_arn = module.test_malware_protection.role_arn
  app_access_account_id       = local.workload_accounts.test.id
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
