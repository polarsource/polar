# Polar Render service setup
#
# Sets up a service, and the specified workers.
# Includes the environment groups

resource "render_env_group" "google" {
  environment_id = var.render_environment_id
  name           = "google-${var.environment}"
  env_vars       = { for name, value in var.environment_groups.google : name => { value = value } if value != null }
}

resource "render_env_group" "openai" {
  environment_id = var.render_environment_id
  name           = "openai-${var.environment}"
  env_vars       = { for name, value in var.environment_groups.openai : name => { value = value } if value != null }
}

resource "render_env_group" "pydantic_ai_gateway" {
  environment_id = var.render_environment_id
  name           = "pydantic-ai-gateway-${var.environment}"
  env_vars       = { for name, value in var.environment_groups.pydantic_ai_gateway : name => { value = value } if value != null }
}

resource "render_env_group" "backend" {
  environment_id = var.render_environment_id
  name           = "backend-${var.environment}"
  env_vars       = { for name, value in var.environment_groups.backend : name => { value = value } if value != null }

  secret_files = {
    "jwks.json" = {
      content = var.backend_jwks
    }
  }
}

resource "render_env_group" "backend_production" {
  count          = var.environment == "production" ? 1 : 0
  environment_id = var.render_environment_id
  name           = "backend-production-only"
  env_vars       = { for name, value in var.environment_groups.backend_production : name => { value = value } if value != null }
}

resource "render_env_group" "aws_s3" {
  environment_id = var.render_environment_id
  name           = "aws-s3-${var.environment}"
  env_vars       = { for name, value in var.environment_groups.aws_s3 : name => { value = value } if value != null }
}

# Setting AWS_ROLE_ARN makes Render inject a web-identity token, so boto3
# assumes the role via OIDC and needs no static keys.
resource "render_env_group" "secrets_kms" {
  environment_id = var.render_environment_id
  name           = "secrets-kms-${var.environment}"
  env_vars       = { for name, value in var.environment_groups.secrets_kms : name => { value = value } if value != null }
}

resource "render_env_group" "worker_sqs" {
  count          = nonsensitive(var.environment_groups.worker_sqs != null) ? 1 : 0
  environment_id = var.render_environment_id
  name           = "worker-sqs-${var.environment}"
  env_vars       = { for name, value in var.environment_groups.worker_sqs : name => { value = value } if value != null }
}

resource "render_env_group" "github" {
  environment_id = var.render_environment_id
  name           = "github-${var.environment}"
  env_vars       = { for name, value in var.environment_groups.github : name => { value = value } if value != null }
}

resource "render_env_group" "stripe" {
  environment_id = var.render_environment_id
  name           = "stripe-${var.environment}"
  env_vars       = { for name, value in var.environment_groups.stripe : name => { value = value } if value != null }
}

resource "render_env_group" "logfire" {
  count          = nonsensitive(var.environment_groups.logfire != null) ? 1 : 0
  environment_id = var.render_environment_id
  name           = "logfire-${var.environment}"
  env_vars       = { for name, value in var.environment_groups.logfire : name => { value = value } if value != null }
}


resource "render_env_group" "apple" {
  environment_id = var.render_environment_id
  name           = "apple-${var.environment}"
  env_vars       = { for name, value in var.environment_groups.apple : name => { value = value } if value != null }
}

resource "render_env_group" "prometheus" {
  count          = nonsensitive(var.environment_groups.prometheus != null) ? 1 : 0
  environment_id = var.render_environment_id
  name           = "prometheus-${var.environment}"
  env_vars       = { for name, value in var.environment_groups.prometheus : name => { value = value } if value != null }
}

resource "render_env_group" "slo_report" {
  count          = nonsensitive(var.environment_groups.slo_report != null) ? 1 : 0
  environment_id = var.render_environment_id
  name           = "slo-report-${var.environment}"
  env_vars       = { for name, value in var.environment_groups.slo_report : name => { value = value } if value != null }
}

resource "render_env_group" "tinybird" {
  count          = nonsensitive(var.environment_groups.tinybird != null) ? 1 : 0
  environment_id = var.render_environment_id
  name           = "tinybird-${var.environment}"
  env_vars       = { for name, value in var.environment_groups.tinybird : name => { value = value } if value != null }
}

resource "render_env_group" "polar_self" {
  count          = nonsensitive(var.environment_groups.polar_self != null) ? 1 : 0
  environment_id = var.render_environment_id
  name           = "polar-self-${var.environment}"
  env_vars       = { for name, value in var.environment_groups.polar_self : name => { value = value } if value != null }
}

