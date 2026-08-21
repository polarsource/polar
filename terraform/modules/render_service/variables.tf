variable "environment" {
  description = "Environment that the service runs in"
  type        = string

  validation {
    condition     = contains(["production", "sandbox", "test"], var.environment)
    error_message = "Must be either \"production\", \"sandbox\" or \"test\"."
  }
}

variable "render_environment_id" {
  description = "The environment ID in Render"
  type        = string
}

variable "registry_credential_id" {
  description = "Render registry credential ID for GHCR"
  type        = string
  sensitive   = true
}


# Variables for configuring the services and workers
variable "api_service_config" {
  description = "API service configuration"
  type = object({
    allowed_hosts          = string # "[\"polar.sh\", \"backoffice.polar.sh\"]"
    cors_origins           = string # "[\"https://polar.sh\", \"https://github.com\", \"https://docs.polar.sh\"]"
    custom_domains         = list(object({ name = string }))
    image_url              = optional(string, "ghcr.io/polarsource/polar")
    web_concurrency        = optional(string, "2")
    forwarded_allow_ips    = optional(string, "*")
    database_pool_size     = optional(string, "10")
    postgres_database      = optional(string, "polar_cpit")
    postgres_read_database = optional(string, "polar_cpit")
    redis_db               = optional(string, "0")
    plan                   = optional(string, "standard")
  })
}

variable "workers" {
  description = "Map of worker configurations"
  type = map(object({
    start_command      = string
    image_url          = optional(string, "ghcr.io/polarsource/polar")
    custom_domains     = optional(list(object({ name = string })), [])
    dramatiq_prom_port = optional(string, "10000")
    plan               = optional(string, "pro")
    num_instances      = optional(number, 1)
    database_pool_size = optional(string, "5")
    redis_host         = optional(string)
    redis_port         = optional(string)
    redis_db           = optional(string)
  }))
}

variable "postgres_config" {
  description = "PostgreSQL connection configuration"
  type = object({
    host               = string
    port               = string
    user               = string
    password           = string
    host_fallback      = optional(string)
    port_fallback      = optional(string)
    read_host          = string
    read_port          = string
    read_user          = string
    read_password      = string
    read_host_fallback = optional(string)
    read_port_fallback = optional(string)
  })
  sensitive = true
}

variable "redis_config" {
  description = "Redis connection configuration"
  type = object({
    host = string
    port = string
  })
  sensitive = true
}

