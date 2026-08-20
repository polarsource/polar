terraform {
  cloud {
    organization = "polar-sh"
    workspaces {
      name = "global"
    }
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.61"
    }

    render = {
      source  = "render-oss/render"
      version = "1.9.1"
    }

    tfe = {
      source  = "hashicorp/tfe"
      version = "0.80.0"
    }
  }

  required_version = ">= 1.2"
}
