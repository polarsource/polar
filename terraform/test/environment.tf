locals {
  backend_config = {
    linear_team_id                            = var.linear_team_id
    linear_payout_amount_mismatch_template_id = var.linear_payout_amount_mismatch_template_id

    environment                          = "test"
    base_url                             = "https://test-api.polar.sh"
    backoffice_host                      = local.private_backoffice_hostname
    user_session_cookie_domain           = "polar.sh"
    user_session_cookie_key              = "polar_test_session"
    authentication_session_cookie_domain = "polar.sh"
    oauth2_session_state_cookie_domain   = "polar.sh"
    email_sender                         = "resend"
    email_from_name                      = "[TEST] Polar"
    email_from_domain                    = "notifications.test.polar.sh"
    frontend_base_url                    = "https://test.polar.sh"
    checkout_base_url                    = "https://test-api.polar.sh/v1/checkout-links/{client_secret}/redirect"
    log_level                            = "INFO"
    testing                              = "0"
    tax_processors                       = "[\"numeral\",\"stripe\"]"
    tax_record_processor                 = "numeral"
    customer_portal_url_overrides        = var.customer_portal_url_overrides
    plain_default_tier_external_id       = var.plain_default_tier_external_id
  }

  backend_secrets = {
    linear_api_key                 = var.linear_api_key
    stripe_publishable_key         = var.stripe_publishable_key
    discord_bot_token              = var.backend_discord_bot_token
    discord_client_id              = var.backend_discord_client_id
    discord_client_secret          = var.backend_discord_client_secret
    discord_proxy_url              = var.backend_discord_proxy_url
    resend_api_key                 = var.backend_resend_api_key
    resend_active_users_segment_id = var.resend_active_users_segment_id
    resend_webhook_secret          = var.backend_resend_webhook_secret
    firecrawl_api_key              = var.firecrawl_api_key
    logo_dev_publishable_key       = var.backend_logo_dev_publishable_key
    sentry_dsn                     = var.backend_sentry_dsn
    numeral_api_key                = var.numeral_api_key
    turnstile_secret               = var.turnstile_secret
  }

  google_secrets = {
    client_id            = var.google_client_id
    client_secret        = var.google_client_secret
    service_account_json = var.google_service_account_json
  }

  pydantic_ai_gateway_secrets = { api_key = var.pydantic_ai_gateway_api_key }

  aws_s3_config = {
    region                        = "us-east-2"
    signature_version             = "v4"
    files_presign_ttl             = "600"
    files_public_bucket_name      = local.files_public_bucket_name
    customer_invoices_bucket_name = "polar-test-customer-invoices"
    customer_receipts_bucket_name = "polar-test-customer-receipts"
    payout_invoices_bucket_name   = "polar-test-payout-invoices"
    logs_bucket_name              = "polar-test-logs"
  }

  aws_s3_secrets = {
    access_key_id         = var.aws_access_key_id
    secret_access_key     = var.aws_secret_access_key
    files_download_salt   = var.s3_files_download_salt
    files_download_secret = var.s3_files_download_secret
  }

  github_secrets = {
    client_id                           = var.github_client_id
    client_secret                       = var.github_client_secret
    repository_benefits_app_identifier  = var.github_repository_benefits_app_identifier
    repository_benefits_app_namespace   = var.github_repository_benefits_app_namespace
    repository_benefits_app_private_key = var.github_repository_benefits_app_private_key
    repository_benefits_client_id       = var.github_repository_benefits_client_id
    repository_benefits_client_secret   = var.github_repository_benefits_client_secret
  }

  stripe_secrets = {
    connect_webhook_secret      = var.stripe_connect_webhook_secret
    secret_key                  = var.stripe_secret_key
    webhook_secret              = var.stripe_webhook_secret
    account_risk_webhook_secret = var.stripe_account_risk_webhook_secret
  }

  logfire_config = { token = var.logfire_token }

  apple_secrets = {
    client_id = var.apple_client_id
    team_id   = var.apple_team_id
    key_id    = var.apple_key_id
    key_value = var.apple_key_value
  }

  prometheus_config = {
    url      = var.grafana_cloud_prometheus_url
    username = var.grafana_cloud_prometheus_username
    password = var.grafana_cloud_prometheus_password
  }

  polar_self_config = {
    access_token     = var.polar_access_token
    webhook_secret   = var.polar_webhook_secret
    organization_id  = var.polar_organization_id
    free_product_id  = var.polar_free_product_id
    scale_product_id = var.polar_scale_product_id
    api_url          = "http://127.0.0.1:10000"
  }

  tinybird_config = {
    api_url             = "https://api.us-east.aws.tinybird.co"
    clickhouse_url      = "https://clickhouse.us-east.aws.tinybird.co"
    api_token           = var.tinybird_api_token
    read_token          = var.tinybird_read_token
    clickhouse_username = var.tinybird_clickhouse_username
    clickhouse_token    = var.tinybird_clickhouse_token
    workspace           = var.tinybird_workspace
  }
}

module "backend_environment" {
  count  = local.test_enabled ? 1 : 0
  source = "../modules/backend_environment"

  environment                 = "test"
  backend_config              = local.backend_config
  backend_secrets             = local.backend_secrets
  google_secrets              = local.google_secrets
  pydantic_ai_gateway_secrets = local.pydantic_ai_gateway_secrets
  aws_s3_config               = local.aws_s3_config
  aws_s3_secrets              = local.aws_s3_secrets
  aws_kms_config = {
    key_id                 = one(module.secrets_kms[*].key_arn)
    jwks_key_id            = one(module.jwks_signing_key[*].current_key_arn)
    jwks_published_key_ids = one(module.jwks_signing_key[*].published_key_arns)
    role_arn               = one(module.secrets_kms[*].role_arn)
  }
  hash_secret_arn = one(module.hash_secret[*].secret_arn)
  worker_sqs_config = {
    enabled      = "true"
    actors       = var.worker_sqs_actors
    queue_prefix = local.worker_sqs_queue_prefix
  }
  github_secrets    = local.github_secrets
  stripe_secrets    = local.stripe_secrets
  logfire_config    = local.logfire_config
  apple_secrets     = local.apple_secrets
  prometheus_config = local.prometheus_config
  polar_self_config = local.polar_self_config
  tinybird_config   = local.tinybird_config
}
