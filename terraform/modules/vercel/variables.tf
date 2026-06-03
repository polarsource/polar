variable "name" {
  description = "The Vercel project name"
  type        = string
}

# Git / build configuration
variable "git_repo" {
  description = "Connected Git repository, e.g. \"polarsource/polar\""
  type        = string
}

variable "production_branch" {
  description = "Branch deployed to the project's production environment"
  type        = string
  default     = "main"
}

variable "framework" {
  description = "Vercel framework preset"
  type        = string
  default     = "nextjs"
}

variable "root_directory" {
  description = "Directory within the repo that Vercel builds from"
  type        = string
  default     = "clients/apps/web"
}

variable "build_command" {
  description = "Override build command. Leave null to use the repo's vercel.json / autodetection."
  type        = string
  default     = null
}

variable "install_command" {
  description = "Override install command. Leave null to use autodetection."
  type        = string
  default     = null
}

variable "ignore_command" {
  description = "Command that decides whether to skip a build. Leave null to always build."
  type        = string
  default     = null
}

# Project settings (defaults track the live values; override per env if they differ)
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

variable "git_provider_options" {
  description = "Vercel project Git provider options"
  type = object({
    create_deployments         = optional(bool)
    git_commit_status          = optional(bool)
    repository_dispatch_events = optional(bool)
    require_verified_commits   = optional(bool)
    consolidated_git_commit_status = optional(object({
      enabled            = optional(bool)
      propagate_failures = optional(bool)
    }))
  })
  default = null
}

# Custom domains attached to the project
variable "domains" {
  description = "Custom domains served by the project"
  type = list(object({
    name                 = string
    redirect             = optional(string)
    redirect_status_code = optional(number)
    git_branch           = optional(string)
  }))
  default = []
}

# Non-sensitive env vars present in every environment, applied to all targets.
variable "config" {
  description = "Non-sensitive env vars common to every environment"
  type = object({
    next_public_api_url                             = string
    next_public_backoffice_url                      = string
    next_public_sentry_dsn                          = string
    next_public_posthog_token                       = string
    next_public_apple_domain_association            = string
    next_public_checkout_embed_script_src           = string
    next_public_stripe_payment_method_configuration = string
    s3_public_images_bucket_protocol                = string
    s3_public_images_bucket_hostname                = string
    s3_public_images_bucket_port                    = string
    s3_public_images_bucket_pathname                = string
    s3_upload_origins                               = string
    polar_checkout_embed_script_allowed_origins     = string
    polar_openapi_schema_url                        = string
    enable_experimental_corepack                    = string
  })
}

# Sensitive env vars present in every environment. Targets are baked in the module.
variable "secrets" {
  description = "Sensitive env vars common to every environment"
  type = object({
    pydantic_ai_gateway_api_key = string
    mintlify_assistant_api_key  = string
    gram_api_key                = string
    sentry_auth_token           = string
    polar_preview_access_token  = string
  })
  sensitive = true
}

# Env vars that are environment-specific or whose target varies by environment.
variable "environment_variables" {
  description = "Environment-specific Vercel environment variables"
  type = list(object({
    key       = string
    value     = string
    target    = optional(set(string), ["production", "preview", "development"])
    sensitive = optional(bool, false)
  }))
  default = []
}
