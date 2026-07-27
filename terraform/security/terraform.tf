terraform {
  cloud {
    organization = "polar-sh"
    workspaces {
      name = "security"
    }
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.92"
    }
  }

  required_version = ">= 1.2"
}
