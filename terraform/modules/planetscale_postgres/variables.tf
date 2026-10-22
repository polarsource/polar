variable "organization" {
  description = "PlanetScale organization slug."
  type        = string
}

variable "database" {
  description = "Database name. Created together with its first branch."
  type        = string
}

variable "branch" {
  description = "Branch name."
  type        = string
  default     = "main"
}

variable "app_role_name" {
  description = "Base name of the application role. PlanetScale appends a suffix."
  type        = string
}

variable "region" {
  description = "PlanetScale region slug."
  type        = string
}

variable "cluster_size" {
  description = "Cluster size SKU, e.g. PS_10_AWS_ARM."
  type        = string
}

variable "major_version" {
  description = "PostgreSQL major version."
  type        = string
  default     = "18"
}

variable "parameters" {
  description = "Parameter overrides by namespace (pgconf, pgbouncer, patroni)."
  type        = map(map(string))
  default     = {}
}
