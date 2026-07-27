# Polar Infrastructure as Code (IaC)

We use Terraform to manage and provision our cloud infrastructure. This repository contains the necessary configuration files to set up and maintain our infrastructure in a consistent and repeatable manner.

State, Secrets and Runs are directly managed on [HCP Terraform Cloud](https://app.terraform.io/app/polar-sh/workspaces/polar).

## Infrastructure overview

- **Backend**: Hosted on Render (API server, workers)
- **Frontend**: Hosted on Vercel (Next.js web application)
- **AWS**: Multi-account AWS Organizations structure for storage and workloads (see `organization/`)

## HCP Terraform Cloud

The infrastructure is divided up into a project per environment:

Projects:
├── prod
├── sandbox
└── test (For load testing, etc. This environment is fully destructed when needed)

The `organization` workspace manages the AWS Organizations structure and account hierarchy.


## Adding environment variables

### Backend (Render)

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

### Frontend (Vercel)

If you need to add an environment variable to the frontend, follow the pattern in:

- `terraform/modules/vercel/variables.tf` for shared config/secrets
- `terraform/{production,sandbox,test}/vercel.tf` for environment-specific variables
- `terraform/global/{production,sandbox,test}.tf` for Terraform Cloud variables (prefixed with `vercel_`)
