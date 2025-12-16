# Polar Render service setup
#
# Sets up a service, and the specified workers.
# Includes the environment groups

locals {
  environment = var.backend_config.environment == null ? var.environment : var.backend_config.environment
}

resource "render_env_group" "google" {
  environment_id = var.render_environment_id
  name           = "google-${var.environment}"
  env_vars = {
    POLAR_GOOGLE_CLIENT_ID     = { value = var.google_secrets.client_id }
    POLAR_GOOGLE_CLIENT_SECRET = { value = var.google_secrets.client_secret }
  }
}

resource "render_env_group" "openai" {
  environment_id = var.render_environment_id
  name           = "openai-${var.environment}"
  env_vars = {
    POLAR_OPENAI_API_KEY = { value = var.openai_secrets.api_key }
  }
}

resource "render_env_group" "backend" {
  environment_id = var.render_environment_id
  name           = "backend-${var.environment}"
  env_vars = merge(
    {
      POLAR_USER_SESSION_COOKIE_DOMAIN           = { value = var.backend_config.user_session_cookie_domain }
      POLAR_BASE_URL                             = { value = var.backend_config.base_url }
      POLAR_DEBUG                                = { value = var.backend_config.debug }
      POLAR_EMAIL_SENDER                         = { value = var.backend_config.email_sender }
      POLAR_EMAIL_FROM_NAME                      = { value = var.backend_config.email_from_name }
      POLAR_EMAIL_FROM_DOMAIN                    = { value = var.backend_config.email_from_domain }
      POLAR_ENV                                  = { value = local.environment }
      POLAR_FRONTEND_BASE_URL                    = { value = var.backend_config.frontend_base_url }
      POLAR_CHECKOUT_BASE_URL                    = { value = var.backend_config.checkout_base_url }
      POLAR_JWKS                                 = { value = var.backend_config.jwks_path }
      POLAR_LOG_LEVEL                            = { value = var.backend_config.log_level }
      POLAR_TESTING                              = { value = var.backend_config.testing }
      POLAR_ORGANIZATIONS_BILLING_ENGINE_DEFAULT = { value = var.backend_config.organizations_billing_engine_default }
      POLAR_AUTH_COOKIE_DOMAIN                   = { value = var.backend_config.auth_cookie_domain }
      POLAR_INVOICES_ADDITIONAL_INFO             = { value = var.backend_config.invoices_additional_info }
      POLAR_STRIPE_PUBLISHABLE_KEY               = { value = var.backend_secrets.stripe_publishable_key }
      POLAR_CURRENT_JWK_KID                      = { value = var.backend_secrets.current_jwk_kid }
      POLAR_DISCORD_BOT_TOKEN                    = { value = var.backend_secrets.discord_bot_token }
      POLAR_DISCORD_CLIENT_ID                    = { value = var.backend_secrets.discord_client_id }
      POLAR_DISCORD_CLIENT_SECRET                = { value = var.backend_secrets.discord_client_secret }
      POLAR_RESEND_API_KEY                       = { value = var.backend_secrets.resend_api_key }
      POLAR_LOGO_DEV_PUBLISHABLE_KEY             = { value = var.backend_secrets.logo_dev_publishable_key }
      POLAR_SECRET                               = { value = var.backend_secrets.secret }
      POLAR_SENTRY_DSN                           = { value = var.backend_secrets.sentry_dsn }
      POLAR_EVENTS_DUAL_WRITE_ENABLED            = { value = "true" }
    },
    var.backend_config.user_session_cookie_key != "" ? {
      POLAR_USER_SESSION_COOKIE_KEY = { value = var.backend_config.user_session_cookie_key }
    } : {},
    var.backend_config.auth_cookie_key != "" ? {
      POLAR_AUTH_COOKIE_KEY = { value = var.backend_config.auth_cookie_key }
    } : {},
  )

  secret_files = {
    "jwks.json" = {
      content = var.backend_secrets.jwks
    }
  }
}

