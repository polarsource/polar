variable "environment" {
  description = "Environment name"
  type        = string
}

variable "organization" {
  description = "PlanetScale organization slug."
  type        = string
}

variable "database" {
  description = "PlanetScale database slug to scrape. Discovery returns every branch in the organization, so other databases are dropped."
  type        = string
}

variable "token" {
  description = "PlanetScale service token with read_metrics_endpoints, as <token id>:<token>."
  type        = string
  sensitive   = true
}

variable "prometheus" {
  description = "Grafana Cloud Prometheus remote write target."
  type = object({
    url      = string
    username = string
    password = string
  })
  sensitive = true
}

variable "cluster_arn" {
  description = "ECS cluster the scraper runs in."
  type        = string
}

variable "vpc_id" {
  description = "VPC for the scraper's security group."
  type        = string
}

variable "subnet_ids" {
  description = "Private subnets with NAT egress."
  type        = list(string)
}

variable "permissions_boundary_arn" {
  description = "Permissions boundary for the execution role."
  type        = string
}
