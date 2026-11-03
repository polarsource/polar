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

variable "storage" {
  description = "Storage configuration for non-Metal branches. Omitted settings remain managed by PlanetScale."
  type = object({
    storage_iops            = optional(number)
    storage_throughput_mibs = optional(number)
    minimum_storage_bytes   = optional(number)
    maximum_storage_bytes   = optional(number)
    storage_autoscaling     = optional(bool)
  })
  default = null
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

variable "bouncers" {
  description = "Dedicated PgBouncers keyed by name (at most 12 characters). Clients connect on port 6432 as <app_role_username>|<name>."
  type = map(object({
    target            = optional(string, "primary")
    size              = optional(string, "PGB_5")
    replicas_per_cell = optional(number, 1)
    parameters        = optional(map(map(string)), {})
  }))
  default = {}

  validation {
    condition     = alltrue([for name in keys(var.bouncers) : length(name) <= 12])
    error_message = "Bouncer names must be at most 12 characters."
  }
}