resource "render_env_group" "backend_production" {
  count          = var.environment == "production" ? 1 : 0
  environment_id = var.render_environment_id
  name           = "backend-production-only"
  env_vars = {
    POLAR_BACKOFFICE_HOST                = { value = var.backend_config.backoffice_host }
    POLAR_DISCORD_WEBHOOK_URL            = { value = var.backend_secrets.discord_webhook_url }
    POLAR_LOOPS_API_KEY                  = { value = var.backend_secrets.loops_api_key }
    POLAR_POSTHOG_PROJECT_API_KEY        = { value = var.backend_secrets.posthog_project_api_key }
    POLAR_PLAIN_REQUEST_SIGNING_SECRET   = { value = var.backend_secrets.plain_request_signing_secret }
    POLAR_PLAIN_TOKEN                    = { value = var.backend_secrets.plain_token }
    POLAR_PLAIN_CHAT_SECRET              = { value = var.backend_secrets.plain_chat_secret }
    POLAR_APP_REVIEW_EMAIL               = { value = var.backend_secrets.app_review_email }
    POLAR_APP_REVIEW_OTP_CODE            = { value = var.backend_secrets.app_review_otp_code }
    POLAR_CHARGEBACK_STOP_WEBHOOK_SECRET = { value = var.backend_secrets.chargeback_stop_webhook_secret }
  }
}

resource "render_env_group" "aws_s3" {
  environment_id = var.render_environment_id
  name           = "aws-s3-${var.environment}"
  env_vars = {
    POLAR_AWS_REGION                       = { value = var.aws_s3_config.region }
    POLAR_AWS_SIGNATURE_VERSION            = { value = var.aws_s3_config.signature_version }
    POLAR_S3_FILES_BUCKET_NAME             = { value = "polar-${var.environment}-files" }
    POLAR_S3_FILES_PRESIGN_TTL             = { value = var.aws_s3_config.files_presign_ttl }
    POLAR_S3_FILES_PUBLIC_BUCKET_NAME      = { value = var.aws_s3_config.files_public_bucket_name }
    POLAR_S3_CUSTOMER_INVOICES_BUCKET_NAME = { value = var.aws_s3_config.customer_invoices_bucket_name }
    POLAR_S3_PAYOUT_INVOICES_BUCKET_NAME   = { value = var.aws_s3_config.payout_invoices_bucket_name }
    POLAR_AWS_ACCESS_KEY_ID                = { value = var.aws_s3_secrets.access_key_id }
    POLAR_AWS_SECRET_ACCESS_KEY            = { value = var.aws_s3_secrets.secret_access_key }
    POLAR_S3_FILES_DOWNLOAD_SALT           = { value = var.aws_s3_secrets.files_download_salt }
    POLAR_S3_FILES_DOWNLOAD_SECRET         = { value = var.aws_s3_secrets.files_download_secret }
  }
}

resource "render_env_group" "github" {
  environment_id = var.render_environment_id
  name           = "github-${var.environment}"
  env_vars = {
    POLAR_GITHUB_CLIENT_ID                           = { value = var.github_secrets.client_id }
    POLAR_GITHUB_CLIENT_SECRET                       = { value = var.github_secrets.client_secret }
    POLAR_GITHUB_REPOSITORY_BENEFITS_APP_IDENTIFIER  = { value = var.github_secrets.repository_benefits_app_identifier }
    POLAR_GITHUB_REPOSITORY_BENEFITS_APP_NAMESPACE   = { value = var.github_secrets.repository_benefits_app_namespace }
    POLAR_GITHUB_REPOSITORY_BENEFITS_APP_PRIVATE_KEY = { value = var.github_secrets.repository_benefits_app_private_key }
    POLAR_GITHUB_REPOSITORY_BENEFITS_CLIENT_ID       = { value = var.github_secrets.repository_benefits_client_id }
    POLAR_GITHUB_REPOSITORY_BENEFITS_CLIENT_SECRET   = { value = var.github_secrets.repository_benefits_client_secret }
  }
}

resource "render_env_group" "stripe" {
  environment_id = var.render_environment_id
  name           = "stripe-${var.environment}"
  env_vars = {
    POLAR_STRIPE_CONNECT_WEBHOOK_SECRET = { value = var.stripe_secrets.connect_webhook_secret }
    POLAR_STRIPE_SECRET_KEY             = { value = var.stripe_secrets.secret_key }
    POLAR_STRIPE_WEBHOOK_SECRET         = { value = var.stripe_secrets.webhook_secret }
  }
}

