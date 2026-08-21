variable "environment" {
  description = "Environment that the backend runs in."
  type        = string

  validation {
    condition     = contains(["production", "sandbox", "test"], var.environment)
    error_message = "Must be either \"production\", \"sandbox\", or \"test\"."
  }
}

variable "google_secrets" {
  type = object({
    client_id            = string
    client_secret        = string
    service_account_json = string
  })
  sensitive = true
}

variable "openai_secrets" {
  type      = object({ api_key = string })
  sensitive = true
}

variable "pydantic_ai_gateway_secrets" {
  type      = object({ api_key = string })
  sensitive = true
}

variable "backend_config" {
  type = object({
    environment                          = optional(string, null)
    base_url                             = string
    backoffice_host                      = optional(string, null)
    checkout_link_host                   = optional(string, null)
    user_session_cookie_domain           = string
    user_session_cookie_key              = optional(string, "")
    authentication_session_cookie_domain = string
    oauth2_session_state_cookie_domain   = string
    debug                                = string
    email_sender                         = string
    email_from_name                      = string
    email_from_domain                    = string
    frontend_base_url                    = string
    checkout_base_url                    = string
    jwks_path                            = string
    log_level                            = string
    testing                              = string
    auth_cookie_domain                   = string
    auth_cookie_key                      = optional(string, "")
    invoices_additional_info             = optional(string, "")
    invoices_vat_numbers                 = optional(string, "{}")
    tax_processors                       = optional(string, "[\"stripe\"]")
    tax_record_processor                 = optional(string, "stripe")
    customer_portal_url_overrides        = optional(string, "{}")
    plain_default_tier_external_id       = optional(string, "")
  })
}

variable "backend_secrets" {
  type = object({
    stripe_publishable_key         = string
    current_jwk_kid                = string
    discord_bot_token              = string
    discord_client_id              = string
    discord_client_secret          = string
    discord_proxy_url              = optional(string, "")
    discord_webhook_url            = optional(string, "")
    posthog_project_api_key        = optional(string, "")
    resend_api_key                 = string
    resend_webhook_secret          = optional(string, "")
    logo_dev_publishable_key       = optional(string, "")
    secret                         = string
    sentry_dsn                     = string
    plain_request_signing_secret   = optional(string, "")
    plain_token                    = optional(string, "")
    plain_chat_secret              = optional(string, "")
    jwks                           = string
    app_review_email               = optional(string, "")
    app_review_otp_code            = optional(string, "")
    chargeback_stop_webhook_secret = optional(string, "")
    numeral_api_key                = optional(string, "")
    firecrawl_api_key              = optional(string, "")
    turnstile_secret               = string
  })
  sensitive = true
}

variable "aws_s3_config" {
  type = object({
    region                        = string
    signature_version             = string
    files_presign_ttl             = string
    files_public_bucket_name      = string
    customer_invoices_bucket_name = string
    customer_receipts_bucket_name = string
    payout_invoices_bucket_name   = string
    logs_bucket_name              = string
  })
}

variable "aws_s3_secrets" {
  type = object({
    access_key_id         = string
    secret_access_key     = string
    files_download_salt   = string
    files_download_secret = string
  })
  sensitive = true
}

variable "aws_kms_config" {
  type = object({
    key_id   = string
    role_arn = string
  })
}

variable "worker_sqs_config" {
  type = object({
    enabled               = string
    actors                = string
    queue_prefix          = string
    aws_access_key_id     = optional(string)
    aws_secret_access_key = optional(string)
  })
  default   = null
  sensitive = true
}

variable "github_secrets" {
  type = object({
    client_id                           = string
    client_secret                       = string
    repository_benefits_app_identifier  = string
    repository_benefits_app_namespace   = string
    repository_benefits_app_private_key = string
    repository_benefits_client_id       = string
    repository_benefits_client_secret   = string
  })
  sensitive = true
}

variable "stripe_secrets" {
  type = object({
    connect_webhook_secret      = string
    secret_key                  = string
    webhook_secret              = string
    account_risk_webhook_secret = optional(string, "")
    app_client_id               = optional(string, "")
    app_client_link_id          = optional(string, "")
  })
  sensitive = true
}

variable "logfire_config" {
  type = object({
    project_name = optional(string, "polar")
    token        = string
  })
  default   = null
  sensitive = true
}

variable "apple_secrets" {
  type = object({
    client_id = string
    team_id   = string
    key_id    = string
    key_value = string
  })
  sensitive = true
}

variable "prometheus_config" {
  type = object({
    url       = string
    username  = string
    password  = string
    interval  = optional(number, 60)
    query_key = optional(string)
  })
  sensitive = true
}

variable "slo_report_config" {
  type = object({
    slack_bot_token = string
    slack_channel   = string
  })
  default   = null
  sensitive = true
}

variable "polar_self_config" {
  type = object({
    access_token     = string
    webhook_secret   = string
    organization_id  = string
    free_product_id  = string
    scale_product_id = string
    api_url          = string
  })
  default   = null
  sensitive = true
}

variable "tinybird_config" {
  type = object({
    api_url             = string
    clickhouse_url      = string
    api_token           = string
    read_token          = string
    clickhouse_username = string
    clickhouse_token    = string
    workspace           = string
  })
  default   = null
  sensitive = true
}
