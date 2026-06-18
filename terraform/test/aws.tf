# =============================================================================
# Application Access (IAM user policies)
# =============================================================================

module "application_access_test" {
  count    = local.test_enabled ? 1 : 0
  source   = "../modules/application_access"
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

module "lambda_worker_ecr" {
  count  = local.test_enabled ? 1 : 0
  source = "../modules/ecr_repository"

  name = "polar-test-lambda-worker"
}
