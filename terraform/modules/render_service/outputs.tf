output "api_service_url" {
  description = "The URL of the API service (used as CNAME target for custom domains)"
  value       = render_web_service.api.url
}

output "api_service_id" {
  description = "The ID of the API service"
  value       = render_web_service.api.id
}

output "worker_urls" {
  description = "Map of worker names to their URLs"
  value       = { for name, worker in render_web_service.worker : name => worker.url }
}

output "worker_ids" {
  description = "Map of worker names to their IDs"
  value       = { for name, worker in render_web_service.worker : name => worker.id }
}

output "cron_job_ids" {
  description = "Map of cron job names to their IDs"
  value       = { for name, cron in render_cron_job.cron : name => cron.id }
}

output "worker_env_vars" {
  description = "Non-secret env vars shared with the Lambda task workers. Mirrors the env groups linked to the Render workers. Marked sensitive because some values derive from sensitive variables."
  sensitive   = true
  value = merge(
    {
      POLAR_ENV                                  = local.environment
      POLAR_BASE_URL                             = var.backend_config.base_url
      POLAR_FRONTEND_BASE_URL                    = var.backend_config.frontend_base_url
      POLAR_CHECKOUT_BASE_URL                    = var.backend_config.checkout_base_url
      POLAR_DEBUG                                = var.backend_config.debug
      POLAR_LOG_LEVEL                            = var.backend_config.log_level
      POLAR_TESTING                              = var.backend_config.testing
      POLAR_EMAIL_SENDER                         = var.backend_config.email_sender
      POLAR_EMAIL_FROM_NAME                      = var.backend_config.email_from_name
      POLAR_EMAIL_FROM_DOMAIN                    = var.backend_config.email_from_domain
      POLAR_USER_SESSION_COOKIE_DOMAIN           = var.backend_config.user_session_cookie_domain
      POLAR_AUTHENTICATION_SESSION_COOKIE_DOMAIN = var.backend_config.authentication_session_cookie_domain
      POLAR_OAUTH2_SESSION_STATE_COOKIE_DOMAIN   = var.backend_config.oauth2_session_state_cookie_domain
      POLAR_AUTH_COOKIE_DOMAIN                   = var.backend_config.auth_cookie_domain
      POLAR_INVOICES_ADDITIONAL_INFO             = var.backend_config.invoices_additional_info
      POLAR_INVOICES_VAT_NUMBERS                 = var.backend_config.invoices_vat_numbers
      POLAR_TAX_PROCESSORS                       = var.backend_config.tax_processors
      POLAR_TAX_RECORD_PROCESSOR                 = var.backend_config.tax_record_processor
      POLAR_CUSTOMER_PORTAL_URL_OVERRIDES        = var.backend_config.customer_portal_url_overrides
      POLAR_CURRENT_JWK_KID                      = var.backend_secrets.current_jwk_kid
      POLAR_STRIPE_PUBLISHABLE_KEY               = var.backend_secrets.stripe_publishable_key
      POLAR_LOGO_DEV_PUBLISHABLE_KEY             = var.backend_secrets.logo_dev_publishable_key
      POLAR_AWS_REGION                           = var.aws_s3_config.region
      POLAR_AWS_SIGNATURE_VERSION                = var.aws_s3_config.signature_version
      POLAR_AWS_KMS_KEY_ID                       = var.aws_kms_config.key_id
      POLAR_S3_FILES_BUCKET_NAME                 = "polar-${var.environment}-files"
      POLAR_S3_FILES_PRESIGN_TTL                 = var.aws_s3_config.files_presign_ttl
      POLAR_S3_FILES_PUBLIC_BUCKET_NAME          = var.aws_s3_config.files_public_bucket_name
      POLAR_S3_CUSTOMER_INVOICES_BUCKET_NAME     = var.aws_s3_config.customer_invoices_bucket_name
      POLAR_S3_CUSTOMER_RECEIPTS_BUCKET_NAME     = var.aws_s3_config.customer_receipts_bucket_name
      POLAR_S3_PAYOUT_INVOICES_BUCKET_NAME       = var.aws_s3_config.payout_invoices_bucket_name
      POLAR_S3_LOGS_BUCKET_NAME                  = var.aws_s3_config.logs_bucket_name
    },
    var.backend_config.plain_default_tier_external_id != "" ? {
      POLAR_PLAIN_DEFAULT_TIER_EXTERNAL_ID = var.backend_config.plain_default_tier_external_id
    } : {},
    var.environment == "production" ? {
      POLAR_BACKOFFICE_HOST    = var.backend_config.backoffice_host
      POLAR_CHECKOUT_LINK_HOST = var.backend_config.checkout_link_host
    } : {},
    var.logfire_config != null ? {
      POLAR_LOGFIRE_PROJECT_NAME = var.logfire_config.project_name
    } : {},
    var.prometheus_config != null ? {
      POLAR_GRAFANA_CLOUD_PROMETHEUS_WRITE_URL      = "${var.prometheus_config.url}/api/prom/push"
      POLAR_GRAFANA_CLOUD_PROMETHEUS_WRITE_USERNAME = var.prometheus_config.username
      POLAR_GRAFANA_CLOUD_PROMETHEUS_WRITE_INTERVAL = var.prometheus_config.interval
    } : {},
    var.prometheus_config != null && try(var.prometheus_config.query_key, null) != null ? {
      POLAR_GRAFANA_CLOUD_PROMETHEUS_QUERY_URL  = "${var.prometheus_config.url}/api/prom"
      POLAR_GRAFANA_CLOUD_PROMETHEUS_QUERY_USER = var.prometheus_config.username
    } : {},
    var.slo_report_config != null ? {
      POLAR_SLACK_CHANNEL = var.slo_report_config.slack_channel
    } : {},
    var.tinybird_config != null ? {
      POLAR_TINYBIRD_API_URL             = var.tinybird_config.api_url
      POLAR_TINYBIRD_CLICKHOUSE_URL      = var.tinybird_config.clickhouse_url
      POLAR_TINYBIRD_CLICKHOUSE_USERNAME = var.tinybird_config.clickhouse_username
      POLAR_TINYBIRD_WORKSPACE           = var.tinybird_config.workspace
    } : {},
    var.polar_self_config != null ? {
      POLAR_POLAR_ORGANIZATION_ID  = var.polar_self_config.organization_id
      POLAR_POLAR_FREE_PRODUCT_ID  = var.polar_self_config.free_product_id
      POLAR_POLAR_SCALE_PRODUCT_ID = var.polar_self_config.scale_product_id
      POLAR_POLAR_API_URL          = var.polar_self_config.api_url
    } : {},
  )
}