variable "environment_groups" {
  description = "Named environment-variable groups produced by the backend_environment module"
  type = object({
    google = object({
      POLAR_GOOGLE_CLIENT_ID            = string
      POLAR_GOOGLE_CLIENT_SECRET        = string
      POLAR_GOOGLE_SERVICE_ACCOUNT_JSON = string
    })
    openai = object({
      POLAR_OPENAI_API_KEY = string
    })
    pydantic_ai_gateway = object({
      POLAR_PYDANTIC_AI_GATEWAY_API_KEY = string
    })
    backend = object({
      POLAR_USER_SESSION_COOKIE_DOMAIN           = string
      POLAR_AUTHENTICATION_SESSION_COOKIE_DOMAIN = string
      POLAR_OAUTH2_SESSION_STATE_COOKIE_DOMAIN   = string
      POLAR_BASE_URL                             = string
      POLAR_DEBUG                                = string
      POLAR_EMAIL_SENDER                         = string
      POLAR_EMAIL_FROM_NAME                      = string
      POLAR_EMAIL_FROM_DOMAIN                    = string
      POLAR_ENV                                  = string
      POLAR_FRONTEND_BASE_URL                    = string
      POLAR_CHECKOUT_BASE_URL                    = string
      POLAR_JWKS                                 = string
      POLAR_LOG_LEVEL                            = string
      POLAR_TESTING                              = string
      POLAR_AUTH_COOKIE_DOMAIN                   = string
      POLAR_INVOICES_ADDITIONAL_INFO             = string
      POLAR_INVOICES_VAT_NUMBERS                 = string
      POLAR_STRIPE_PUBLISHABLE_KEY               = string
      POLAR_CURRENT_JWK_KID                      = string
      POLAR_DISCORD_BOT_TOKEN                    = string
      POLAR_DISCORD_CLIENT_ID                    = string
      POLAR_DISCORD_CLIENT_SECRET                = string
      POLAR_DISCORD_PROXY_URL                    = string
      POLAR_RESEND_API_KEY                       = string
      POLAR_RESEND_WEBHOOK_SECRET                = string
      POLAR_FIRECRAWL_API_KEY                    = string
      POLAR_LOGO_DEV_PUBLISHABLE_KEY             = string
      POLAR_SECRET                               = string
      POLAR_SENTRY_DSN                           = string
      POLAR_TAX_PROCESSORS                       = string
      POLAR_TAX_RECORD_PROCESSOR                 = string
      POLAR_NUMERAL_API_KEY                      = string
      POLAR_TURNSTILE_SECRET                     = string
      POLAR_CUSTOMER_PORTAL_URL_OVERRIDES        = string
      POLAR_PLAIN_DEFAULT_TIER_EXTERNAL_ID       = optional(string)
      POLAR_USER_SESSION_COOKIE_KEY              = optional(string)
      POLAR_AUTH_COOKIE_KEY                      = optional(string)

      POLAR_MERCHANT_MIGRATION_DESTINATION_STRIPE_ACCOUNT_ID = optional(string)
    })
    backend_production = object({
      POLAR_BACKOFFICE_HOST                = string
      POLAR_CHECKOUT_LINK_HOST             = string
      POLAR_DISCORD_WEBHOOK_URL            = string
      POLAR_POSTHOG_PROJECT_API_KEY        = string
      POLAR_PLAIN_REQUEST_SIGNING_SECRET   = string
      POLAR_PLAIN_TOKEN                    = string
      POLAR_PLAIN_CHAT_SECRET              = string
      POLAR_APP_REVIEW_EMAIL               = string
      POLAR_APP_REVIEW_OTP_CODE            = string
      POLAR_CHARGEBACK_STOP_WEBHOOK_SECRET = string
    })
    aws_s3 = object({
      POLAR_AWS_REGION                       = string
      POLAR_AWS_SIGNATURE_VERSION            = string
      POLAR_S3_FILES_BUCKET_NAME             = string
      POLAR_S3_FILES_PRESIGN_TTL             = string
      POLAR_S3_FILES_PUBLIC_BUCKET_NAME      = string
      POLAR_S3_CUSTOMER_INVOICES_BUCKET_NAME = string
      POLAR_S3_CUSTOMER_RECEIPTS_BUCKET_NAME = string
      POLAR_S3_PAYOUT_INVOICES_BUCKET_NAME   = string
      POLAR_S3_LOGS_BUCKET_NAME              = string
      POLAR_AWS_ACCESS_KEY_ID                = string
      POLAR_AWS_SECRET_ACCESS_KEY            = string
      POLAR_S3_FILES_DOWNLOAD_SALT           = string
      POLAR_S3_FILES_DOWNLOAD_SECRET         = string
    })
    secrets_kms = object({
      POLAR_AWS_KMS_KEY_ID = string
      AWS_ROLE_ARN         = string
    })
    worker_sqs = object({
      POLAR_WORKER_SQS_ENABLED               = string
      POLAR_WORKER_SQS_ACTORS                = string
      POLAR_WORKER_SQS_QUEUE_PREFIX          = string
      POLAR_WORKER_SQS_AWS_ACCESS_KEY_ID     = optional(string)
      POLAR_WORKER_SQS_AWS_SECRET_ACCESS_KEY = optional(string)
    })
    github = object({
      POLAR_GITHUB_CLIENT_ID                           = string
      POLAR_GITHUB_CLIENT_SECRET                       = string
      POLAR_GITHUB_REPOSITORY_BENEFITS_APP_IDENTIFIER  = string
      POLAR_GITHUB_REPOSITORY_BENEFITS_APP_NAMESPACE   = string
      POLAR_GITHUB_REPOSITORY_BENEFITS_APP_PRIVATE_KEY = string
      POLAR_GITHUB_REPOSITORY_BENEFITS_CLIENT_ID       = string
      POLAR_GITHUB_REPOSITORY_BENEFITS_CLIENT_SECRET   = string
    })
    stripe = object({
      POLAR_STRIPE_CONNECT_WEBHOOK_SECRET      = string
      POLAR_STRIPE_SECRET_KEY                  = string
      POLAR_STRIPE_WEBHOOK_SECRET              = string
      POLAR_STRIPE_ACCOUNT_RISK_WEBHOOK_SECRET = string
      POLAR_STRIPE_APP_CLIENT_ID               = string
      POLAR_STRIPE_APP_CLIENT_LINK_ID          = string
    })
    logfire = object({
      POLAR_LOGFIRE_PROJECT_NAME = string
      POLAR_LOGFIRE_TOKEN        = string
    })
    apple = object({
      POLAR_APPLE_CLIENT_ID = string
      POLAR_APPLE_TEAM_ID   = string
      POLAR_APPLE_KEY_ID    = string
      POLAR_APPLE_KEY_VALUE = string
    })
    prometheus = object({
      POLAR_GRAFANA_CLOUD_PROMETHEUS_WRITE_URL      = string
      POLAR_GRAFANA_CLOUD_PROMETHEUS_WRITE_USERNAME = string
      POLAR_GRAFANA_CLOUD_PROMETHEUS_WRITE_PASSWORD = string
      POLAR_GRAFANA_CLOUD_PROMETHEUS_WRITE_INTERVAL = string
      POLAR_GRAFANA_CLOUD_PROMETHEUS_QUERY_URL      = optional(string)
      POLAR_GRAFANA_CLOUD_PROMETHEUS_QUERY_USER     = optional(string)
      POLAR_GRAFANA_CLOUD_PROMETHEUS_QUERY_KEY      = optional(string)
    })
    slo_report = object({
      POLAR_SLACK_BOT_TOKEN = string
      POLAR_SLACK_CHANNEL   = string
    })
    tinybird = object({
      POLAR_TINYBIRD_API_URL             = string
      POLAR_TINYBIRD_CLICKHOUSE_URL      = string
      POLAR_TINYBIRD_API_TOKEN           = string
      POLAR_TINYBIRD_READ_TOKEN          = string
      POLAR_TINYBIRD_CLICKHOUSE_USERNAME = string
      POLAR_TINYBIRD_CLICKHOUSE_TOKEN    = string
      POLAR_TINYBIRD_WORKSPACE           = string
    })
    polar_self = object({
      POLAR_POLAR_ACCESS_TOKEN     = string
      POLAR_POLAR_WEBHOOK_SECRET   = string
      POLAR_POLAR_ORGANIZATION_ID  = string
      POLAR_POLAR_FREE_PRODUCT_ID  = string
      POLAR_POLAR_API_URL          = string
      POLAR_POLAR_SCALE_PRODUCT_ID = string
    })
  })
  sensitive = true
}

variable "backend_jwks" {
  description = "Backend JWKS written to Render secret files and cron-job temporary files."
  type        = string
  sensitive   = true
}

variable "email_from_domain" {
  description = "Sender domain used for Resend DNS records."
  type        = string
}

variable "memory_profile_config" {
  description = "Memory profiling configuration (optional). When set, enables periodic gc-based heap snapshots uploaded to S3 as JSON."
  type = object({
    s3_bucket_name = string
    interval       = optional(number, 300)
  })
  default = null
}

variable "cron_jobs" {
  description = "Map of cron job configurations. image_url defaults to the API service image. Uses 'latest' tag so Render pulls the newest image before each run."
  type = map(object({
    schedule           = string
    start_command      = string
    image_url          = optional(string)
    plan               = optional(string, "starter")
    database_pool_size = optional(string, "5")
  }))
  default = {}
}

variable "resend_domain" {
  description = "Resend domain DNS records (DKIM + SPF)."
  type = object({
    zone_id         = string
    dkim_public_key = string
    spf_policy      = string
  })
}
