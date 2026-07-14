locals {
  env_suffix = var.environment == "production" ? "" : "-${var.environment}"
}

resource "render_private_service" "pgbouncer" {
  environment_id = var.render_environment_id
  name           = "${var.name}${local.env_suffix}"
  plan           = var.plan
  region         = "ohio"
  num_instances  = var.num_instances

  runtime_source = {
    image = {
      image_url              = var.image_url
      tag                    = var.image_tag
      registry_credential_id = var.registry_credential_id
    }
  }

  env_vars = {
    DB_HOST                 = { value = var.database.host }
    DB_PORT                 = { value = var.database.port }
    DB_USER                 = { value = var.database.user }
    DB_PASSWORD             = { value = var.database.password }
    POOL_MODE               = { value = var.pool_config.pool_mode }
    MAX_CLIENT_CONN         = { value = var.pool_config.max_client_conn }
    DEFAULT_POOL_SIZE       = { value = var.pool_config.default_pool_size }
    MIN_POOL_SIZE           = { value = var.pool_config.min_pool_size }
    RESERVE_POOL_SIZE       = { value = var.pool_config.reserve_pool_size }
    MAX_PREPARED_STATEMENTS = { value = var.pool_config.max_prepared_statements }
  }
}
