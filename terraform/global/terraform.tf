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
      version = ">= 6.69.1, < 7.0.0"
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

  required_version = ">= 1.5"
}
