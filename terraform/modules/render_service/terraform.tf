terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.69.1, < 7.0.0"
    }

    render = {
      source  = "render-oss/render"
      version = ">= 1.8.0"
    }

    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = ">= 5.13"
    }
  }

  required_version = ">= 1.3"
}