output "worker_secret_env_vars" {
  description = "Secret env vars shared with the Lambda task workers, destined for Secrets Manager."
  sensitive   = true
  value = merge(
    {
      POLAR_SECRET                                     = var.backend_secrets.secret
      POLAR_SENTRY_DSN                                 = var.backend_secrets.sentry_dsn
      POLAR_RESEND_API_KEY                             = var.backend_secrets.resend_api_key
      POLAR_RESEND_WEBHOOK_SECRET                      = var.backend_secrets.resend_webhook_secret
      POLAR_FIRECRAWL_API_KEY                          = var.backend_secrets.firecrawl_api_key
      POLAR_NUMERAL_API_KEY                            = var.backend_secrets.numeral_api_key
      POLAR_TURNSTILE_SECRET                           = var.backend_secrets.turnstile_secret
      POLAR_DISCORD_BOT_TOKEN                          = var.backend_secrets.discord_bot_token
      POLAR_DISCORD_CLIENT_ID                          = var.backend_secrets.discord_client_id
      POLAR_DISCORD_CLIENT_SECRET                      = var.backend_secrets.discord_client_secret
      POLAR_DISCORD_PROXY_URL                          = var.backend_secrets.discord_proxy_url
      POLAR_GOOGLE_CLIENT_ID                           = var.google_secrets.client_id
      POLAR_GOOGLE_CLIENT_SECRET                       = var.google_secrets.client_secret
      POLAR_GOOGLE_SERVICE_ACCOUNT_JSON                = var.google_secrets.service_account_json
      POLAR_OPENAI_API_KEY                             = var.openai_secrets.api_key
      POLAR_PYDANTIC_AI_GATEWAY_API_KEY                = var.pydantic_ai_gateway_secrets.api_key
      POLAR_GITHUB_CLIENT_ID                           = var.github_secrets.client_id
      POLAR_GITHUB_CLIENT_SECRET                       = var.github_secrets.client_secret
      POLAR_GITHUB_REPOSITORY_BENEFITS_APP_IDENTIFIER  = var.github_secrets.repository_benefits_app_identifier
      POLAR_GITHUB_REPOSITORY_BENEFITS_APP_NAMESPACE   = var.github_secrets.repository_benefits_app_namespace
      POLAR_GITHUB_REPOSITORY_BENEFITS_APP_PRIVATE_KEY = var.github_secrets.repository_benefits_app_private_key
      POLAR_GITHUB_REPOSITORY_BENEFITS_CLIENT_ID       = var.github_secrets.repository_benefits_client_id
      POLAR_GITHUB_REPOSITORY_BENEFITS_CLIENT_SECRET   = var.github_secrets.repository_benefits_client_secret
      POLAR_STRIPE_SECRET_KEY                          = var.stripe_secrets.secret_key
      POLAR_STRIPE_CONNECT_WEBHOOK_SECRET              = var.stripe_secrets.connect_webhook_secret
      POLAR_STRIPE_WEBHOOK_SECRET                      = var.stripe_secrets.webhook_secret
      POLAR_STRIPE_ACCOUNT_RISK_WEBHOOK_SECRET         = var.stripe_secrets.account_risk_webhook_secret
      POLAR_STRIPE_APP_CLIENT_ID                       = var.stripe_secrets.app_client_id
      POLAR_STRIPE_APP_CLIENT_LINK_ID                  = var.stripe_secrets.app_client_link_id
      POLAR_APPLE_CLIENT_ID                            = var.apple_secrets.client_id
      POLAR_APPLE_TEAM_ID                              = var.apple_secrets.team_id
      POLAR_APPLE_KEY_ID                               = var.apple_secrets.key_id
      POLAR_APPLE_KEY_VALUE                            = var.apple_secrets.key_value
      POLAR_AWS_ACCESS_KEY_ID                          = var.aws_s3_secrets.access_key_id
      POLAR_AWS_SECRET_ACCESS_KEY                      = var.aws_s3_secrets.secret_access_key
      POLAR_S3_FILES_DOWNLOAD_SALT                     = var.aws_s3_secrets.files_download_salt
      POLAR_S3_FILES_DOWNLOAD_SECRET                   = var.aws_s3_secrets.files_download_secret
    },
    var.backend_config.user_session_cookie_key != "" ? {
      POLAR_USER_SESSION_COOKIE_KEY = var.backend_config.user_session_cookie_key
    } : {},
    var.backend_config.auth_cookie_key != "" ? {
      POLAR_AUTH_COOKIE_KEY = var.backend_config.auth_cookie_key
    } : {},
    var.environment == "production" ? {
      POLAR_DISCORD_WEBHOOK_URL            = var.backend_secrets.discord_webhook_url
      POLAR_POSTHOG_PROJECT_API_KEY        = var.backend_secrets.posthog_project_api_key
      POLAR_PLAIN_REQUEST_SIGNING_SECRET   = var.backend_secrets.plain_request_signing_secret
      POLAR_PLAIN_TOKEN                    = var.backend_secrets.plain_token
      POLAR_PLAIN_CHAT_SECRET              = var.backend_secrets.plain_chat_secret
      POLAR_APP_REVIEW_EMAIL               = var.backend_secrets.app_review_email
      POLAR_APP_REVIEW_OTP_CODE            = var.backend_secrets.app_review_otp_code
      POLAR_CHARGEBACK_STOP_WEBHOOK_SECRET = var.backend_secrets.chargeback_stop_webhook_secret
    } : {},
    var.logfire_config != null ? {
      POLAR_LOGFIRE_TOKEN = var.logfire_config.token
    } : {},
    var.prometheus_config != null ? {
      POLAR_GRAFANA_CLOUD_PROMETHEUS_WRITE_PASSWORD = var.prometheus_config.password
    } : {},
    var.prometheus_config != null && try(var.prometheus_config.query_key, null) != null ? {
      POLAR_GRAFANA_CLOUD_PROMETHEUS_QUERY_KEY = var.prometheus_config.query_key
    } : {},
    var.slo_report_config != null ? {
      POLAR_SLACK_BOT_TOKEN = var.slo_report_config.slack_bot_token
    } : {},
    var.tinybird_config != null ? {
      POLAR_TINYBIRD_API_TOKEN        = var.tinybird_config.api_token
      POLAR_TINYBIRD_READ_TOKEN       = var.tinybird_config.read_token
      POLAR_TINYBIRD_CLICKHOUSE_TOKEN = var.tinybird_config.clickhouse_token
    } : {},
    var.polar_self_config != null ? {
      POLAR_POLAR_ACCESS_TOKEN   = var.polar_self_config.access_token
      POLAR_POLAR_WEBHOOK_SECRET = var.polar_self_config.webhook_secret
    } : {},
  )
}