resource "render_env_group" "memory_profile" {
  count          = var.memory_profile_config != null ? 1 : 0
  environment_id = var.render_environment_id
  name           = "memory-profile-${var.environment}"
  env_vars = {
    POLAR_MEMORY_PROFILE_ENABLED        = { value = "true" }
    POLAR_MEMORY_PROFILE_S3_BUCKET_NAME = { value = var.memory_profile_config.s3_bucket_name }
    POLAR_MEMORY_PROFILE_INTERVAL       = { value = var.memory_profile_config.interval }
  }
}

resource "render_env_group" "database" {
  environment_id = var.render_environment_id
  name           = "database-${var.environment}"
  env_vars = merge(
    {
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
    },
    var.postgres_config.host_fallback == null ? {} : {
      POLAR_POSTGRES_HOST_FALLBACK = { value = var.postgres_config.host_fallback }
      POLAR_POSTGRES_PORT_FALLBACK = { value = coalesce(var.postgres_config.port_fallback, var.postgres_config.port) }
    },
    var.postgres_config.read_host_fallback == null ? {} : {
      POLAR_POSTGRES_READ_HOST_FALLBACK = { value = var.postgres_config.read_host_fallback }
      POLAR_POSTGRES_READ_PORT_FALLBACK = { value = coalesce(var.postgres_config.read_port_fallback, var.postgres_config.read_port) }
    },
  )
}

resource "render_env_group" "redis" {
  environment_id = var.render_environment_id
  name           = "redis-${var.environment}"
  env_vars = {
    POLAR_REDIS_HOST = { value = var.redis_config.host }
    POLAR_REDIS_PORT = { value = var.redis_config.port }
    POLAR_REDIS_DB   = { value = var.api_service_config.redis_db }
  }
}

# Services


