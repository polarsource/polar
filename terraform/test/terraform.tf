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
      version = "~> 5.92"
    }

    render = {
      source  = "render-oss/render"
      version = "1.8.0"
    }

    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.13"
    }

    tfe = {
      source  = "hashicorp/tfe"
      version = "0.71.0"
    }

    vercel = {
      source  = "vercel/vercel"
      version = "~> 5.3"
    }
  }

  required_version = ">= 1.2"
}