resource "render_env_group" "logfire_server" {
  count          = var.logfire_config != null ? 1 : 0
  environment_id = var.render_environment_id
  name           = "logfire-server${local.env_suffix}"
  env_vars = {
    POLAR_LOGFIRE_PROJECT_NAME = { value = var.logfire_config.server_project_name }
    POLAR_LOGFIRE_TOKEN        = { value = var.logfire_config.server_token }
  }
}

resource "render_env_group" "logfire_worker" {
  count          = var.logfire_config != null ? 1 : 0
  environment_id = var.render_environment_id
  name           = "logfire-worker${local.env_suffix}"
  env_vars = {
    POLAR_LOGFIRE_PROJECT_NAME = { value = var.logfire_config.worker_project_name }
    POLAR_LOGFIRE_TOKEN        = { value = var.logfire_config.worker_token }
  }
}


resource "render_env_group" "apple" {
  environment_id = var.render_environment_id
  name           = "apple-${var.environment}"
  env_vars = {
    POLAR_APPLE_CLIENT_ID = { value = var.apple_secrets.client_id }
    POLAR_APPLE_TEAM_ID   = { value = var.apple_secrets.team_id }
    POLAR_APPLE_KEY_ID    = { value = var.apple_secrets.key_id }
    POLAR_APPLE_KEY_VALUE = { value = var.apple_secrets.key_value }
  }
}

resource "render_env_group" "prometheus" {
  count          = var.prometheus_config != null ? 1 : 0
  environment_id = var.render_environment_id
  name           = "prometheus-${var.environment}"
  env_vars = {
    POLAR_PROMETHEUS_REMOTE_WRITE_URL      = { value = var.prometheus_config.url }
    POLAR_PROMETHEUS_REMOTE_WRITE_USERNAME = { value = var.prometheus_config.username }
    POLAR_PROMETHEUS_REMOTE_WRITE_PASSWORD = { value = var.prometheus_config.password }
    POLAR_PROMETHEUS_REMOTE_WRITE_INTERVAL = { value = var.prometheus_config.interval }
  }
}

# Services


resource "render_web_service" "api" {
  environment_id     = var.render_environment_id
  name               = "api${local.env_suffix}"
  plan               = "standard"
  region             = "ohio"
  health_check_path  = "/healthz"
  pre_deploy_command = "uv run task pre_deploy"

  runtime_source = {
    image = {
      image_url              = "ghcr.io/polarsource/polar"
      tag                    = "latest"
      registry_credential_id = var.registry_credential_id
    }
  }

  lifecycle {
    ignore_changes = [
      runtime_source.image.image_url,
      runtime_source.image.digest,
      runtime_source.image.tag,
    ]
  }

  autoscaling = var.environment == "production" ? {
    enabled = true
    min     = 1
    max     = 2
    criteria = {
      cpu = {
        enabled    = true
        percentage = 90
      }
      memory = {
        enabled    = true
        percentage = 90
      }
    }
  } : null

  custom_domains = var.api_service_config.custom_domains

  env_vars = {
    WEB_CONCURRENCY              = { value = var.api_service_config.web_concurrency }
    FORWARDED_ALLOW_IPS          = { value = var.api_service_config.forwarded_allow_ips }
    POLAR_ALLOWED_HOSTS          = { value = var.api_service_config.allowed_hosts }
    POLAR_CORS_ORIGINS           = { value = var.api_service_config.cors_origins }
    POLAR_DATABASE_POOL_SIZE     = { value = var.api_service_config.database_pool_size }
    POLAR_POSTGRES_DATABASE      = { value = var.api_service_config.postgres_database }
    POLAR_POSTGRES_HOST          = { value = var.postgres_config.host }
    POLAR_POSTGRES_PORT          = { value = var.postgres_config.port }
    POLAR_POSTGRES_USER          = { value = var.postgres_config.user }
    POLAR_POSTGRES_PWD           = { value = var.postgres_config.password }
    POLAR_POSTGRES_READ_DATABASE = { value = var.api_service_config.postgres_read_database }
    POLAR_POSTGRES_READ_HOST     = { value = var.postgres_config.read_host }
    POLAR_POSTGRES_READ_PORT     = { value = var.postgres_config.read_port }
    POLAR_POSTGRES_READ_USER     = { value = var.postgres_config.read_user }
    POLAR_POSTGRES_READ_PWD      = { value = var.postgres_config.read_password }
    POLAR_REDIS_HOST             = { value = var.redis_config.host }
    POLAR_REDIS_PORT             = { value = var.redis_config.port }
    POLAR_REDIS_DB               = { value = var.api_service_config.redis_db }
  }
}

