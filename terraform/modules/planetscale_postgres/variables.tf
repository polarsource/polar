variable "organization" {
  description = "PlanetScale organization slug."
  type        = string
}

variable "database" {
  description = "PlanetScale database slug. Created together with its first branch."
  type        = string
}

variable "app_database_name" {
  description = "Logical PostgreSQL database for the application. Must be created with SQL before applying app_role_setup_sql."
  type        = string
}

variable "branch" {
  description = "Branch name."
  type        = string
  default     = "main"
}

variable "app_role_name" {
  description = "Display name of the application role. PlanetScale generates its SQL username."
  type        = string
}

variable "region" {
  description = "PlanetScale region slug."
  type        = string
}

variable "cluster_size" {
  description = "PlanetScale cluster size SKU."
  type        = string
}

variable "major_version" {
  description = "PostgreSQL major version."
  type        = string
  default     = "18"
}

variable "deletion_protected" {
  description = "Whether deletion protection is enabled for the branch."
  type        = bool
  default     = true
}

variable "parameters" {
  description = "Parameter overrides by namespace (pgconf, pgbouncer, patroni)."
  type        = map(map(string))
  default     = {}
}
