locals {
  name = "polar-${var.environment}-planetscale-metrics"

  alloy_config = <<-EOT
    discovery.http "planetscale" {
      url              = "https://api.planetscale.com/v1/organizations/${var.organization}/metrics"
      refresh_interval = "10m"

      authorization {
        type        = "token"
        credentials = sys.env("PLANETSCALE_METRICS_TOKEN")
      }
    }

    discovery.relabel "planetscale" {
      targets = discovery.http.planetscale.targets

      rule {
        source_labels = ["planetscale_database_name"]
        regex         = "${var.database}"
        action        = "keep"
      }
    }

    prometheus.scrape "planetscale" {
      targets         = discovery.relabel.planetscale.output
      scrape_interval = "1m"
      forward_to      = [prometheus.remote_write.grafana_cloud.receiver]
    }

    prometheus.remote_write "grafana_cloud" {
      external_labels = {
        env = "${var.environment}",
      }

      endpoint {
        url = "${var.prometheus.url}/api/prom/push"

        basic_auth {
          username = "${var.prometheus.username}"
          password = sys.env("GRAFANA_CLOUD_PROMETHEUS_PASSWORD")
        }
      }
    }
  EOT
}

resource "aws_secretsmanager_secret" "planetscale_token" {
  name = "${local.name}-token"
}

resource "aws_secretsmanager_secret_version" "planetscale_token" {
  secret_id     = aws_secretsmanager_secret.planetscale_token.id
  secret_string = var.token
}

resource "aws_secretsmanager_secret" "prometheus_password" {
  name = "${local.name}-prometheus-password"
}

resource "aws_secretsmanager_secret_version" "prometheus_password" {
  secret_id     = aws_secretsmanager_secret.prometheus_password.id
  secret_string = var.prometheus.password
}

resource "aws_security_group" "this" {
  name        = local.name
  description = "Egress-only security group for the PlanetScale metrics scraper."
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

module "service" {
  source = "../ecs_service"

  environment              = var.environment
  name                     = "planetscale-metrics"
  cluster_arn              = var.cluster_arn
  image                    = "grafana/alloy:v1.21.3"
  entrypoint               = ["sh", "-c"]
  command                  = ["printf '%s' \"$ALLOY_CONFIG\" > /tmp/config.alloy && exec alloy run --storage.path=/tmp/alloy /tmp/config.alloy"]
  profile                  = "tiny"
  subnet_ids               = var.subnet_ids
  security_group_ids       = [aws_security_group.this.id]
  permissions_boundary_arn = var.permissions_boundary_arn

  environment_variables = {
    ALLOY_CONFIG = local.alloy_config
    # ECS reads secrets at task start; a new version must roll the task definition.
    SECRET_VERSION_IDS = join(",", [
      aws_secretsmanager_secret_version.planetscale_token.version_id,
      aws_secretsmanager_secret_version.prometheus_password.version_id,
    ])
  }

  secrets = {
    PLANETSCALE_METRICS_TOKEN         = aws_secretsmanager_secret.planetscale_token.arn
    GRAFANA_CLOUD_PROMETHEUS_PASSWORD = aws_secretsmanager_secret.prometheus_password.arn
  }

  depends_on = [
    aws_secretsmanager_secret_version.planetscale_token,
    aws_secretsmanager_secret_version.prometheus_password,
  ]
}
