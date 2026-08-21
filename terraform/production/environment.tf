locals {
  backend_config = {
    base_url                             = "https://api.polar.sh"
    backoffice_host                      = "backoffice.polar.sh"
    checkout_link_host                   = "buy.polar.sh"
    user_session_cookie_domain           = "polar.sh"
    authentication_session_cookie_domain = "polar.sh"
    oauth2_session_state_cookie_domain   = "polar.sh"
    debug                                = "0"
    email_sender                         = "resend"
    email_from_name                      = "Polar"
    email_from_domain                    = "notifications.polar.sh"
    frontend_base_url                    = "https://polar.sh"
    checkout_base_url                    = "https://buy.polar.sh/{client_secret}"
    jwks_path                            = "/etc/secrets/jwks.json"
    log_level                            = "INFO"
    testing                              = "0"
    auth_cookie_domain                   = "polar.sh"
    invoices_additional_info             = "[support@polar.sh](mailto:support@polar.sh)"
    invoices_vat_numbers = jsonencode({
      AT = "EU372061545"
      BE = "EU372061545"
      BG = "EU372061545"
      CY = "EU372061545"
      CZ = "EU372061545"
      DE = "EU372061545"
      DK = "EU372061545"
      EE = "EU372061545"
      ES = "EU372061545"
      FI = "EU372061545"
      FR = "EU372061545"
      GR = "EU372061545"
      HR = "EU372061545"
      HU = "EU372061545"
      IE = "EU372061545"
      IT = "EU372061545"
      LT = "EU372061545"
      LU = "EU372061545"
      LV = "EU372061545"
      MT = "EU372061545"
      NL = "EU372061545"
      PL = "EU372061545"
      PT = "EU372061545"
      RO = "EU372061545"
      SE = "EU372061545"
      SI = "EU372061545"
      SK = "EU372061545"
      GB = "GB458254961"
      VN = "9000020281"
      CL = "59.259.480-3"
      NZ = "148-410-224"
      NO = "VOEC3039846"
      TR = "7300889760"
      CH = "CHE-401.265.595 MWST"
      KR = "111-80-05229"
      KE = "P052518030C"
      CA = "720474766 RT9999"
      AU = "300038975137"
    })
    tax_processors                                   = "[\"stripe\"]"
    tax_record_processor                             = "stripe"
    customer_portal_url_overrides                    = var.customer_portal_url_overrides
    plain_default_tier_external_id                   = var.plain_default_tier_external_id
    merchant_migration_destination_stripe_account_id = var.merchant_migration_destination_stripe_account_id
  }

  backend_secrets = {
    stripe_publishable_key         = var.stripe_publishable_key_production
    current_jwk_kid                = var.backend_current_jwk_kid_production
    discord_bot_token              = var.backend_discord_bot_token_production
    discord_client_id              = var.backend_discord_client_id_production
    discord_client_secret          = var.backend_discord_client_secret_production
    discord_proxy_url              = var.backend_discord_proxy_url
    discord_webhook_url            = var.backend_discord_webhook_url_production
    posthog_project_api_key        = var.backend_posthog_project_api_key_production
    resend_api_key                 = var.backend_resend_api_key_production
    resend_webhook_secret          = var.backend_resend_webhook_secret
    firecrawl_api_key              = var.firecrawl_api_key
    logo_dev_publishable_key       = var.backend_logo_dev_publishable_key_production
    secret                         = var.backend_secret_production
    sentry_dsn                     = var.backend_sentry_dsn_production
    plain_request_signing_secret   = var.backend_plain_request_signing_secret_production
    plain_token                    = var.backend_plain_token_production
    plain_chat_secret              = var.backend_plain_chat_secret_production
    jwks                           = var.backend_jwks_production
    app_review_email               = var.backend_app_review_email
    app_review_otp_code            = var.backend_app_review_otp_code
    chargeback_stop_webhook_secret = var.backend_chargebackstop_webhook_secret_production
    numeral_api_key                = var.numeral_api_key_production
    turnstile_secret               = var.turnstile_secret
  }

  google_secrets = {
    client_id            = var.google_client_id_production
    client_secret        = var.google_client_secret_production
    service_account_json = var.google_service_account_json
  }

  openai_secrets              = { api_key = var.openai_api_key_production }
  pydantic_ai_gateway_secrets = { api_key = var.pydantic_ai_gateway_api_key_production }

  aws_s3_config = {
    region                        = "us-east-2"
    signature_version             = "v4"
    files_presign_ttl             = "3600"
    files_public_bucket_name      = local.files_public_bucket_name
    customer_invoices_bucket_name = "polar-customer-invoices"
    customer_receipts_bucket_name = "polar-customer-receipts"
    payout_invoices_bucket_name   = "polar-payout-invoices"
    logs_bucket_name              = "polar-production-logs"
  }

  aws_s3_secrets = {
    access_key_id         = var.aws_access_key_id_production
    secret_access_key     = var.aws_secret_access_key_production
    files_download_salt   = var.s3_files_download_salt_production
    files_download_secret = var.s3_files_download_secret_production
  }

  github_secrets = {
    client_id                           = var.github_client_id_production
    client_secret                       = var.github_client_secret_production
    repository_benefits_app_identifier  = var.github_repository_benefits_app_identifier_production
    repository_benefits_app_namespace   = var.github_repository_benefits_app_namespace_production
    repository_benefits_app_private_key = var.github_repository_benefits_app_private_key_production
    repository_benefits_client_id       = var.github_repository_benefits_client_id_production
    repository_benefits_client_secret   = var.github_repository_benefits_client_secret_production
  }

  stripe_secrets = {
    connect_webhook_secret      = var.stripe_connect_webhook_secret_production
    secret_key                  = var.stripe_secret_key_production
    webhook_secret              = var.stripe_webhook_secret_production
    account_risk_webhook_secret = var.stripe_account_risk_webhook_secret_production
    app_client_id               = var.stripe_app_client_id
    app_client_link_id          = var.stripe_app_client_link_id
  }

  logfire_config = { token = var.logfire_token }

  apple_secrets = {
    client_id = var.apple_client_id
    team_id   = var.apple_team_id
    key_id    = var.apple_key_id
    key_value = var.apple_key_value
  }

  prometheus_config = {
    url       = var.grafana_cloud_prometheus_url
    username  = var.grafana_cloud_prometheus_username
    password  = var.grafana_cloud_prometheus_password
    query_key = var.grafana_cloud_prometheus_query_key
  }

  slo_report_config = {
    slack_bot_token = var.slo_report_slack_bot_token
    slack_channel   = var.slo_report_slack_channel
  }

  polar_self_config = {
    access_token     = var.polar_access_token
    webhook_secret   = var.polar_webhook_secret
    organization_id  = var.polar_organization_id
    free_product_id  = var.polar_free_product_id
    scale_product_id = var.polar_scale_product_id
    api_url          = "https://api.polar.sh"
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
  source = "../modules/backend_environment"

  environment                 = "production"
  backend_config              = local.backend_config
  backend_secrets             = local.backend_secrets
  google_secrets              = local.google_secrets
  openai_secrets              = local.openai_secrets
  pydantic_ai_gateway_secrets = local.pydantic_ai_gateway_secrets
  aws_s3_config               = local.aws_s3_config
  aws_s3_secrets              = local.aws_s3_secrets
  aws_kms_config = {
    key_id   = module.secrets_kms.key_arn
    role_arn = module.secrets_kms.role_arn
  }
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
  slo_report_config = local.slo_report_config
  polar_self_config = local.polar_self_config
  tinybird_config   = local.tinybird_config
}
