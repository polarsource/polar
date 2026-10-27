terraform {
  cloud {
    organization = "polar-sh"
    workspaces {
      name = "identity"
    }
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.69.1, < 7.0.0"
    }
  }

  required_version = ">= 1.2"
}
