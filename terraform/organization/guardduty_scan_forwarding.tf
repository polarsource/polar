module "production_guardduty_scan_forwarding" {
  source = "../modules/guardduty_scan_forwarding"
  providers = {
    aws = aws.us_east_2
  }

  environment = "production"
  bucket_names = [
    module.production_s3_buckets.files_bucket_id,
    module.production_s3_buckets.public_files_bucket_id,
  ]
  destination_account_id   = local.workload_accounts.production.id
  permissions_boundary_arn = module.permission_boundary_management.policy_arn
}

module "sandbox_guardduty_scan_forwarding" {
  source = "../modules/guardduty_scan_forwarding"
  providers = {
    aws = aws.us_east_2
  }

  environment = "sandbox"
  bucket_names = [
    module.sandbox_s3_buckets.files_bucket_id,
    module.sandbox_s3_buckets.public_files_bucket_id,
  ]
  destination_account_id   = local.workload_accounts.sandbox.id
  permissions_boundary_arn = module.permission_boundary_management.policy_arn
}

module "test_guardduty_scan_forwarding" {
  source = "../modules/guardduty_scan_forwarding"
  providers = {
    aws = aws.us_east_2
  }

  environment = "test"
  bucket_names = [
    module.test_s3_buckets.files_bucket_id,
    module.test_s3_buckets.public_files_bucket_id,
  ]
  destination_account_id   = local.workload_accounts.test.id
  permissions_boundary_arn = module.permission_boundary_management.policy_arn
}
