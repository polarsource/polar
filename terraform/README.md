# Polar Infrastructure as Code (IaC)

We use Terraform to manage and provision our cloud infrastructure. This repository contains the necessary configuration files to set up and maintain our infrastructure in a consistent and repeatable manner.

State, Secrets and Runs are directly managed on [HCP Terraform Cloud](https://app.terraform.io/app/polar-sh/workspaces/polar).

## Infrastructure overview

Currently, most of our infrastructure is hosted on Render. We also have AWS S3 buckets to store uploaded files.

## HCP Terraform Cloud

The infrastructure is divided up into a project per environment:

Projects:
├── prod
├── sandbox
└── test (For load testing, etc. This environment is fully destructed when needed)


## Adding environment variables

If you need to add an environment variable to a backend service, do the following:

- Declare a variable in `render.tf`:

```hcl
variable "my_variable" {
  description = "Description of my variable"
  type        = string
  sensitive   = true
}
```

- Attach the variable to a Render environment group, or directly to a service:

```hcl
resource "render_env_group" "backend_production" {
  # ...
  env_vars = {
    # ...
    POLAR_MY_VARIABLE = { value = var.my_variable }
  }
  # ...
}
```

- Set the variable value in HCP Terraform Cloud workspace variables, as **Terraform Variable** with the key `my_variable`.

> [!WARNING]
> Do not create environment variables directly in the Render dashboard, the source of truth for our secrets is Terraform.

On the next Terraform run, the new variable will be copied to Render and made available to the service.
