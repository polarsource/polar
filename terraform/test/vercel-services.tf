# =============================================================================
# Vercel Services — full-stack test deployment
# =============================================================================

locals {
  # Vercel's Postgres and Redis integrations own POLAR_POSTGRES_URL_NON_POOLING
  # and POLAR_REDIS_URL. They are intentionally not duplicated here.
  vercel_services_environment_variables = {
    SENTRY_ORG = {
      value     = "polar-sh"
      sensitive = false
    }
    SENTRY_PROJECT = {
      value     = "dashboard"
      sensitive = false
    }
    NEXT_PUBLIC_ENVIRONMENT = {
      value     = "test"
      sensitive = false
    }
    NEXT_PUBLIC_BACKOFFICE_URL = {
      value     = "/api/backoffice"
      sensitive = false
    }
    NEXT_PUBLIC_SANDBOX_FRONTEND_BASE_URL = {
      value     = "https://sandbox.polar.sh"
      sensitive = false
    }
    NEXT_PUBLIC_SENTRY_DSN = {
      value     = var.next_public_sentry_dsn
      sensitive = false
    }
    NEXT_PUBLIC_POSTHOG_TOKEN = {
      value     = var.next_public_posthog_token
      sensitive = false
    }
    NEXT_PUBLIC_APPLE_DOMAIN_ASSOCIATION = {
      value     = var.next_public_apple_domain_association
      sensitive = false
    }
    NEXT_PUBLIC_CHECKOUT_EMBED_SCRIPT_SRC = {
      value     = "https://cdn.jsdelivr.net/npm/@polar-sh/checkout@0.1/dist/embed.global.js"
      sensitive = false
    }
    NEXT_PUBLIC_STRIPE_PAYMENT_METHOD_CONFIGURATION = {
      value     = var.next_public_stripe_payment_method_configuration
      sensitive = false
    }
    NEXT_PUBLIC_TURNSTILE_SITE_KEY = {
      value     = "1x00000000000000000000AA"
      sensitive = false
    }
    next_public_stripe_key_production = {
      key       = "NEXT_PUBLIC_STRIPE_KEY"
      value     = var.stripe_publishable_key
      target    = ["production"]
      sensitive = false
    }
    next_public_stripe_key_preview = {
      key       = "NEXT_PUBLIC_STRIPE_KEY"
      value     = var.stripe_publishable_key_preview
      target    = ["preview"]
      sensitive = false
    }
    S3_PUBLIC_IMAGES_BUCKET_PROTOCOL = {
      value     = "https"
      sensitive = false
    }
    S3_PUBLIC_IMAGES_BUCKET_HOSTNAME = {
      value     = "polar-test-public-files.s3.amazonaws.com"
      sensitive = false
    }
    S3_PUBLIC_IMAGES_BUCKET_PATHNAME = {
      value     = "/product_media/**"
      sensitive = false
    }
    S3_UPLOAD_ORIGINS = {
      value     = "https://polar-test-files.s3.amazonaws.com https://polar-test-files.s3.us-east-2.amazonaws.com https://polar-test-public-files.s3.amazonaws.com https://polar-test-public-files.s3.us-east-2.amazonaws.com"
      sensitive = false
    }
    POLAR_CHECKOUT_EMBED_SCRIPT_ALLOWED_ORIGINS = {
      value     = "https://polar.sh,https://sandbox.polar.sh,https://test.polar.sh"
      sensitive = false
    }
    POLAR_OPENAPI_SCHEMA_URL = {
      value     = "https://api.polar.sh/openapi.json"
      sensitive = false
    }
    ENABLE_EXPERIMENTAL_COREPACK = {
      value     = "1"
      sensitive = false
    }
    PYDANTIC_AI_GATEWAY_API_KEY = {
      value = var.pydantic_ai_gateway_api_key
    }
    MINTLIFY_ASSISTANT_API_KEY = {
      value = var.mintlify_assistant_api_key
    }
    GRAM_API_KEY = {
      value = var.gram_api_key
    }
    SENTRY_AUTH_TOKEN = {
      value = var.sentry_auth_token
    }
    POLAR_PREVIEW_ACCESS_TOKEN = {
      value  = var.polar_preview_access_token
      target = ["preview"]
    }
    MCP_OAUTH2_CLIENT_ID = {
      value = var.mcp_oauth2_client_id
    }
    MCP_OAUTH2_CLIENT_SECRET = {
      value = var.mcp_oauth2_client_secret
    }
    POLAR_ENV = {
      value     = "test"
      sensitive = false
    }
    POLAR_DEBUG = {
      value     = "0"
      sensitive = false
    }
    POLAR_TESTING = {
      value     = "0"
      sensitive = false
    }
    POLAR_LOG_LEVEL = {
      value     = "INFO"
      sensitive = false
    }
    POLAR_CORS_ORIGINS = {
      value     = "[\"https://github.com\", \"https://docs.polar.sh\"]"
      sensitive = false
    }
    POLAR_DATABASE_POOL_SIZE = {
      value     = "5"
      sensitive = false
    }
    POLAR_USER_SESSION_COOKIE_KEY = {
      value     = "polar_test_session"
      sensitive = false
    }
    POLAR_AUTH_COOKIE_KEY = {
      value     = "polar_test_session"
      sensitive = false
    }
    POLAR_EMAIL_SENDER = {
      value     = "resend"
      sensitive = false
    }
    POLAR_EMAIL_FROM_NAME = {
      value     = "[TEST] Polar"
      sensitive = false
    }
    POLAR_EMAIL_FROM_DOMAIN = {
      value     = "notifications.test.polar.sh"
      sensitive = false
    }
    POLAR_JWKS = {
      value = var.backend_jwks
    }
    POLAR_CURRENT_JWK_KID = {
      value = var.backend_current_jwk_kid
    }
    POLAR_SECRET = {
      value = var.backend_secret
    }
    POLAR_SENTRY_DSN = {
      value = var.backend_sentry_dsn
    }
    POLAR_TAX_PROCESSORS = {
      value     = "[\"numeral\",\"stripe\"]"
      sensitive = false
    }
    POLAR_TAX_RECORD_PROCESSOR = {
      value     = "numeral"
      sensitive = false
    }
    POLAR_CUSTOMER_PORTAL_URL_OVERRIDES = {
      value     = var.customer_portal_url_overrides
      sensitive = false
    }
    POLAR_PLAIN_DEFAULT_TIER_EXTERNAL_ID = {
      value     = var.plain_default_tier_external_id
      sensitive = false
    }
    POLAR_TURNSTILE_SECRET = {
      value = "1x0000000000000000000000000000000AA"
    }
    POLAR_FIRECRAWL_API_KEY = {
      value = var.firecrawl_api_key
    }
    POLAR_LOGO_DEV_PUBLISHABLE_KEY = {
      value     = var.backend_logo_dev_publishable_key
      sensitive = false
    }
    POLAR_DISCORD_BOT_TOKEN = {
      value = var.backend_discord_bot_token
    }
    POLAR_DISCORD_CLIENT_ID = {
      value = var.backend_discord_client_id
    }
    POLAR_DISCORD_CLIENT_SECRET = {
      value = var.backend_discord_client_secret
    }
    POLAR_DISCORD_PROXY_URL = {
      value = var.backend_discord_proxy_url
    }
    POLAR_RESEND_API_KEY = {
      value = var.backend_resend_api_key
    }
    POLAR_RESEND_WEBHOOK_SECRET = {
      value = var.backend_resend_webhook_secret
    }
    POLAR_NUMERAL_API_KEY = {
      value = var.numeral_api_key
    }
    POLAR_GOOGLE_CLIENT_ID = {
      value = var.google_client_id
    }
    POLAR_GOOGLE_CLIENT_SECRET = {
      value = var.google_client_secret
    }
    POLAR_GOOGLE_SERVICE_ACCOUNT_JSON = {
      value = var.google_service_account_json
    }
    POLAR_OPENAI_API_KEY = {
      value = var.openai_api_key
    }
    POLAR_PYDANTIC_AI_GATEWAY_API_KEY = {
      value = var.pydantic_ai_gateway_api_key
    }
    POLAR_GITHUB_CLIENT_ID = {
      value = var.github_client_id
    }
    POLAR_GITHUB_CLIENT_SECRET = {
      value = var.github_client_secret
    }
    POLAR_GITHUB_REPOSITORY_BENEFITS_APP_IDENTIFIER = {
      value = var.github_repository_benefits_app_identifier
    }
    POLAR_GITHUB_REPOSITORY_BENEFITS_APP_NAMESPACE = {
      value = var.github_repository_benefits_app_namespace
    }
    POLAR_GITHUB_REPOSITORY_BENEFITS_APP_PRIVATE_KEY = {
      value = var.github_repository_benefits_app_private_key
    }
    POLAR_GITHUB_REPOSITORY_BENEFITS_CLIENT_ID = {
      value = var.github_repository_benefits_client_id
    }
    POLAR_GITHUB_REPOSITORY_BENEFITS_CLIENT_SECRET = {
      value = var.github_repository_benefits_client_secret
    }
    POLAR_STRIPE_PUBLISHABLE_KEY = {
      value     = var.stripe_publishable_key
      sensitive = false
    }
    POLAR_STRIPE_CONNECT_WEBHOOK_SECRET = {
      value = var.stripe_connect_webhook_secret
    }
    POLAR_STRIPE_SECRET_KEY = {
      value = var.stripe_secret_key
    }
    POLAR_STRIPE_WEBHOOK_SECRET = {
      value = var.stripe_webhook_secret
    }
    POLAR_STRIPE_ACCOUNT_RISK_WEBHOOK_SECRET = {
      value = var.stripe_account_risk_webhook_secret
    }
    POLAR_STRIPE_APP_CLIENT_ID = {
      value = var.stripe_app_client_id
    }
    POLAR_STRIPE_APP_CLIENT_LINK_ID = {
      value = var.stripe_app_client_link_id
    }
    POLAR_APPLE_CLIENT_ID = {
      value = var.apple_client_id
    }
    POLAR_APPLE_TEAM_ID = {
      value = var.apple_team_id
    }
    POLAR_APPLE_KEY_ID = {
      value = var.apple_key_id
    }
    POLAR_APPLE_KEY_VALUE = {
      value = var.apple_key_value
    }
    POLAR_AWS_REGION = {
      value     = "us-east-2"
      sensitive = false
    }
    POLAR_AWS_SIGNATURE_VERSION = {
      value     = "v4"
      sensitive = false
    }
    POLAR_AWS_ACCESS_KEY_ID = {
      value = var.aws_access_key_id
    }
    POLAR_AWS_SECRET_ACCESS_KEY = {
      value = var.aws_secret_access_key
    }
    AWS_ACCESS_KEY_ID = {
      value = var.aws_access_key_id
    }
    AWS_SECRET_ACCESS_KEY = {
      value = var.aws_secret_access_key
    }
    POLAR_S3_FILES_BUCKET_NAME = {
      value     = local.files_bucket_name
      sensitive = false
    }
    POLAR_S3_FILES_PRESIGN_TTL = {
      value     = "600"
      sensitive = false
    }
    POLAR_S3_FILES_PUBLIC_BUCKET_NAME = {
      value     = local.files_public_bucket_name
      sensitive = false
    }
    POLAR_S3_CUSTOMER_INVOICES_BUCKET_NAME = {
      value     = "polar-test-customer-invoices"
      sensitive = false
    }
    POLAR_S3_CUSTOMER_RECEIPTS_BUCKET_NAME = {
      value     = "polar-test-customer-receipts"
      sensitive = false
    }
    POLAR_S3_PAYOUT_INVOICES_BUCKET_NAME = {
      value     = "polar-test-payout-invoices"
      sensitive = false
    }
    POLAR_S3_LOGS_BUCKET_NAME = {
      value     = "polar-test-logs"
      sensitive = false
    }
    POLAR_S3_FILES_DOWNLOAD_SALT = {
      value = var.s3_files_download_salt
    }
    POLAR_S3_FILES_DOWNLOAD_SECRET = {
      value = var.s3_files_download_secret
    }
    POLAR_LOGFIRE_PROJECT_NAME = {
      value     = "polar"
      sensitive = false
    }
    POLAR_LOGFIRE_TOKEN = {
      value = var.logfire_token
    }
    POLAR_GRAFANA_CLOUD_PROMETHEUS_WRITE_URL = {
      value     = "${var.grafana_cloud_prometheus_url}/api/prom/push"
      sensitive = false
    }
    POLAR_GRAFANA_CLOUD_PROMETHEUS_WRITE_USERNAME = {
      value = var.grafana_cloud_prometheus_username
    }
    POLAR_GRAFANA_CLOUD_PROMETHEUS_WRITE_PASSWORD = {
      value = var.grafana_cloud_prometheus_password
    }
    POLAR_GRAFANA_CLOUD_PROMETHEUS_WRITE_INTERVAL = {
      value     = "60"
      sensitive = false
    }
    POLAR_POLAR_ACCESS_TOKEN = {
      value = var.polar_access_token
    }
    POLAR_POLAR_WEBHOOK_SECRET = {
      value = var.polar_webhook_secret
    }
    POLAR_POLAR_ORGANIZATION_ID = {
      value     = var.polar_organization_id
      sensitive = false
    }
    POLAR_POLAR_FREE_PRODUCT_ID = {
      value     = var.polar_free_product_id
      sensitive = false
    }
    POLAR_POLAR_SCALE_PRODUCT_ID = {
      value     = var.polar_scale_product_id
      sensitive = false
    }
    POLAR_POLAR_API_URL = {
      value     = "https://test-api.polar.sh"
      sensitive = false
    }
    POLAR_TINYBIRD_API_URL = {
      value     = "https://api.us-east.aws.tinybird.co"
      sensitive = false
    }
    POLAR_TINYBIRD_CLICKHOUSE_URL = {
      value     = "https://clickhouse.us-east.aws.tinybird.co"
      sensitive = false
    }
    POLAR_TINYBIRD_API_TOKEN = {
      value = var.tinybird_api_token
    }
    POLAR_TINYBIRD_READ_TOKEN = {
      value = var.tinybird_read_token
    }
    POLAR_TINYBIRD_CLICKHOUSE_USERNAME = {
      value = var.tinybird_clickhouse_username
    }
    POLAR_TINYBIRD_CLICKHOUSE_TOKEN = {
      value = var.tinybird_clickhouse_token
    }
    POLAR_TINYBIRD_WORKSPACE = {
      value = var.tinybird_workspace
    }
  }
}

module "vercel_services" {
  source = "../modules/vercel_services"

  name     = "polar-test-services"
  git_repo = "polarsource/polar"

  resource_config = {
    function_default_regions = ["cle1"]
  }

  environment_variables = local.vercel_services_environment_variables
}
