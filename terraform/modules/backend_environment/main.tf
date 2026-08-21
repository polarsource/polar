locals {
  environment = var.backend_config.environment == null ? var.environment : var.backend_config.environment

  google_secrets = {
    POLAR_GOOGLE_CLIENT_ID            = var.google_secrets.client_id
    POLAR_GOOGLE_CLIENT_SECRET        = var.google_secrets.client_secret
    POLAR_GOOGLE_SERVICE_ACCOUNT_JSON = var.google_secrets.service_account_json
  }

  openai_secrets = {
    POLAR_OPENAI_API_KEY = var.openai_secrets.api_key
  }

  pydantic_ai_gateway_secrets = {
    POLAR_PYDANTIC_AI_GATEWAY_API_KEY = var.pydantic_ai_gateway_secrets.api_key
  }

  backend_environment_variables = merge(
    {
      POLAR_USER_SESSION_COOKIE_DOMAIN           = var.backend_config.user_session_cookie_domain
      POLAR_AUTHENTICATION_SESSION_COOKIE_DOMAIN = var.backend_config.authentication_session_cookie_domain
      POLAR_OAUTH2_SESSION_STATE_COOKIE_DOMAIN   = var.backend_config.oauth2_session_state_cookie_domain
      POLAR_BASE_URL                             = var.backend_config.base_url
      POLAR_DEBUG                                = var.backend_config.debug
      POLAR_EMAIL_SENDER                         = var.backend_config.email_sender
      POLAR_EMAIL_FROM_NAME                      = var.backend_config.email_from_name
      POLAR_EMAIL_FROM_DOMAIN                    = var.backend_config.email_from_domain
      POLAR_ENV                                  = local.environment
      POLAR_FRONTEND_BASE_URL                    = var.backend_config.frontend_base_url
      POLAR_CHECKOUT_BASE_URL                    = var.backend_config.checkout_base_url
      POLAR_LOG_LEVEL                            = var.backend_config.log_level
      POLAR_TESTING                              = var.backend_config.testing
      POLAR_AUTH_COOKIE_DOMAIN                   = var.backend_config.auth_cookie_domain
      POLAR_INVOICES_ADDITIONAL_INFO             = var.backend_config.invoices_additional_info
      POLAR_INVOICES_VAT_NUMBERS                 = var.backend_config.invoices_vat_numbers
      POLAR_STRIPE_PUBLISHABLE_KEY               = var.backend_secrets.stripe_publishable_key
      POLAR_CURRENT_JWK_KID                      = var.backend_secrets.current_jwk_kid
      POLAR_LOGO_DEV_PUBLISHABLE_KEY             = var.backend_secrets.logo_dev_publishable_key
      POLAR_TAX_PROCESSORS                       = var.backend_config.tax_processors
      POLAR_TAX_RECORD_PROCESSOR                 = var.backend_config.tax_record_processor
      POLAR_CUSTOMER_PORTAL_URL_OVERRIDES        = var.backend_config.customer_portal_url_overrides
    },
    var.backend_config.plain_default_tier_external_id != "" ? {
      POLAR_PLAIN_DEFAULT_TIER_EXTERNAL_ID = var.backend_config.plain_default_tier_external_id
    } : {},
    var.backend_config.merchant_migration_destination_stripe_account_id != "" ? {
      POLAR_MERCHANT_MIGRATION_DESTINATION_STRIPE_ACCOUNT_ID = var.backend_config.merchant_migration_destination_stripe_account_id
    } : {},
  )

  backend_secrets = merge(
    {
      POLAR_DISCORD_BOT_TOKEN     = var.backend_secrets.discord_bot_token
      POLAR_DISCORD_CLIENT_ID     = var.backend_secrets.discord_client_id
      POLAR_DISCORD_CLIENT_SECRET = var.backend_secrets.discord_client_secret
      POLAR_DISCORD_PROXY_URL     = var.backend_secrets.discord_proxy_url
      POLAR_RESEND_API_KEY        = var.backend_secrets.resend_api_key
      POLAR_RESEND_WEBHOOK_SECRET = var.backend_secrets.resend_webhook_secret
      POLAR_FIRECRAWL_API_KEY     = var.backend_secrets.firecrawl_api_key
      POLAR_SECRET                = var.backend_secrets.secret
      POLAR_SENTRY_DSN            = var.backend_secrets.sentry_dsn
      POLAR_NUMERAL_API_KEY       = var.backend_secrets.numeral_api_key
      POLAR_TURNSTILE_SECRET      = var.backend_secrets.turnstile_secret
    },
    var.backend_config.user_session_cookie_key != "" ? {
      POLAR_USER_SESSION_COOKIE_KEY = var.backend_config.user_session_cookie_key
    } : {},
    var.backend_config.auth_cookie_key != "" ? {
      POLAR_AUTH_COOKIE_KEY = var.backend_config.auth_cookie_key
    } : {},
  )

  backend_production_environment_variables = var.environment == "production" ? {
    POLAR_BACKOFFICE_HOST    = var.backend_config.backoffice_host
    POLAR_CHECKOUT_LINK_HOST = var.backend_config.checkout_link_host
  } : {}

  backend_production_secrets = var.environment == "production" ? {
    POLAR_DISCORD_WEBHOOK_URL            = var.backend_secrets.discord_webhook_url
    POLAR_POSTHOG_PROJECT_API_KEY        = var.backend_secrets.posthog_project_api_key
    POLAR_PLAIN_REQUEST_SIGNING_SECRET   = var.backend_secrets.plain_request_signing_secret
    POLAR_PLAIN_TOKEN                    = var.backend_secrets.plain_token
    POLAR_PLAIN_CHAT_SECRET              = var.backend_secrets.plain_chat_secret
    POLAR_APP_REVIEW_EMAIL               = var.backend_secrets.app_review_email
    POLAR_APP_REVIEW_OTP_CODE            = var.backend_secrets.app_review_otp_code
    POLAR_CHARGEBACK_STOP_WEBHOOK_SECRET = var.backend_secrets.chargeback_stop_webhook_secret
  } : {}

  aws_s3_environment_variables = {
    POLAR_AWS_REGION                       = var.aws_s3_config.region
    POLAR_AWS_SIGNATURE_VERSION            = var.aws_s3_config.signature_version
    POLAR_S3_FILES_BUCKET_NAME             = "polar-${var.environment}-files"
    POLAR_S3_FILES_PRESIGN_TTL             = var.aws_s3_config.files_presign_ttl
    POLAR_S3_FILES_PUBLIC_BUCKET_NAME      = var.aws_s3_config.files_public_bucket_name
    POLAR_S3_CUSTOMER_INVOICES_BUCKET_NAME = var.aws_s3_config.customer_invoices_bucket_name
    POLAR_S3_CUSTOMER_RECEIPTS_BUCKET_NAME = var.aws_s3_config.customer_receipts_bucket_name
    POLAR_S3_PAYOUT_INVOICES_BUCKET_NAME   = var.aws_s3_config.payout_invoices_bucket_name
    POLAR_S3_LOGS_BUCKET_NAME              = var.aws_s3_config.logs_bucket_name
  }

  aws_s3_secrets = {
    POLAR_AWS_ACCESS_KEY_ID        = var.aws_s3_secrets.access_key_id
    POLAR_AWS_SECRET_ACCESS_KEY    = var.aws_s3_secrets.secret_access_key
    POLAR_S3_FILES_DOWNLOAD_SALT   = var.aws_s3_secrets.files_download_salt
    POLAR_S3_FILES_DOWNLOAD_SECRET = var.aws_s3_secrets.files_download_secret
  }

  secrets_kms_environment_variables = {
    POLAR_AWS_KMS_KEY_ID = var.aws_kms_config.key_id
  }

  secrets_kms_render_environment_variables = {
    AWS_ROLE_ARN = var.aws_kms_config.role_arn
  }

  worker_sqs_environment_variables = var.worker_sqs_config != null ? {
    POLAR_WORKER_SQS_ENABLED      = var.worker_sqs_config.enabled
    POLAR_WORKER_SQS_ACTORS       = var.worker_sqs_config.actors
    POLAR_WORKER_SQS_QUEUE_PREFIX = var.worker_sqs_config.queue_prefix
  } : {}

  worker_sqs_render_secrets = var.worker_sqs_config != null && var.worker_sqs_config.aws_access_key_id != null ? {
    POLAR_WORKER_SQS_AWS_ACCESS_KEY_ID     = var.worker_sqs_config.aws_access_key_id
    POLAR_WORKER_SQS_AWS_SECRET_ACCESS_KEY = var.worker_sqs_config.aws_secret_access_key
  } : {}

  github_secrets = {
    POLAR_GITHUB_CLIENT_ID                           = var.github_secrets.client_id
    POLAR_GITHUB_CLIENT_SECRET                       = var.github_secrets.client_secret
    POLAR_GITHUB_REPOSITORY_BENEFITS_APP_IDENTIFIER  = var.github_secrets.repository_benefits_app_identifier
    POLAR_GITHUB_REPOSITORY_BENEFITS_APP_NAMESPACE   = var.github_secrets.repository_benefits_app_namespace
    POLAR_GITHUB_REPOSITORY_BENEFITS_APP_PRIVATE_KEY = var.github_secrets.repository_benefits_app_private_key
    POLAR_GITHUB_REPOSITORY_BENEFITS_CLIENT_ID       = var.github_secrets.repository_benefits_client_id
    POLAR_GITHUB_REPOSITORY_BENEFITS_CLIENT_SECRET   = var.github_secrets.repository_benefits_client_secret
  }

  stripe_secrets = {
    POLAR_STRIPE_CONNECT_WEBHOOK_SECRET      = var.stripe_secrets.connect_webhook_secret
    POLAR_STRIPE_SECRET_KEY                  = var.stripe_secrets.secret_key
    POLAR_STRIPE_WEBHOOK_SECRET              = var.stripe_secrets.webhook_secret
    POLAR_STRIPE_ACCOUNT_RISK_WEBHOOK_SECRET = var.stripe_secrets.account_risk_webhook_secret
    POLAR_STRIPE_APP_CLIENT_ID               = var.stripe_secrets.app_client_id
    POLAR_STRIPE_APP_CLIENT_LINK_ID          = var.stripe_secrets.app_client_link_id
  }

  logfire_environment_variables = var.logfire_config != null ? {
    POLAR_LOGFIRE_PROJECT_NAME = var.logfire_config.project_name
  } : {}

  logfire_secrets = var.logfire_config != null ? {
    POLAR_LOGFIRE_TOKEN = var.logfire_config.token
  } : {}

  apple_secrets = {
    POLAR_APPLE_CLIENT_ID = var.apple_secrets.client_id
    POLAR_APPLE_TEAM_ID   = var.apple_secrets.team_id
    POLAR_APPLE_KEY_ID    = var.apple_secrets.key_id
    POLAR_APPLE_KEY_VALUE = var.apple_secrets.key_value
  }

  prometheus_environment_variables = var.prometheus_config != null ? merge(
    {
      POLAR_GRAFANA_CLOUD_PROMETHEUS_WRITE_URL      = "${var.prometheus_config.url}/api/prom/push"
      POLAR_GRAFANA_CLOUD_PROMETHEUS_WRITE_USERNAME = var.prometheus_config.username
      POLAR_GRAFANA_CLOUD_PROMETHEUS_WRITE_INTERVAL = var.prometheus_config.interval
    },
    var.prometheus_config.query_key != null ? {
      POLAR_GRAFANA_CLOUD_PROMETHEUS_QUERY_URL  = "${var.prometheus_config.url}/api/prom"
      POLAR_GRAFANA_CLOUD_PROMETHEUS_QUERY_USER = var.prometheus_config.username
    } : {},
  ) : {}

  prometheus_secrets = var.prometheus_config != null ? merge(
    {
      POLAR_GRAFANA_CLOUD_PROMETHEUS_WRITE_PASSWORD = var.prometheus_config.password
    },
    var.prometheus_config.query_key != null ? {
      POLAR_GRAFANA_CLOUD_PROMETHEUS_QUERY_KEY = var.prometheus_config.query_key
    } : {},
  ) : {}

  slo_report_environment_variables = var.slo_report_config != null ? {
    POLAR_SLACK_CHANNEL = var.slo_report_config.slack_channel
  } : {}

  slo_report_secrets = var.slo_report_config != null ? {
    POLAR_SLACK_BOT_TOKEN = var.slo_report_config.slack_bot_token
  } : {}

  tinybird_environment_variables = var.tinybird_config != null ? {
    POLAR_TINYBIRD_API_URL             = var.tinybird_config.api_url
    POLAR_TINYBIRD_CLICKHOUSE_URL      = var.tinybird_config.clickhouse_url
    POLAR_TINYBIRD_CLICKHOUSE_USERNAME = var.tinybird_config.clickhouse_username
    POLAR_TINYBIRD_WORKSPACE           = var.tinybird_config.workspace
  } : {}

  tinybird_secrets = var.tinybird_config != null ? {
    POLAR_TINYBIRD_API_TOKEN        = var.tinybird_config.api_token
    POLAR_TINYBIRD_READ_TOKEN       = var.tinybird_config.read_token
    POLAR_TINYBIRD_CLICKHOUSE_TOKEN = var.tinybird_config.clickhouse_token
  } : {}

  polar_self_environment_variables = var.polar_self_config != null ? {
    POLAR_POLAR_ORGANIZATION_ID  = var.polar_self_config.organization_id
    POLAR_POLAR_FREE_PRODUCT_ID  = var.polar_self_config.free_product_id
    POLAR_POLAR_API_URL          = var.polar_self_config.api_url
    POLAR_POLAR_SCALE_PRODUCT_ID = var.polar_self_config.scale_product_id
  } : {}

  polar_self_secrets = var.polar_self_config != null ? {
    POLAR_POLAR_ACCESS_TOKEN   = var.polar_self_config.access_token
    POLAR_POLAR_WEBHOOK_SECRET = var.polar_self_config.webhook_secret
  } : {}

  environment_groups = {
    google              = local.google_secrets
    openai              = local.openai_secrets
    pydantic_ai_gateway = local.pydantic_ai_gateway_secrets
    backend = merge(
      local.backend_environment_variables,
      local.backend_secrets,
      { POLAR_JWKS = var.backend_config.jwks_path },
    )
    backend_production = var.environment == "production" ? merge(local.backend_production_environment_variables, local.backend_production_secrets) : null
    aws_s3             = merge(local.aws_s3_environment_variables, local.aws_s3_secrets)
    secrets_kms        = merge(local.secrets_kms_environment_variables, local.secrets_kms_render_environment_variables)
    worker_sqs         = var.worker_sqs_config != null ? merge(local.worker_sqs_environment_variables, local.worker_sqs_render_secrets) : null
    github             = local.github_secrets
    stripe             = local.stripe_secrets
    logfire            = var.logfire_config != null ? merge(local.logfire_environment_variables, local.logfire_secrets) : null
    apple              = local.apple_secrets
    prometheus         = var.prometheus_config != null ? merge(local.prometheus_environment_variables, local.prometheus_secrets) : null
    slo_report         = var.slo_report_config != null ? merge(local.slo_report_environment_variables, local.slo_report_secrets) : null
    tinybird           = var.tinybird_config != null ? merge(local.tinybird_environment_variables, local.tinybird_secrets) : null
    polar_self         = var.polar_self_config != null ? merge(local.polar_self_environment_variables, local.polar_self_secrets) : null
  }

  environment_variables = merge(
    local.backend_environment_variables,
    local.backend_production_environment_variables,
    local.aws_s3_environment_variables,
    local.secrets_kms_environment_variables,
    local.worker_sqs_environment_variables,
    local.logfire_environment_variables,
    local.prometheus_environment_variables,
    local.slo_report_environment_variables,
    local.tinybird_environment_variables,
    local.polar_self_environment_variables,
  )

  secret_environment_variables = merge(
    local.google_secrets,
    local.openai_secrets,
    local.pydantic_ai_gateway_secrets,
    local.backend_secrets,
    local.backend_production_secrets,
    local.aws_s3_secrets,
    local.github_secrets,
    local.stripe_secrets,
    local.logfire_secrets,
    local.apple_secrets,
    local.prometheus_secrets,
    local.slo_report_secrets,
    local.tinybird_secrets,
    local.polar_self_secrets,
  )
}
