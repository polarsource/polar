terraform {
  cloud {
    organization = "polar-sh"
    workspaces {
      name = "sandbox"
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
  }

  required_version = ">= 1.2"
}