resource "render_web_service" "worker" {
  for_each = var.workers

  environment_id    = var.render_environment_id
  name              = each.key
  plan              = each.value.plan
  region            = "ohio"
  health_check_path = "/"
  start_command     = each.value.start_command
  num_instances     = each.value.num_instances

  runtime_source = {
    image = each.value.digest != null ? {
      image_url              = "ghcr.io/polarsource/polar"
      registry_credential_id = var.registry_credential_id
      digest                 = each.value.digest
      } : {
      image_url              = "ghcr.io/polarsource/polar"
      registry_credential_id = var.registry_credential_id
      tag                    = each.value.tag
    }
  }

  lifecycle {
    ignore_changes = [
      runtime_source.image.image_url,
      runtime_source.image.tag,
      runtime_source.image.digest,
    ]
  }

  custom_domains = length(each.value.custom_domains) > 0 ? each.value.custom_domains : null

  env_vars = {
    dramatiq_prom_port           = { value = each.value.dramatiq_prom_port }
    POLAR_POSTGRES_DATABASE      = { value = var.api_service_config.postgres_database }
    POLAR_POSTGRES_HOST          = { value = var.postgres_config.host }
    POLAR_POSTGRES_PORT          = { value = var.postgres_config.port }
    POLAR_POSTGRES_USER          = { value = var.postgres_config.user }
    POLAR_POSTGRES_PWD           = { value = var.postgres_config.password }
    POLAR_POSTGRES_READ_DATABASE = { value = var.api_service_config.postgres_read_database }
    POLAR_POSTGRES_READ_HOST     = { value = var.postgres_config.read_host }
    POLAR_POSTGRES_READ_PORT     = { value = var.postgres_config.read_port }
    POLAR_POSTGRES_READ_USER     = { value = var.postgres_config.read_user }
    POLAR_POSTGRES_READ_PWD      = { value = var.postgres_config.read_password }
    POLAR_REDIS_HOST             = { value = var.redis_config.host }
    POLAR_REDIS_PORT             = { value = var.redis_config.port }
    POLAR_REDIS_DB               = { value = var.api_service_config.redis_db }
  }
}

locals {
  env_suffix      = var.environment == "production" ? "" : "-${var.environment}"
  worker_ids      = [for w in render_web_service.worker : w.id]
  all_service_ids = concat([render_web_service.api.id], local.worker_ids)
}

# Env group links
resource "render_env_group_link" "aws_s3" {
  env_group_id = render_env_group.aws_s3.id
  service_ids  = local.all_service_ids
}

resource "render_env_group_link" "google" {
  env_group_id = render_env_group.google.id
  service_ids  = local.all_service_ids
}

resource "render_env_group_link" "github" {
  env_group_id = render_env_group.github.id
  service_ids  = local.all_service_ids
}

resource "render_env_group_link" "backend" {
  env_group_id = render_env_group.backend.id
  service_ids  = local.all_service_ids
}

resource "render_env_group_link" "backend_production" {
  count        = var.environment == "production" ? 1 : 0
  env_group_id = render_env_group.backend_production[0].id
  service_ids  = local.all_service_ids
}

resource "render_env_group_link" "stripe" {
  env_group_id = render_env_group.stripe.id
  service_ids  = local.all_service_ids
}

resource "render_env_group_link" "logfire_server" {
  count        = var.logfire_config != null ? 1 : 0
  env_group_id = render_env_group.logfire_server[0].id
  service_ids  = [render_web_service.api.id]
}

resource "render_env_group_link" "logfire_worker" {
  count        = var.logfire_config != null ? 1 : 0
  env_group_id = render_env_group.logfire_worker[0].id
  service_ids  = local.worker_ids
}

resource "render_env_group_link" "openai" {
  env_group_id = render_env_group.openai.id
  service_ids  = local.all_service_ids
}

resource "render_env_group_link" "apple" {
  env_group_id = render_env_group.apple.id
  service_ids  = [render_web_service.api.id]
}

resource "render_env_group_link" "prometheus" {
  count        = var.prometheus_config != null ? 1 : 0
  env_group_id = render_env_group.prometheus[0].id
  service_ids  = local.all_service_ids
}
