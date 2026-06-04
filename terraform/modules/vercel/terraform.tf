terraform {
  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 5.3"
    }

    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.13"
    }
  }

  required_version = ">= 1.2"
}
