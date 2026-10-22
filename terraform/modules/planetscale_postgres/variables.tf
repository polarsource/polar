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
