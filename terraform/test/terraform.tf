terraform {
  cloud {
    organization = "polar-sh"
    workspaces {
      name = "test"
    }
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.69.1, < 7.0.0"
    }

    render = {
      source  = "render-oss/render"
      version = "1.9.1"
    }

    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.13"
    }

    tfe = {
      source  = "hashicorp/tfe"
      version = "0.80.0"
    }

    vercel = {
      source  = "vercel/vercel"
      version = "~> 5.3"
    }

    planetscale = {
      source  = "planetscale/planetscale"
      version = "~> 1.16"
    }
  }

  required_version = ">= 1.2"
}
