terraform {
  cloud {
    organization = "polar-sh"
    workspaces {
      name = "organization"
    }
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.61"
    }
  }

  required_version = ">= 1.5"
}
