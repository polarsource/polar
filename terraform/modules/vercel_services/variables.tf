variable "name" {
  description = "The Vercel Services project name"
  type        = string
}

variable "git_repo" {
  description = "Connected Git repository, e.g. \"polarsource/polar\""
  type        = string
}

variable "production_branch" {
  description = "Branch deployed to the project's production environment"
  type        = string
  default     = "main"
}

variable "build_machine_type" {
  description = "Vercel build machine type"
  type        = string
  default     = "elastic"
}

variable "resource_config" {
  description = "Vercel project resource configuration"
  type = object({
    fluid                     = optional(bool, true)
    function_default_cpu_type = optional(string)
    function_default_regions  = optional(set(string), ["iad1"])
    function_default_timeout  = optional(number)
  })
  default = {}
}

variable "enable_preview_feedback" {
  description = "Enable the Vercel Toolbar on preview deployments"
  type        = bool
  default     = null
}

variable "enable_production_feedback" {
  description = "Enable the Vercel Toolbar on production deployments"
  type        = bool
  default     = null
}

variable "environment_variable_groups" {
  description = "Named groups of environment variables exposed to the services in the project. Variable map keys are used as Vercel keys unless key is set explicitly."
  type = map(map(object({
    key       = optional(string)
    value     = string
    target    = optional(set(string), ["production", "preview"])
    sensitive = optional(bool, true)
  })))
  sensitive = true
}