resource "render_web_service" "api" {
  environment_id     = var.render_environment_id
  name               = "api${local.env_suffix}"
  plan               = var.api_service_config.plan
  region             = "ohio"
  health_check_path  = "/healthz"
  pre_deploy_command = "uv run task pre_deploy"

  # Deploy from the "latest" tag so newly created services come up on the most
  # recent main build. CI deploys specific digests out-of-band (deploy_server.sh),
  # so ignore_changes below keeps Terraform from reverting them.
  runtime_source = {
    image = {
      image_url              = split("@", var.api_service_config.image_url)[0]
      registry_credential_id = var.registry_credential_id
      tag                    = "latest"
    }
  }

  lifecycle {
    ignore_changes = [runtime_source.image]
  }

  autoscaling = var.environment == "production" ? {
    enabled = true
    min     = 2
    max     = 4
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
    } : var.environment == "sandbox" ? {
    enabled = true
    min     = 2
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
    SERVICE_NAME             = { value = "api${local.env_suffix}" }
    WEB_CONCURRENCY          = { value = var.api_service_config.web_concurrency }
    FORWARDED_ALLOW_IPS      = { value = var.api_service_config.forwarded_allow_ips }
    POLAR_ALLOWED_HOSTS      = { value = var.api_service_config.allowed_hosts }
    POLAR_CORS_ORIGINS       = { value = var.api_service_config.cors_origins }
    POLAR_DATABASE_POOL_SIZE = { value = var.api_service_config.database_pool_size }
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

  # Deploy from the "latest" tag so newly created services come up on the most
  # recent main build. CI deploys specific digests out-of-band (deploy_server.sh),
  # so ignore_changes below keeps Terraform from reverting them.
  runtime_source = {
    image = {
      image_url              = split("@", each.value.image_url)[0]
      registry_credential_id = var.registry_credential_id
      tag                    = "latest"
    }
  }

  lifecycle {
    ignore_changes = [runtime_source.image]
  }

  custom_domains = length(each.value.custom_domains) > 0 ? each.value.custom_domains : null

  env_vars = merge(
    {
      SERVICE_NAME             = { value = each.key }
      dramatiq_prom_port       = { value = each.value.dramatiq_prom_port }
      POLAR_DATABASE_POOL_SIZE = { value = each.value.database_pool_size }
    },
    (each.value.redis_host != null && each.value.redis_port != null && each.value.redis_db != null) ? {
      POLAR_REDIS_HOST = { value = each.value.redis_host }
      POLAR_REDIS_PORT = { value = each.value.redis_port }
      POLAR_REDIS_DB   = { value = each.value.redis_db }
    } : {}
  )
}

resource "render_cron_job" "cron" {
  for_each = var.cron_jobs

  environment_id = var.render_environment_id
  name           = each.key
  plan           = each.value.plan
  region         = "ohio"
  schedule       = each.value.schedule
  start_command  = each.value.start_command

  # Cron jobs use tag "latest" instead of a pinned digest so Render
  # automatically pulls the newest image before each run.
  runtime_source = {
    image = {
      image_url              = split("@", coalesce(each.value.image_url, var.api_service_config.image_url))[0]
      registry_credential_id = var.registry_credential_id
      tag                    = "latest"
    }
  }

  # Cron jobs don't support Render secret_files, so we pass JWKS as an env var
  # and write it to a temp file in the start command. POLAR_JWKS is set here
  # to override the env group value (/etc/secrets/jwks.json) which doesn't exist.
  env_vars = {
    SERVICE_NAME             = { value = each.key }
    POLAR_DATABASE_POOL_SIZE = { value = each.value.database_pool_size }
    POLAR_JWKS               = { value = "/tmp/jwks.json" }
    POLAR_JWKS_CONTENT       = { value = var.backend_jwks }
  }
}

locals {
  env_suffix      = var.environment == "production" ? "" : "-${var.environment}"
  worker_ids      = [for w in render_web_service.worker : w.id]
  cron_job_ids    = [for c in render_cron_job.cron : c.id]
  all_service_ids = concat([render_web_service.api.id], local.worker_ids, local.cron_job_ids)
}

# Env group links
resource "render_env_group_link" "database" {
  env_group_id = render_env_group.database.id
  service_ids  = local.all_service_ids
}

resource "render_env_group_link" "redis" {
  env_group_id = render_env_group.redis.id
  service_ids  = local.all_service_ids
}

resource "render_env_group_link" "aws_s3" {
  env_group_id = render_env_group.aws_s3.id
  service_ids  = local.all_service_ids
}

resource "render_env_group_link" "secrets_kms" {
  env_group_id = render_env_group.secrets_kms.id
  service_ids  = local.all_service_ids
}

resource "render_env_group_link" "worker_sqs" {
  count        = nonsensitive(var.environment_groups.worker_sqs != null) ? 1 : 0
  env_group_id = render_env_group.worker_sqs[0].id
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

resource "render_env_group_link" "logfire" {
  count        = nonsensitive(var.environment_groups.logfire != null) ? 1 : 0
  env_group_id = render_env_group.logfire[0].id
  service_ids  = local.all_service_ids
}

resource "render_env_group_link" "openai" {
  env_group_id = render_env_group.openai.id
  service_ids  = local.all_service_ids
}

resource "render_env_group_link" "pydantic_ai_gateway" {
  env_group_id = render_env_group.pydantic_ai_gateway.id
  service_ids  = local.all_service_ids
}

resource "render_env_group_link" "apple" {
  env_group_id = render_env_group.apple.id
  service_ids  = [render_web_service.api.id]
}

resource "render_env_group_link" "prometheus" {
  count        = nonsensitive(var.environment_groups.prometheus != null) ? 1 : 0
  env_group_id = render_env_group.prometheus[0].id
  service_ids  = local.all_service_ids
}

resource "render_env_group_link" "slo_report" {
  count        = nonsensitive(var.environment_groups.slo_report != null) ? 1 : 0
  env_group_id = render_env_group.slo_report[0].id
  service_ids  = local.all_service_ids
}

resource "render_env_group_link" "tinybird" {
  count        = nonsensitive(var.environment_groups.tinybird != null) ? 1 : 0
  env_group_id = render_env_group.tinybird[0].id
  service_ids  = local.all_service_ids
}

resource "render_env_group_link" "polar_self" {
  count        = nonsensitive(var.environment_groups.polar_self != null) ? 1 : 0
  env_group_id = render_env_group.polar_self[0].id
  service_ids  = local.all_service_ids
}

resource "render_env_group_link" "memory_profile" {
  count        = var.memory_profile_config != null ? 1 : 0
  env_group_id = render_env_group.memory_profile[0].id
  service_ids  = concat([render_web_service.api.id], local.worker_ids)
}

resource "cloudflare_dns_record" "resend_dkim" {
  zone_id = var.resend_domain.zone_id
  name    = "resend._domainkey.${var.email_from_domain}"
  type    = "TXT"
  content = var.resend_domain.dkim_public_key
  ttl     = 1
}

resource "cloudflare_dns_record" "resend_spf_mx" {
  zone_id  = var.resend_domain.zone_id
  name     = "send.${var.email_from_domain}"
  type     = "MX"
  content  = "feedback-smtp.us-east-1.amazonses.com"
  priority = 10
  ttl      = 1
}

resource "cloudflare_dns_record" "resend_spf_txt" {
  zone_id = var.resend_domain.zone_id
  name    = "send.${var.email_from_domain}"
  type    = "TXT"
  content = var.resend_domain.spf_policy
  ttl     = 1
}
